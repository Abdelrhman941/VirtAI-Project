import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from loguru import logger

from app.application.voice.pipeline_context import TurnContext
from app.domain.voice.filler_cache import get_filler_cache
from app.schemas.ws_messages import make_tts_ready


class FillerCoordinator:
    def __init__(self, tts_provider: Any = None):
        self.tts_provider = tts_provider

    async def run_filler_task(
        self,
        context: TurnContext,
        history: Any,
        tts_voice: str | None,
        send_callback: Callable[[Any], Awaitable[None]],
    ) -> None:
        """Handles the 400ms gate and filler generation without blocking the event loop."""
        await asyncio.sleep(0.4)

        if context.aborted or context.sentence_index > 0 or not self.tts_provider:
            return

        fc = get_filler_cache()
        if not fc:
            return

        locale = getattr(history, "locale", "en-US")
        base_lang = locale[:2] if locale else "en"
        filler_map = {"ar": "ممم...", "fr": "Euh...", "es": "Mmm...", "en": "Hmm..."}
        filler_text = filler_map.get(base_lang, "Hmm...")

        try:
            filler_tts = await fc.get_or_generate_filler(
                filler_text, voice=tts_voice, session_id="system"
            )

            if (
                filler_tts
                and getattr(filler_tts, "audio_ref", None)
                and not context.aborted
                and context.sentence_index == 0
            ):
                assert filler_tts.audio_ref is not None
                audio_file_id = Path(filler_tts.audio_ref).stem
                audio_url = f"/api/v1/audio/system/{audio_file_id}.mp3"
                await send_callback(
                    make_tts_ready(
                        session_id=context.session_id,
                        message_id=f"{context.message_id}_filler",
                        audio_url=audio_url,
                        duration_ms=int(filler_tts.audio_duration_ms),
                    )
                )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Failed to generate filler: {e} | trace_id={context.trace_id}")
