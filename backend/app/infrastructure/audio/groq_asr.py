import io
import wave
import numpy as np
from loguru import logger
from groq import AsyncGroq

from app.domain.voice.ports import BaseASRProvider, StreamingASRService
from app.domain.voice.entities import ASRResult, ASRSegment, StreamingASRResult

class GroqASRProvider(BaseASRProvider, StreamingASRService):
    def __init__(self, api_key: str, model: str = "whisper-large-v3", language: str = "en"):
        self.client = AsyncGroq(api_key=api_key)
        self.model = model
        self.language = language

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "webm",
        language: str | None = None,
    ) -> ASRResult:
        if not self.client.api_key:
            raise ValueError("GROQ_API_KEY is missing or empty. Please add it to your .env file.")

        if not audio_bytes:
            return ASRResult(transcript="", language=language or self.language)

        try:
            # Groq requires a named file-like object
            file_obj = (f"audio.{audio_format}", io.BytesIO(audio_bytes))
            
            response = await self.client.audio.transcriptions.create(
                file=file_obj,
                model=self.model,
                language=language or self.language,
                response_format="verbose_json",
            )
            
            segments = []
            if hasattr(response, "segments") and response.segments:
                for seg in response.segments:
                    segments.append(
                        ASRSegment(
                            text=seg.text,
                            start_ms=seg.start * 1000,
                            end_ms=seg.end * 1000,
                            language=language or self.language,
                        )
                    )

            return ASRResult(
                transcript=response.text,
                segments=segments,
                language=language or self.language,
                duration_ms=response.duration * 1000 if hasattr(response, "duration") else 0.0,
            )
        except Exception as e:
            logger.error(f"Groq ASR transcription failed: {e}")
            raise

    async def transcribe_stream(
        self, audio_data: np.ndarray, sample_rate: int = 16000
    ) -> StreamingASRResult:
        if not self.client.api_key:
            raise ValueError("GROQ_API_KEY is missing or empty. Please add it to your .env file.")

        if audio_data is None or len(audio_data) == 0:
            return StreamingASRResult(transcript="", is_final=True)

        try:
            # Convert float32 numpy array to int16 bytes
            if audio_data.dtype == np.float32:
                audio_data = np.clip(audio_data, -1.0, 1.0)
                audio_data = (audio_data * 32767).astype(np.int16)
            
            # Create a WAV file in memory
            wav_io = io.BytesIO()
            with wave.open(wav_io, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2) # 2 bytes for int16
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data.tobytes())
            
            wav_bytes = wav_io.getvalue()
            
            file_obj = ("audio.wav", io.BytesIO(wav_bytes))
            
            response = await self.client.audio.transcriptions.create(
                file=file_obj,
                model=self.model,
                language=self.language,
                response_format="json",
            )
            
            return StreamingASRResult(
                transcript=response.text,
                language=self.language,
                is_final=True,
            )
        except Exception as e:
            logger.error(f"Groq streaming ASR transcription failed: {e}")
            raise

    async def is_available(self) -> bool:
        try:
            return bool(self.client.api_key)
        except Exception:
            return False
