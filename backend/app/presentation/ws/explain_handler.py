import asyncio
import json
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger

from app.application.chat.chat_use_case import ChatUseCase
from app.application.explain.explain_use_case import ExplainUseCase


class ExplainHandler:
    def __init__(
        self, websocket: WebSocket, document_id: str, db, user_id: str, chat_use_case: ChatUseCase,
        tts_provider=None, voice_id: Optional[str] = None
    ):
        self.websocket = websocket
        self.document_id = document_id
        self.user_id = user_id
        self.explain_use_case = ExplainUseCase(db=db, chat_use_case=chat_use_case)
        self._main_task: Optional[asyncio.Task] = None
        self.tts_provider = tts_provider
        self.voice_id = voice_id

    async def run(self):
        # Start the presentation
        self._main_task = asyncio.create_task(self._start_presentation())

        try:
            while True:
                try:
                    text = await self.websocket.receive_text()
                except WebSocketDisconnect:
                    logger.info("Explain websocket disconnected.")
                    break

                try:
                    data = json.loads(text)
                    payload_type = data.get("type")
                    if payload_type == "chat.user_message" or payload_type == "client.speech_stopped":
                        await self._handle_interruption(data)
                    elif payload_type == "ping":
                        try:
                            await self.websocket.send_json({"type": "pong"})
                        except (RuntimeError, asyncio.exceptions.IncompleteReadError) as e:
                            logger.debug(f"[WS] Failed to send pong (connection closed?): {e}")
                except json.JSONDecodeError:
                    pass
        finally:
            if self._main_task and not self._main_task.done():
                self._main_task.cancel()
                try:
                    await self._main_task
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error during _main_task cancellation: {e}")


    async def _stream_with_tts(self, generator):
        from app.infrastructure.llm.sentence_splitter import SentenceSplitter
        from app.infrastructure.tts.tts_utils import clean_text_for_tts, visemes_to_dict_list
        from app.schemas.ws_messages import make_tts_ready, make_visemes_ready
        from app.shared.config import get_settings
        from pathlib import Path
        import uuid

        splitter = SentenceSplitter()
        
        # Use lists for mutability across the closure boundaries
        base_msg_id = [str(uuid.uuid4())]
        chunk_idx = [0]
        sentence_queue = asyncio.Queue()

        async def _tts_worker():
            while True:
                item = await sentence_queue.get()
                if item is None:
                    # End signal
                    sentence_queue.task_done()
                    break

                sentence, current_base_msg_id = item
                if not self.tts_provider or not self.voice_id or not sentence.strip():
                    sentence_queue.task_done()
                    continue
                clean_sentence = clean_text_for_tts(sentence)
                if not clean_sentence:
                    sentence_queue.task_done()
                    continue

                try:
                    # Use a specific message ID per slide and chunk
                    msg_id = f"{current_base_msg_id}_{chunk_idx[0]}"
                    chunk_idx[0] += 1
                    
                    result = await self.tts_provider.synthesize(
                        text=clean_sentence,
                        voice=self.voice_id,
                    )
                    audio_bytes = result.audio_bytes
                    duration_ms = result.audio_duration_ms
                    visemes = result.visemes
                    if not audio_bytes:
                        continue

                    # Save audio to disk
                    audio_storage_path = Path(get_settings().AUDIO_STORAGE_PATH)
                    session_audio_dir = audio_storage_path / "system"
                    session_audio_dir.mkdir(parents=True, exist_ok=True)
                    audio_file_path = session_audio_dir / f"{msg_id}.pcm"
                    audio_file_path.write_bytes(audio_bytes)

                    audio_url = f"/api/v1/audio/system/{msg_id}.pcm"

                    # Send TTSReady
                    tts_ready = make_tts_ready(
                        session_id=self.document_id,
                        message_id=msg_id,
                        audio_url=audio_url,
                        duration_ms=int(duration_ms),
                    )
                    await self.websocket.send_json({
                        "type": "tts.ready",
                        "data": tts_ready.model_dump(exclude_none=True)
                    })

                    if visemes:
                        visemes_dicts = visemes_to_dict_list(visemes)
                        visemes_ready = make_visemes_ready(
                            session_id=self.document_id,
                            message_id=msg_id,
                            mouth_cues=visemes_dicts
                        )
                        await self.websocket.send_json({
                            "type": "visemes.ready",
                            "data": visemes_ready.model_dump(exclude_none=True)
                        })
                except Exception as e:
                    logger.error(f"ExplainHandler TTS generation error: {e}")
                finally:
                    sentence_queue.task_done()

        worker_task = asyncio.create_task(_tts_worker())

        try:
            async for event in generator:
                try:
                    await self.websocket.send_json(event)
                except (RuntimeError, asyncio.exceptions.IncompleteReadError) as e:
                    logger.warning(f"[WS] Dead socket write attempt: {e}")
                    return

                event_type = event.get("type", "")
                
                if event_type == "SlideStartEvent":
                    base_msg_id[0] = f"explain_{event.get('slide_index', 0)}"
                    chunk_idx[0] = 0
                    splitter.reset()
                
                elif event_type == "SlideContentTokens":
                    tokens = event.get("tokens", "")
                    if self.tts_provider:
                        sentences = splitter.feed(tokens)
                        for sentence in sentences:
                            sentence_queue.put_nowait((sentence, base_msg_id[0]))
                
                elif event_type in ("SlideEndEvent", "AwaitInputEvent", "done"):
                    if self.tts_provider:
                        remainder = splitter.flush()
                        if remainder:
                            sentence_queue.put_nowait((remainder, base_msg_id[0]))
                    if event_type in ("AwaitInputEvent", "done"):
                        # Generate a new base ID for subsequent Q&A outputs
                        base_msg_id[0] = f"explain_qa_{uuid.uuid4().hex[:8]}"
                        chunk_idx[0] = 0
                        splitter.reset()

            # Wait for all queued sentences to be processed before finishing
            await sentence_queue.join()

        finally:
            # Signal worker to exit and wait for it
            await sentence_queue.put(None)
            try:
                await asyncio.wait_for(worker_task, timeout=5.0)
            except asyncio.TimeoutError:
                worker_task.cancel()

    async def _start_presentation(self):
        try:
            generator = self.explain_use_case.start_or_resume(
                self.user_id, self.document_id
            )
            await self._stream_with_tts(generator)
        except asyncio.CancelledError:
            try:
                await self.explain_use_case.db.rollback()
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Error in _start_presentation: {e}")
            try:
                await self.explain_use_case.db.rollback()
            except Exception:
                pass

    async def _handle_interruption(self, data: dict):
        user_text = data.get("text", "")
        # Fallback to nested data just in case
        if not user_text and isinstance(data.get("data"), dict):
            user_text = data.get("data", {}).get("text", "")

        # Cancel the current presentation task if it's still running
        if self._main_task and not self._main_task.done():
            self._main_task.cancel()
            try:
                await self._main_task
            except asyncio.CancelledError:
                pass

        async def _process_input():
            try:
                generator = self.explain_use_case.handle_user_input(
                    self.user_id, self.document_id, user_text
                )
                await self._stream_with_tts(generator)
            except asyncio.CancelledError:
                try:
                    await self.explain_use_case.db.rollback()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error in handle_user_input: {e}")
                try:
                    await self.explain_use_case.db.rollback()
                except Exception:
                    pass

        self._main_task = asyncio.create_task(_process_input())
