"""
Real-time sentence splitter for LLM streaming output.

Why do we need this?
→ TTS works best on complete sentences.
→ We don't want to wait for the full LLM response.
→ So we detect sentence boundaries in real-time
    and fire TTS as soon as each sentence is ready.

English sentence endings: . ? !
Also split on comma (,) after a threshold length.
"""

from __future__ import annotations

# Characters that definitively end a sentence (English only)
HARD_SENTENCE_ENDINGS = frozenset({".", "!", "?", "\n"})

# Characters that can end a sentence if the buffer is long enough
SOFT_SENTENCE_ENDINGS = frozenset({",", ";", ":", "-"})

# Minimum chars before a soft ending triggers a split
SOFT_SPLIT_MIN_LENGTH = 40

# Minimum chars before we force a split (safety valve for run-on text)
FORCE_SPLIT_LENGTH = 300

# Common abbreviations that should not trigger sentence split on dot
ABBREVIATIONS = {
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "rev",
    "hon",
    "pres",
    "gov",
    "sen",
    "rep",
    "st",
    "ave",
    "blvd",
    "rd",
    "ln",
    "e.g",
    "i.e",
    "vs",
    "etc",
    "inc",
    "ltd",
    "co",
    "corp",
    "jan",
    "feb",
    "mar",
    "apr",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
    "sept",
    "al",
    "gen",
    "col",
    "cmdr",
    "lt",
    "cpl",
    "sgt",
    "pfc",
    "pvt",
    "capt",
    "maj",
    "adm",
}


class SentenceSplitter:
    """
    Accumulates streaming tokens and detects complete sentences.
    Usage:
        splitter = SentenceSplitter()
        for token in stream:
            sentence = splitter.feed(token)
            if sentence:
                send_to_tts(sentence)
        remainder = splitter.flush()
        if remainder:
            send_to_tts(remainder)
    """

    def __init__(self) -> None:
        self._buffer: str = ""

    def feed(self, token: str) -> str | None:
        """
        Feeds a token into the buffer.
        Returns a complete sentence if one is detected, else None.
        """
        self._buffer += token
        return self._try_extract()

    def flush(self) -> str | None:
        """
        Returns whatever is left in the buffer (end of stream).
        """
        text = self._buffer.strip()
        self._buffer = ""
        return text if text else None

    def reset(self) -> None:
        self._buffer = ""

    # ── Private ───────────────────────────────────────────────────────────────
    def _try_extract(self) -> str | None:
        buf = self._buffer

        # ── Hard endings ──────────────────────────────────────────────────────
        for i, char in enumerate(buf):
            if char in HARD_SENTENCE_ENDINGS:
                # Ignore if it's a decimal point (e.g. 3.14)
                if char == "." and i > 0 and buf[i - 1].isdigit():
                    continue
                # Ignore if it's part of an abbreviation (e.g., Mr., Dr., etc.)
                if char == "." and self._is_abbreviation(buf, i):
                    continue
                sentence = buf[: i + 1].strip()
                self._buffer = buf[i + 1 :].lstrip()
                if sentence:
                    return sentence

        # Removed Soft endings to ensure we wait for full sentence boundaries

        # ── Force split (safety valve) ────────────────────────────────────────
        if len(buf) >= FORCE_SPLIT_LENGTH:
            # Split at last space before the limit
            split_at = buf.rfind(" ", 0, FORCE_SPLIT_LENGTH)
            if split_at == -1:
                split_at = FORCE_SPLIT_LENGTH
            sentence = buf[:split_at].strip()
            self._buffer = buf[split_at:].lstrip()
            if sentence:
                return sentence
        return None

    def _is_abbreviation(self, text: str, dot_index: int) -> bool:
        """Check if the dot at dot_index is part of a common abbreviation."""
        # Find the start of the word before the dot
        start = dot_index
        while start > 0 and text[start - 1].isalpha():
            start -= 1
        word = text[start:dot_index].lower()
        # Check if word (without dot) is in abbreviations list
        return word in ABBREVIATIONS

    @property
    def buffer(self) -> str:
        return self._buffer

    @property
    def buffer_length(self) -> int:
        return len(self._buffer)
