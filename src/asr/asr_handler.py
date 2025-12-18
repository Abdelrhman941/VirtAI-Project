import numpy as np
import logging

logger = logging.getLogger(__name__)

class ASRHandler:
    def __init__(self, model, language="ar"):
        self.model = model
        self.language = language
        logger.info(f"ASR Handler initialized for language: {language}")

    def process(self, audio_bytes):
        """
        Processes raw audio bytes and returns transcription.
        """
        try:
            # 1. Convert bytes to float32 (Normalization)
            # Whisper expects audio in range [-1, 1]
            audio = np.frombuffer(audio_bytes, np.int16).astype(np.float32) / 32768.0

            # 2. Transcribe
            # beam_size=5 gives better accuracy than default (1)
            segments, info = self.model.transcribe(
                audio, 
                language=self.language,
                beam_size=5 
            )

            # 3. Combine segments
            text = " ".join(seg.text for seg in segments).strip()

            if not text:
                return None

            logger.info(f"🗣️  Recognized: {text}")

            return {
                "type": "asr_result",
                "text": text,
                "language": self.language,
                "is_final": True
            }

        except Exception as e:
            logger.error(f"ASR Processing Error: {e}")
            return None