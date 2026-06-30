import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.chat.chat_use_case import ChatUseCase
from app.application.prompts.rag.registry import registry, PromptKey
from app.domain.chat.entities import ConversationHistory
from app.domain.rag.task_types import detect_locale
from app.domain.rag.explain_entities import (
    AwaitInputEvent,
    PresentationState,
    SlideContentTokens,
    SlideEndEvent,
    SlideStartEvent,
)
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.db.models import DocumentChunk
from app.shared.config import get_settings


class ExplainUseCase:
    def __init__(self, db: AsyncSession, chat_use_case: ChatUseCase):
        self.db = db
        self.chat_use_case = chat_use_case
        self.redis = get_redis()
        self.settings = get_settings()
        self.session_ttl = 3600  # 1 hour

    async def _get_state(self, session_key: str) -> dict[str, Any]:
        raw = await self.redis.get(session_key)
        if raw:
            from typing import cast

            return cast(dict[str, Any], json.loads(raw))
        return {"current_slide_index": 0, "state": PresentationState.EXPLAINING.value}

    async def _save_state(self, session_key: str, state_data: dict[str, Any]) -> None:
        await self.redis.setex(session_key, self.session_ttl, json.dumps(state_data))

    async def _load_chunks(self, document_id: str) -> list[DocumentChunk]:
        doc_uuid = uuid.UUID(document_id)
        chunks_query = await self.db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc_uuid)
            .order_by(DocumentChunk.chunk_order)
        )
        return list(chunks_query.scalars().all())

    async def _explain_single_slide(
        self,
        slide_index: int,
        chunks: list[DocumentChunk],
    ) -> AsyncGenerator[dict, None]:
        """
        Stream the explanation for a single slide and yield the events for it.

        Yields:
            SlideStartEvent → SlideContentTokens (multiple) → SlideEndEvent
        """
        current_content = chunks[slide_index].chunk_text or ""

        # Build Sliding Window Context
        previous_summary = "None (This is the first slide)"
        if slide_index > 0:
            prev_text = chunks[slide_index - 1].chunk_text or ""
            previous_summary = prev_text[:400] + ("..." if len(prev_text) > 400 else "")

        next_preview = "None (This is the last slide)"
        if slide_index < len(chunks) - 1:
            next_text = chunks[slide_index + 1].chunk_text or ""
            next_preview = next_text[:400] + ("..." if len(next_text) > 400 else "")

        locale = detect_locale(current_content)
        prompt_set = registry.get_prompt_set(PromptKey.WALKTHROUGH, locale)

        sys_str = prompt_set.system.substitute(
            current_slide_number=slide_index + 1,
            total_slides=len(chunks)
        )
        usr_str = prompt_set.footer.substitute(
            previous_slide_summary=previous_summary,
            current_slide_content=current_content,
            next_slide_preview=next_preview
        )

        history = ConversationHistory(system_prompt=sys_str, max_messages=1)
        history.add_user_message(usr_str)

        yield SlideStartEvent(
            slide_index=slide_index, total_slides=len(chunks)
        ).model_dump()

        # Stream explanation from LLM
        async for chunk in self.chat_use_case.llm.stream(history):
            if chunk.token:
                yield SlideContentTokens(tokens=chunk.token).model_dump()

        yield SlideEndEvent(slide_index=slide_index).model_dump()

    async def start_or_resume(self, user_id: str, document_id: str) -> AsyncGenerator[dict, None]:
        """
        B1 fix: Auto-advance through ALL remaining slides in sequence.

        Flow per slide: SlideStartEvent → tokens → SlideEndEvent
        After ALL slides: SlideEndEvent(slide_index=-1) as end-of-presentation signal.

        Design decision: The function auto-advances without waiting for user input between
        slides.  This matches the expected "explain all slides" use case.  If the user
        sends a "continue" message while this is running, the ExplainHandler's intent
        classifier (B2 fix) will NOT cancel this task — handle_user_input will advance
        the slide pointer for the NEXT call instead.
        """
        session_key = f"explain_{user_id}_{document_id}"
        state_data = await self._get_state(session_key)

        chunks = await self._load_chunks(document_id)
        if not chunks:
            yield {"type": "error", "message": "No document content."}
            return

        current_slide_index = state_data["current_slide_index"]

        if current_slide_index >= len(chunks):
            # End the presentation properly if they advance past the end
            yield SlideEndEvent(slide_index=-1).model_dump()
            return

        state_data["state"] = PresentationState.EXPLAINING.value
        await self._save_state(session_key, state_data)

        # Explain just the current slide
        async for event in self._explain_single_slide(current_slide_index, chunks):
            yield event

        state_data["state"] = PresentationState.AWAITING.value
        await self._save_state(session_key, state_data)

        if current_slide_index == len(chunks) - 1:
            # End of presentation: ask if they have questions
            yield SlideContentTokens(
                tokens="\n\n*That concludes the presentation. Do you have any questions?*"
            ).model_dump()
        
        yield AwaitInputEvent().model_dump()



    async def handle_user_input(
        self, user_id: str, document_id: str, text: str
    ) -> AsyncGenerator[dict, None]:
        import re
        session_key = f"explain_{user_id}_{document_id}"
        state_data = await self._get_state(session_key)

        jump_match = re.search(r"(?:jump to slide|skip to slide|slide)\s*(\d+)", text.lower())
        if jump_match:
            try:
                target_slide = int(jump_match.group(1)) - 1  # 1-indexed to 0-indexed
                # Boundary check
                chunks = await self._load_chunks(document_id)
                if target_slide >= 0 and target_slide < len(chunks):
                    state_data["current_slide_index"] = target_slide
            except ValueError:
                pass
            
            await self._save_state(session_key, state_data)
            async for event in self.start_or_resume(user_id, document_id):
                yield event
            return

        if "continue" in text.lower() or "next" in text.lower():
            state_data["current_slide_index"] += 1
            await self._save_state(session_key, state_data)
            async for event in self.start_or_resume(user_id, document_id):
                yield event
            return

        state_data["state"] = PresentationState.ANSWERING.value
        await self._save_state(session_key, state_data)

        metadata_filter = {"slide_index": state_data["current_slide_index"]}

        async for token in self.chat_use_case.stream_rag_query(
            query=text,
            user_id=user_id,
            session_id=None,
            document_id=document_id,
            metadata_filter=metadata_filter,
        ):
            yield SlideContentTokens(tokens=token).model_dump()
        yield {"type": "done"}

        state_data["state"] = PresentationState.AWAITING.value
        await self._save_state(session_key, state_data)

        yield SlideContentTokens(
            tokens="\nShould we continue or do you have more questions?"
        ).model_dump()
        yield AwaitInputEvent().model_dump()
