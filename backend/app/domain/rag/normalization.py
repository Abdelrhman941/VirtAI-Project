import hashlib
import re
import unicodedata

NORMALIZATION_VERSION = "v1"


def normalize_text(text: str) -> str:
    """
    Deterministic normalization for content deduplication.
    Contract v1:
    1. NFC unicode normalization
    2. Lowercase
    3. Strip leading/trailing whitespace
    4. Collapse all whitespace sequences (spaces, tabs, newlines) to single space
    """
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def compute_content_hash(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
