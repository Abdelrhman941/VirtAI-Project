"""Utilities for TTS Service"""

import base64
import io
import re

from loguru import logger
from pydub import AudioSegment

from app.domain.voice.entities import VisemeEvent, WordBoundary


def audio_to_base64(audio_bytes: bytes) -> str:
    """Convert audio bytes to base64 string"""
    return base64.b64encode(audio_bytes).decode("utf-8")


def base64_to_audio(b64_string: str) -> bytes:
    """Convert base64 string to audio bytes"""
    return base64.b64decode(b64_string)


def clean_text_for_tts(text: str) -> str:
    """
    Clean text before sending to TTS.
    Unifies formatting, abbreviations, and markdown removal.
    """
    if not text:
        return text

    # Expand common abbreviations (case-insensitive)
    text = re.sub(r"(?i)\bdr\.", "Doctor ", text)
    text = re.sub(r"(?i)\bmr\.", "Mister ", text)
    text = re.sub(r"(?i)\bmrs\.", "Missus ", text)
    text = re.sub(r"(?i)\bprof\.", "Professor ", text)

    # Remove Markdown URLs/Links: [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)

    # Remove Markdown Images: ![alt](url) -> ""
    text = re.sub(r"!\[[^\]]*\]\([^\)]+\)", "", text)

    # Remove markdown bold/italic/strikethrough markers, but keep the text
    text = re.sub(r"(?<!\\)(\*\*|\*|__|_|~~|`)", "", text)

    # Remove markdown headers (# Header -> Header)
    text = re.sub(r"(?m)^#+\s+", "", text)

    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)

    # Remove emojis and other non-standard characters
    # Keeps word characters (letters, digits), spaces, and standard punctuation/symbols
    text = re.sub(r'[^\w\s.,!?\'"\-;:()$%@&+=/\\<>|]', "", text)

    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_text_for_tts(text: str, max_length: int = 500) -> list[str]:
    """
    Split long text into smaller chunks
    Makes TTS faster and starts streaming quickly
    Split on:
    1. Sentences (. ! ? ؟ !)
    2. Commas (، ,)
    3. Max length
    """
    if len(text) <= max_length:
        return [text]

    # Split on sentence boundaries
    sentence_pattern = r"(?<=[.!?؟!])\s+"
    sentences = re.split(sentence_pattern, text)

    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= max_length:
            current_chunk += sentence + " "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + " "

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks if chunks else [text]


def calculate_audio_duration(audio_bytes: bytes, format: str = "mp3") -> float:
    """
    Calculate audio duration accurately.

    For PCM (raw Int16 LE, 24kHz mono):
        Uses direct arithmetic: bytes / (sample_rate * channels * bytes_per_sample) * 1000
        This is exact and never requires pydub.

    For all other formats:
        Falls back to pydub for container-aware duration.
    """
    if format == "pcm":
        # Raw Int16 LE @ 24 kHz, 1 channel, 2 bytes per sample
        PCM_SAMPLE_RATE = 24_000
        PCM_CHANNELS = 1
        PCM_BYTES_PER_SAMPLE = 2  # Int16
        bytes_per_second = PCM_SAMPLE_RATE * PCM_CHANNELS * PCM_BYTES_PER_SAMPLE
        return (len(audio_bytes) / bytes_per_second) * 1000.0  # milliseconds

    try:
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=format)
        return len(audio)  # milliseconds
    except Exception as e:
        logger.warning(f"Failed to calculate exact duration, estimating: {e}")
        # Fallback: MP3 @ ~24kbps ≈ 3000 bytes/sec
        bytes_per_ms = 3000 / 1000.0
        return len(audio_bytes) / bytes_per_ms


def visemes_to_dict_list(visemes: list[VisemeEvent]) -> list[dict]:
    """Convert list of VisemeEvent objects to dicts for JSON"""
    return [
        {
            "offset_ms": v.offset_ms,
            "viseme_id": v.viseme_id,
            "duration_ms": v.duration_ms,
        }
        for v in visemes
    ]


def word_boundaries_to_dict_list(boundaries: list[WordBoundary]) -> list[dict]:
    """Convert list of WordBoundary objects to dicts for JSON"""
    return [
        {
            "word": w.word,
            "offset_ms": w.offset_ms,
            "duration_ms": w.duration_ms,
        }
        for w in boundaries
    ]


def merge_viseme_lists(viseme_lists: list[list[VisemeEvent]]) -> list[VisemeEvent]:
    """
    Merge multiple viseme lists from different TTS chunks
    Adjusts offsets for sequential playback
    """
    if not viseme_lists:
        return []

    merged = []
    time_offset = 0.0

    for viseme_list in viseme_lists:
        for viseme in viseme_list:
            merged.append(
                VisemeEvent(
                    offset_ms=viseme.offset_ms + time_offset,
                    viseme_id=viseme.viseme_id,
                    duration_ms=viseme.duration_ms,
                )
            )

        if viseme_list:
            time_offset += viseme_list[-1].offset_ms + viseme_list[-1].duration_ms

    return merged


def estimate_tts_cost(text: str) -> dict[str, int | float]:
    """
    Estimate TTS cost based on text length
    Returns character count and estimated duration
    """
    char_count = len(text)
    # Average speaking rate: ~150 words per minute
    # Average word length: ~5 characters
    words = len(text.split())
    estimated_seconds = (words / 150) * 60

    return {
        "characters": char_count,
        "words": words,
        "estimated_seconds": round(estimated_seconds, 1),
    }
