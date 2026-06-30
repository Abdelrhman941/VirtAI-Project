from uuid import uuid4

from app.shared.audio_ids import is_valid_audio_message_id


def test_audio_message_id_accepts_base_uuid() -> None:
    assert is_valid_audio_message_id(str(uuid4())) is True


def test_audio_message_id_accepts_sentence_chunk_suffix() -> None:
    assert is_valid_audio_message_id(f"{uuid4()}_2") is True


def test_audio_message_id_accepts_voice_suffix() -> None:
    assert is_valid_audio_message_id(f"{uuid4()}_onyx") is True


def test_audio_message_id_accepts_sentence_chunk_and_voice_suffix() -> None:
    assert is_valid_audio_message_id(f"{uuid4()}_2_onyx") is True


def test_audio_message_id_rejects_non_numeric_suffix() -> None:
    assert is_valid_audio_message_id(f"{uuid4()}_bad") is False
