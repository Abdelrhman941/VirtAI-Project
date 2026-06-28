"""Voice Mode Handler for continuous ASR voice mode.

This module provides the VoiceModeHandler class that integrates AudioPipeline
with the ASR service and conversation pipeline. It receives raw PCM audio bytes
via WebSocket binary frames, accumulates them until silence is detected, transcribes
the audio, and passes the transcript to the conversation pipeline for LLM processing.

Architecture:
    WebSocket (Binary Frames) → VoiceModeHandler → AudioPipeline → ASR → ConversationPipeline
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from loguru import logger

from app.domain.voice.ports import StreamingASRService
from app.infrastructure.asr.audio_pipeline import (
    AudioPipeline,
    AudioSilencedError,
    BufferOverflowError,
    BufferTimeoutError,
    ChunkSizeError,
    RateLimitError,
)
from app.presentation.ws.outbound_sender import OutboundSender

if TYPE_CHECKING:
    from fastapi import WebSocket

    from app.application.voice.handle_voice_turn import ConversationPipeline


class VoiceModeHandler:
    def __init__(
        self,
        websocket: WebSocket,
        session_id: str,
        asr_service: StreamingASRService,
        conversation_pipeline: ConversationPipeline | None = None,
        turn_callback=None,
        outbound_sender: OutboundSender | None = None,
        audio_pipeline: AudioPipeline | None = None,
    ):
        self.websocket = websocket
        self.session_id = session_id
        self.asr_service = asr_service
        self.conversation_pipeline = conversation_pipeline
        self.outbound_sender = outbound_sender
        self.turn_callback = turn_callback
        self.audio_pipeline = audio_pipeline or AudioPipeline()

        self._transcription_tasks: set[asyncio.Task] = set()
        self.max_concurrent_transcriptions = 3

        self._current_sequence = 0
        self._next_sequence_to_process = 1
        self._completed_transcripts: dict[int, str] = {}

        logger.info(f"VoiceModeHandler initialized | " f"session={session_id}")

    def _track_transcription_task(self, task: asyncio.Task) -> None:
        self._transcription_tasks.add(task)
        task.add_done_callback(self._on_transcription_task_done)

    def _on_transcription_task_done(self, task: asyncio.Task) -> None:
        self._transcription_tasks.discard(task)
        try:
            task.result()
        except asyncio.CancelledError:
            logger.debug(f"Transcription task cancelled | session={self.session_id}")
        except Exception:
            logger.exception(f"Transcription task failed | session={self.session_id}")

    async def handle_audio_chunk(self, pcm_bytes: bytes, is_final: bool = False) -> None:
        try:
            if not isinstance(pcm_bytes, bytes):
                raise ValueError("Audio data must be bytes")

            if len(pcm_bytes) == 0:
                raise ValueError("Audio data cannot be empty")

            # Add PCM chunk to pipeline
            self.audio_pipeline.add_pcm_chunk(pcm_bytes, is_final=is_final)

            logger.debug(
                f"PCM chunk added | "
                f"session={self.session_id} | "
                f"is_final={is_final} | "
                f"buffer_size={self.audio_pipeline.get_buffer_size()} bytes"
            )

            # Process accumulated audio if buffer should be processed
            # This triggers on either: VAD silence detection (is_final) or proactive duration flush
            if self.audio_pipeline.should_process():
                await self.process_accumulated_audio()

        except RateLimitError as e:
            logger.warning(f"Rate limit exceeded | session={self.session_id} | error={e!s}")
            payload = {
                "type": "error",
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Too many audio chunks. Please slow down. ({e!s})",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)

        except ChunkSizeError as e:
            logger.error(f"Chunk size exceeded | session={self.session_id} | error={e!s}")
            payload = {
                "type": "error",
                "code": "CHUNK_SIZE_EXCEEDED",
                "message": "Audio chunk is too large. Please use smaller chunks.",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)

        except BufferTimeoutError as e:
            # Comprehensive error logging for buffer timeout with session info (Requirement 9.2, 9.3)
            logger.error(
                f"Buffer timeout | "
                f"session={self.session_id} | "
                f"buffer_size={self.audio_pipeline.get_buffer_size():,}B | "
                f"timeout={self.audio_pipeline.buffer_timeout}s | "
                f"error={e!s}"
            )
            payload = {
                "type": "error",
                "code": "BUFFER_TIMEOUT",
                "message": "Audio buffer timeout. Please speak in shorter segments.",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)
            # Clear buffer to recover
            self.audio_pipeline.clear_buffer()

        except BufferOverflowError as e:
            # Comprehensive error logging for buffer overflow with session info (Requirement 9.2, 9.3)
            logger.error(
                f"Buffer overflow | "
                f"session={self.session_id} | "
                f"buffer_size={self.audio_pipeline.get_buffer_size():,}B | "
                f"max_buffer_size={self.audio_pipeline.max_buffer_size:,}B | "
                f"error={e!s}"
            )
            payload = {
                "type": "error",
                "code": "BUFFER_OVERFLOW",
                "message": "Audio buffer exceeded maximum size. Please speak in shorter segments.",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)
            # Clear buffer to recover
            self.audio_pipeline.clear_buffer()

        except ValueError as e:
            logger.error(f"Invalid PCM audio data | session={self.session_id} | error={e!s}")
            payload = {
                "type": "error",
                "code": "INVALID_AUDIO_DATA",
                "message": f"Invalid PCM audio data: {e!s}",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)

        except Exception:
            logger.exception(f"Unexpected error handling audio chunk | session={self.session_id}")
            payload = {
                "type": "error",
                "code": "AUDIO_PROCESSING_ERROR",
                "message": "An unexpected error occurred while processing audio.",
                "session_id": self.session_id,
            }
            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(payload, self.session_id)
            else:
                await self.websocket.send_json(payload)

    async def process_accumulated_audio(self) -> None:
        """Process buffered PCM audio through ASR and conversation pipeline.

        Retrieves accumulated PCM audio from buffer, converts it to float32 numpy array,
        transcribes it using the ASR service, sends the transcript to the client, and
        passes it to the conversation pipeline for LLM processing.

        Preconditions:
            - Audio pipeline contains at least one chunk
            - should_process() returns True (either VAD silence or duration threshold)
            - ASR service is initialized and ready

        Postconditions:
            - PCM audio is converted to float32 numpy array
            - Audio is transcribed to text
            - Transcript is sent to client via WebSocket
            - Transcript is passed to conversation pipeline
            - Audio buffer is cleared
            - If transcription fails, error is sent to client and buffer is cleared
        """
        total_size = 0
        try:
            total_size = self.audio_pipeline.get_buffer_size()

            if total_size == 0:
                logger.warning(f"No audio data to process | session={self.session_id}")
                self.audio_pipeline.clear_buffer()
                return

            logger.info(
                f"Processing accumulated PCM audio | "
                f"session={self.session_id} | "
                f"total_size={total_size} bytes"
            )

            try:
                audio_data = self.audio_pipeline.get_audio_for_asr()
            except AudioSilencedError as vad_err:
                logger.warning(
                    f"Server-Side VAD rejected buffer | session={self.session_id} | {vad_err}"
                )
                self.audio_pipeline.clear_buffer()
                return

            self.audio_pipeline.clear_buffer()

            if len(self._transcription_tasks) >= self.max_concurrent_transcriptions:
                logger.warning(
                    f"Dropping audio chunk | session={self.session_id} | "
                    f"reason=backpressure (max {self.max_concurrent_transcriptions} tasks)"
                )
                self.audio_pipeline.clear_buffer()
                error_message = {
                    "type": "error",
                    "code": "SERVER_OVERLOADED",
                    "message": "The server is processing too much audio. Please wait a moment.",
                    "session_id": self.session_id,
                }
                if self.outbound_sender:
                    await self.outbound_sender.safe_send_raw(error_message, self.session_id)
                else:
                    await self.websocket.send_json(error_message)
                return

            self._current_sequence += 1
            seq = self._current_sequence

            task = asyncio.create_task(
                self._transcribe_and_send(audio_data, total_size, seq),
                name=f"voice_asr_{self.session_id}_{seq}",
            )
            self._track_transcription_task(task)

        except Exception as e:
            # Comprehensive error logging for transcription failures (Requirement 10.3, 10.4)
            logger.exception(
                f"Transcription failed | "
                f"session={self.session_id} | "
                f"total_size={total_size:,}B | "
                f"error_type={type(e).__name__}"
            )

            # Send detailed error message to client
            error_message = {
                "type": "error",
                "code": "TRANSCRIPTION_FAILED",
                "message": "Audio transcription failed",
                "session_id": self.session_id,
                "details": {},  # Always include details field
            }

            # Include error details if it's an ASRException with details (Requirement 13.5)
            exc_details = getattr(e, "details", None)
            if exc_details:
                error_message["details"] = exc_details

                # If it's a format conversion error, provide supported formats
                if "supported_formats" in exc_details:
                    error_message["message"] = (
                        f"Audio format not supported. Supported formats: "
                        f"{', '.join(exc_details['supported_formats'])}"
                    )
            else:
                # For generic exceptions, include error type and message
                error_message["details"] = {"error_type": type(e).__name__, "error": str(e)}

            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(error_message, self.session_id)
            else:
                await self.websocket.send_json(error_message)

            # Clear buffer to prepare for next attempt
            self.audio_pipeline.clear_buffer()

    async def _transcribe_and_send(self, audio_data, total_size: int, sequence_id: int) -> None:
        try:
            result = await self.asr_service.transcribe_stream(audio_data=audio_data)

            logger.info(
                f"Transcription complete | "
                f"session={self.session_id} | "
                f"seq={sequence_id} | "
                f"transcript_length={len(result.transcript)} | "
                f"confidence={result.confidence:.2f} | "
                f"language={result.language}"
            )

            # Send transcript to client
            await self.send_transcript(
                text=result.transcript,
                confidence=result.confidence,
                language=result.language,
            )

            self._completed_transcripts[sequence_id] = result.transcript

            # Process sequentially
            while self._next_sequence_to_process in self._completed_transcripts:
                transcript = self._completed_transcripts.pop(self._next_sequence_to_process)
                current_seq = self._next_sequence_to_process
                self._next_sequence_to_process += 1

                if transcript.strip():
                    logger.info(
                        f"Triggering conversation pipeline | "
                        f"session={self.session_id} | "
                        f"seq={current_seq} | "
                        f"transcript='{transcript[:60]}'"
                    )
                    if self.turn_callback:
                        await self.turn_callback(transcript)
                else:
                    logger.warning(
                        f"Empty transcript received | session={self.session_id} | seq={current_seq}"
                    )

        except Exception as e:
            # Ensure sequence moves forward even on error
            self._completed_transcripts[sequence_id] = ""
            while self._next_sequence_to_process in self._completed_transcripts:
                transcript = self._completed_transcripts.pop(self._next_sequence_to_process)
                self._next_sequence_to_process += 1
                if transcript.strip() and self.turn_callback:
                    await self.turn_callback(transcript)
            # Comprehensive error logging for transcription failures (Requirement 10.3, 10.4)
            logger.exception(
                f"Transcription failed | "
                f"session={self.session_id} | "
                f"total_size={total_size:,}B | "
                f"error_type={type(e).__name__}"
            )

            # Send detailed error message to client
            error_message = {
                "type": "error",
                "code": "TRANSCRIPTION_FAILED",
                "message": "Audio transcription failed",
                "session_id": self.session_id,
                "details": {},  # Always include details field
            }

            # Include error details if it's an ASRException with details (Requirement 13.5)
            exc_details = getattr(e, "details", None)
            if exc_details:
                error_message["details"] = exc_details

                # If it's a format conversion error, provide supported formats
                if "supported_formats" in exc_details:
                    error_message["message"] = (
                        f"Audio format not supported. Supported formats: "
                        f"{', '.join(exc_details['supported_formats'])}"
                    )
            else:
                # For generic exceptions, include error type and message
                error_message["details"] = {"error_type": type(e).__name__, "error": str(e)}

            if self.outbound_sender:
                await self.outbound_sender.safe_send_raw(error_message, self.session_id)
            else:
                await self.websocket.send_json(error_message)

    async def shutdown(self) -> None:
        if not self._transcription_tasks:
            return
        for task in list(self._transcription_tasks):
            task.cancel()
        await asyncio.gather(*self._transcription_tasks, return_exceptions=True)
        self._transcription_tasks.clear()

    async def send_transcript(
        self,
        text: str,
        confidence: float = 1.0,
        language: str = "en",
    ) -> None:
        """Send transcript message to client via WebSocket.

        Args:
            text: Transcribed text from ASR
            confidence: Confidence score from ASR (0.0 to 1.0)
            language: Detected language code (e.g., "en", "ar")

        Preconditions:
            - text is non-empty string
            - confidence is between 0.0 and 1.0
            - language is valid ISO 639-1 code
            - WebSocket connection is active

        Postconditions:
            - Transcript message is sent to client
            - Message includes session_id, text, confidence, language, and is_final flag
        """
        try:
            from app.schemas.ws_messages import TranscriptMessage

            transcript_msg = TranscriptMessage(
                session_id=self.session_id,
                text=text,
                is_final=True,
                confidence=confidence,
                language=language,
            )
            if self.outbound_sender:
                await self.outbound_sender.send_protocol_message(
                    transcript_msg, self.session_id, False, True
                )
            else:
                await self.websocket.send_text(
                    f'{{"type": "transcript", "data": {transcript_msg.model_dump_json()}}}'
                )

            logger.debug(
                f"Transcript sent | "
                f"session={self.session_id} | "
                f"text_length={len(text)} | "
                f"confidence={confidence:.2f}"
            )

        except Exception:
            logger.exception(f"Failed to send transcript | session={self.session_id}")
            # Don't raise - this is a best-effort notification
