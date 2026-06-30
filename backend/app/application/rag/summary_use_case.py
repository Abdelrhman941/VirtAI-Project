import asyncio
import uuid
from collections.abc import AsyncGenerator

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.chat.entities import ConversationHistory
from app.domain.chat.ports import BaseLLMProvider
from app.domain.rag.task_types import Locale, TaskType
from app.infrastructure.db.models import DocumentChunk, SummaryCache
from app.application.prompts.rag.registry import get_prompt_set

_BATCH_CHARS = 10_000
_REDUCE_BATCH_CHARS = 12_000


class SummaryUseCase:
    """Map-reduce summarization pipeline with caching."""

    def __init__(self, llm: BaseLLMProvider):
        self.llm = llm

    async def summarize_document(
        self,
        db: AsyncSession,
        document_id: str,
        locale: Locale = Locale.EN,
    ) -> AsyncGenerator[str, None]:
        """
        Streams a summary for a document using a Map-Reduce pipeline.
        Caches the final result. If already cached, streams the cached result.
        """
        doc_uuid = uuid.UUID(document_id)

        # 1. Check cache
        cache_query = await db.execute(
            select(SummaryCache).where(SummaryCache.document_id == doc_uuid)
        )
        cached = cache_query.scalar_one_or_none()
        if cached:
            logger.info(f"Summary cache hit for {document_id}")
            # Yield cached summary incrementally to mimic streaming (or all at once)
            # Actually, standard SSE clients expect chunks, so let's chunk it.
            chunk_size = 50
            for i in range(0, len(cached.summary_text), chunk_size):
                yield cached.summary_text[i : i + chunk_size]
                await asyncio.sleep(0.01)
            return

        # 2. Fetch chunks
        chunks_query = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc_uuid)
            .order_by(DocumentChunk.chunk_order)
        )
        chunks = chunks_query.scalars().all()

        if not chunks:
            yield "No content found to summarize."
            return

        blocks = []
        for chunk in chunks:
            text = (chunk.chunk_text or "").strip()
            if not text:
                continue
            meta = chunk.chunk_metadata or {}
            label = f"Chunk: {meta.get('chunk_index', chunk.chunk_order)}"
            blocks.append(f"[{label}]\n{text}")

        # 3. MAP Step
        batches = self._split_into_batches(blocks, _BATCH_CHARS)
        logger.info(f"SummaryUseCase: {len(batches)} map batches for {document_id}")

        prompt_set = get_prompt_set(TaskType.SUMMARY_BATCH, locale)

        if len(batches) == 1:
            batch_notes = batches
        else:
            semaphore = asyncio.Semaphore(3)

            async def map_batch(batch_text: str, index: int) -> str:
                async with semaphore:
                    logger.debug(f"Mapping batch {index+1}/{len(batches)}")
                    sys_prompt = prompt_set.system.substitute()
                    footer = prompt_set.footer.substitute()
                    user_text = f"--- Excerpt ---\n\n{batch_text}\n\n{footer}"
                    history = ConversationHistory(system_prompt=sys_prompt)
                    history.add_user_message(user_text)
                    try:
                        res = await self.llm.complete(history)
                        return res.full_text.strip()
                    except Exception as e:
                        logger.error(f"Map failed for batch {index}: {e}")
                        return batch_text

            tasks = [map_batch(text, i) for i, text in enumerate(batches)]
            batch_notes = await asyncio.gather(*tasks)

        # 4. REDUCE Step
        reduce_batches = self._split_into_batches(batch_notes, _REDUCE_BATCH_CHARS)
        while len(reduce_batches) > 1:
            merged = []
            for j in range(0, len(reduce_batches), 2):
                if j + 1 < len(reduce_batches):
                    combined = reduce_batches[j] + "\n\n---\n\n" + reduce_batches[j + 1]
                else:
                    combined = reduce_batches[j]

                # Intermediate merge
                sys_prompt = prompt_set.system.substitute()
                user_text = (
                    "You are merging two sets of detailed notes into one combined set.\n"
                    "Preserve ALL content — do not drop any definitions, formulas, or steps.\n"
                    "Remove duplicate paragraphs only.\n\n"
                    f"{combined}\n\nMerged notes:"
                )
                history = ConversationHistory(system_prompt=sys_prompt)
                history.add_user_message(user_text)
                try:
                    res = await self.llm.complete(history)
                    merged.append(res.full_text.strip())
                except Exception as e:
                    logger.error(f"Intermediate merge failed: {e}")
                    merged.append(combined)

            reduce_batches = self._split_into_batches(merged, _REDUCE_BATCH_CHARS)

        # 5. Final Streaming Reduce
        final_prompt_set = get_prompt_set(TaskType.SUMMARY, locale)
        sys_prompt = final_prompt_set.system.substitute()
        footer = final_prompt_set.footer.substitute()

        user_text = reduce_batches[0] + (f"\n\n{footer}" if footer else "")
        history = ConversationHistory(system_prompt=sys_prompt)
        history.add_user_message(user_text)

        full_summary = []
        try:
            async for token_chunk in self.llm.stream(history):
                if token_chunk.token:
                    full_summary.append(token_chunk.token)
                    yield token_chunk.token
        except Exception as e:
            logger.error(f"Final reduce stream failed: {e}")
            yield "Error generating final summary."
            return

        final_text = "".join(full_summary)

        # 6. Save to cache
        cache_entry = SummaryCache(document_id=doc_uuid, summary_text=final_text)
        db.add(cache_entry)
        try:
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to save summary to cache: {e}")
            await db.rollback()

    def _split_into_batches(self, blocks: list[str], max_chars: int) -> list[str]:
        batches = []
        current_parts: list[str] = []
        current_len = 0

        for block in blocks:
            block_len = len(block)
            separator_len = 2 if current_parts else 0

            if current_parts and current_len + separator_len + block_len > max_chars:
                batches.append("\n\n".join(current_parts))
                current_parts = [block]
                current_len = block_len
            else:
                current_parts.append(block)
                current_len += separator_len + block_len

        if current_parts:
            batches.append("\n\n".join(current_parts))

        return batches
