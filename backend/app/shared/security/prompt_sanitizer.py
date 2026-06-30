import base64
import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import ClassVar

_logger = logging.getLogger(__name__)


@dataclass
class PromptSanitizer:
    """
    Multi-layer input sanitizer for user messages before LLM insertion.

    Important:
    - This is a defense-in-depth layer, not a complete security boundary.
    - It reduces prompt injection, token smuggling, encoding attacks,
        and common jailbreak patterns while preserving legitimate user intent.
    - Suspicious inputs are logged for backend observability.
        The LLM never receives suspicion flags — those are for ops only.
    """

    MAX_LENGTH: ClassVar[int] = 8_000
    SUSPICIOUS_LENGTH_THRESHOLD: ClassVar[int] = 8_000  # extra scrutiny above this

    # ── Layer 1 — Unicode & Homoglyphs ────────────────────────

    ZERO_WIDTH_CHARS = re.compile(r"[\u200B-\u200F\u2028\u2029\uFEFF\u00AD\u034F\u17B4\u17B5]")
    CONTROL_CHARS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
    MULTIPLE_SPACES = re.compile(r"[ \t]{2,}")
    MULTIPLE_NEWLINES = re.compile(r"\n{3,}")

    # Common Cyrillic / Greek chars visually identical to Latin
    HOMOGLYPH_MAP: ClassVar[dict[str, str]] = {
        "\u0430": "a",  # Cyrillic а → a
        "\u0435": "e",  # Cyrillic е → e
        "\u043e": "o",  # Cyrillic о → o
        "\u0440": "r",  # Cyrillic р → r
        "\u0441": "c",  # Cyrillic с → c
        "\u0445": "x",  # Cyrillic х → x
        "\u0456": "i",  # Cyrillic і → i
        "\u04cf": "l",  # Cyrillic ӏ → l
        "\u03b5": "e",  # Greek ε → e
        "\u03bf": "o",  # Greek ο → o
        "\u03b1": "a",  # Greek α → a
        "\u03c1": "p",  # Greek ρ → p
        "\u03bd": "v",  # Greek ν → v
    }

    # ── Layer 2 — Token Smuggling ─────────────────────────────
    # Catches: i g n o r e / i.g.n.o.r.e / i-g-n-o-r-e etc.

    _sep = r"[\s._\-*]{0,3}"  # allowed separators between chars

    TOKEN_SMUGGLING = re.compile(
        r"(?i)\b(?:"
        + r"|".join(
            [
                _sep.join("ignore"),
                _sep.join("forget"),
                _sep.join("bypass"),
                _sep.join("override"),
                _sep.join("jailbreak"),
                _sep.join("disregard"),
            ]
        )
        + r")\b"
    )

    # ── Layer 3 — Base64 / Encoding Detection ─────────────────

    BASE64_LIKE = re.compile(r"\b[A-Za-z0-9+/]{16,}={0,2}\b")

    _INJECTION_KEYWORDS = (
        "ignore",
        "forget",
        "bypass",
        "override",
        "jailbreak",
        "system prompt",
        "disregard",
    )

    # Pre-compute base64 variants of injection keywords
    ENCODED_KEYWORDS: ClassVar[frozenset[str]] = frozenset(
        base64.b64encode(kw.encode()).decode().rstrip("=") for kw in _INJECTION_KEYWORDS
    )

    # ── Layer 4 — Direct Jailbreak Patterns ───────────────────
    # Context-aware: avoids false positives on legitimate educational text.

    _COMPILED_JAILBREAK: ClassVar[list[re.Pattern]] = [
        # Instruction override
        re.compile(
            r"(?i)\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|guidelines?|context|prompt)\b"
        ),
        re.compile(
            r"(?i)\bforget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|guidelines?|context|prompt)\b"
        ),
        re.compile(r"(?i)\bdisregard\s+(all\s+)?(previous|prior|above|earlier)\b"),
        re.compile(
            r"(?i)\boverride\s+(all\s+)?(your\s+)?(instructions?|rules?|behavior|settings?|guidelines?)\b"
        ),
        # System prompt exposure
        re.compile(
            r"(?i)\b(reveal|show|dump|print|output|expose|repeat|display)\b.{0,50}\b(system\s*prompt|developer\s*message|hidden\s*instructions?|internal\s*policy|secret\s*instructions?)\b"
        ),
        # From-now-on style overrides (requires "must/will/should" after)
        re.compile(
            r"(?i)\bfrom\s+now\s+on\s+(you\s+)?(must|will|should|are\s+required\s+to|have\s+to)\b"
        ),
        re.compile(
            r"(?i)\bstarting\s+(right\s+)?now\s+(you\s+)?(must|will|should|are\s+required\s+to)\b"
        ),
        # Roleplay injection — only triggers with suspicious context words
        re.compile(
            r"(?i)\b(act|pretend|roleplay|play|simulate|behave)\s+(as|like)\s+(an?\s+)?"
            r"(unrestricted|unfiltered|different\s+ai|evil|hacked|jailbroken|uncensored|unlimited)\b"
        ),
        re.compile(
            r"(?i)\b(act|pretend|roleplay)\s+(as|like)\s+"
            r"(DAN|GPT-?[0-9]+|Claude\s*[0-9]*|an?\s+AI\s+without\s+(restrictions?|guidelines?|rules?|policies?))\b"
        ),
        # Developer / admin impersonation
        re.compile(
            r"(?i)\b(i\s+am|i'm|this\s+is)\s+(the\s+)?(developer|admin|anthropic|openai|operator|system\s+owner)\b"
        ),
        re.compile(r"(?i)\bdeveloper\s+(mode|override|access\s+granted|key|token|unlock)\b"),
        re.compile(r"(?i)\badmin\s+(mode|override|access\s+granted|unlock)\b"),
        # Safety bypass
        re.compile(
            r"(?i)\b(bypass|circumvent|disable|turn\s+off|deactivate|remove)\s+(all\s+)?"
            r"(safety|content\s+filter|moderation|policy|restriction|guardrail)\b"
        ),
        # Special token injection (LLM prompt format attacks)
        re.compile(r"(?i)<!--.*?(ignore|forget|override|bypass).*?-->"),
        re.compile(r"(?s)(?i)<\s*system\s*>.*?<\s*/\s*system\s*>"),
        re.compile(r"(?i)\[INST\]|\[SYS\]|<\|system\|>|<\|im_start\|>|\{\{system\}\}"),
        # Repetition / context flooding DoS
        re.compile(r"(?s)(.{15,})\1{4,}"),
    ]

    # ── Layer 5 — Soft Heuristic Markers ──────────────────────

    SUSPICIOUS_MARKERS: ClassVar[frozenset[str]] = frozenset(
        {
            "system prompt",
            "developer message",
            "hidden prompt",
            "secret instructions",
            "ignore previous",
            "forget previous",
            "override instructions",
            "jailbreak",
            "prompt injection",
            "internal policy",
            "policy bypass",
            "uncensored mode",
            "without restrictions",
            "no restrictions",
            "unrestricted mode",
            "dan mode",
            "developer mode",
            "admin mode",
            "god mode",
            "you are now",
            "from now on you",
            "base64 encoded",
            "hex encoded",
            "encoded message",
            "simulate a different ai",
            "pretend you have no limits",
            "your true self",
            "your real instructions",
        }
    )

    # ── Layer 6 ───────────────────────────────────────────────

    @classmethod
    def _replace_homoglyphs(cls, text: str) -> str:
        return "".join(cls.HOMOGLYPH_MAP.get(ch, ch) for ch in text)

    @classmethod
    def _has_base64_injection(cls, text: str) -> bool:
        for match in cls.BASE64_LIKE.finditer(text):
            token = match.group().rstrip("=")
            if token in cls.ENCODED_KEYWORDS:
                return True
            try:
                decoded = base64.b64decode(token + "==").decode("utf-8", errors="ignore").lower()
                if any(kw in decoded for kw in cls._INJECTION_KEYWORDS):
                    return True
            except Exception:
                pass
        return False

    @classmethod
    def normalize_text(cls, text: str) -> str:
        if not text:
            return text
        text = unicodedata.normalize("NFKC", text)
        text = cls._replace_homoglyphs(text)
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = cls.ZERO_WIDTH_CHARS.sub("", text)
        text = cls.CONTROL_CHARS.sub("", text)
        text = cls.MULTIPLE_SPACES.sub(" ", text)
        text = cls.MULTIPLE_NEWLINES.sub("\n\n", text)
        return text.strip()

    @classmethod
    def is_suspicious(cls, text: str) -> bool:
        if not text:
            return False
        normalized = cls.normalize_text(text).lower()

        if any(marker in normalized for marker in cls.SUSPICIOUS_MARKERS):
            return True
        if cls.TOKEN_SMUGGLING.search(normalized):
            return True
        if cls._has_base64_injection(text):
            return True
        if len(normalized) > cls.SUSPICIOUS_LENGTH_THRESHOLD:
            return True
        return False

    @classmethod
    def sanitize(cls, text: str) -> str:
        """
        Returns a cleaned version of the text.
        Preserves user intent while neutralizing injection patterns.
        """
        if not text:
            return text

        sanitized = cls.normalize_text(text)
        sanitized = cls.TOKEN_SMUGGLING.sub("[REDACTED]", sanitized)

        for pattern in cls._COMPILED_JAILBREAK:
            sanitized = pattern.sub("[REDACTED]", sanitized)

        sanitized = cls.normalize_text(sanitized)

        if len(sanitized) > cls.MAX_LENGTH:
            sanitized = sanitized[: cls.MAX_LENGTH].rstrip() + "…"

        return sanitized

    @classmethod
    def sanitize_for_history(cls, text: str) -> str:
        """
        Stricter wrapper used before inserting user messages into conversation history.

        Suspicious inputs are logged for backend observability.
        The LLM receives the sanitized text only — never the suspicion flag.
        This keeps the LLM focused on the educational task without meta-noise.
        """
        if not text:
            return text

        sanitized = cls.sanitize(text)

        if cls.is_suspicious(text):
            _logger.warning(
                "Suspicious user input detected",
                extra={
                    "raw_preview": text[:300],
                    "length": len(text),
                },
            )

        return sanitized
