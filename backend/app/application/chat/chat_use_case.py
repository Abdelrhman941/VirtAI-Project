from typing import Any

from app.application.chat.prompt_builder import PromptBuilder
from app.application.rag.intent_classifier import IntentClassifier
from app.application.rag.retrieval_use_case import RetrievalUseCase
from app.domain.chat.policies import build_conversation
from app.domain.chat.ports import BaseLLMProvider, ChatContextCachePort
from app.domain.rag.task_types import classify_task_type, detect_locale, Locale
from app.application.prompts.rag.registry import get_utility_template, PromptKey


class ChatUseCase:
    """Use case for non-streaming REST queries with RAG context injection."""

    def __init__(
        self,
        llm_provider: BaseLLMProvider,
        retrieval_use_case: RetrievalUseCase,
        intent_classifier: IntentClassifier | None = None,
        context_cache: ChatContextCachePort | None = None,
    ):
        self.llm = llm_provider
        self.retrieval = retrieval_use_case
        self.intent_classifier = intent_classifier
        self.context_cache = context_cache

    async def execute_rag_query(
        self,
        query: str,
        user_id: str,
        session_id: str | None = None,
        document_id: str | None = None,
        metadata_filter: dict[str, Any] | None = None,
        locale: Locale | None = None,
    ) -> str:
        # Retrieve context
        low_confidence = False
        context = ""
        is_casual = False
        if self.intent_classifier:
            is_casual = await self.intent_classifier.async_is_casual_chat(query)

        if not is_casual:
            from app.domain.rag.entities import RetrievalStatus

            task_type = classify_task_type(query)
            result = await self.retrieval.retrieve(
                query,
                user_id=user_id,
                task_type=task_type,
                document_id=document_id,
                metadata_filter=metadata_filter,
            )
            if result.status not in (RetrievalStatus.NO_RESULTS, RetrievalStatus.FAILED):
                if result.status == RetrievalStatus.LOW_CONFIDENCE:
                    low_confidence = True

                chunks: list[Any] = result.documents
                if self.retrieval.budget_manager and chunks:
                    chunks = self.retrieval.budget_manager.fit_chunks_to_budget(
                        chunks=chunks,
                        system_prompt="",
                        user_query=query,
                        max_context_tokens=3000,
                    )
                from app.application.rag.retrieval_use_case import _get_chunk_text, _source_name

                context_parts = []
                for chunk in chunks:
                    source = _source_name(chunk.metadata)
                    context_parts.append(f"--- Document: {source} ---\n{_get_chunk_text(chunk)}\n")
                context = "\n".join(context_parts)

        # Build prompt
        if locale is None:
            locale = detect_locale(query)
        prompt = PromptBuilder.build_user_prompt_with_context(query, context, locale)
        if low_confidence and context:
            warning = get_utility_template(PromptKey.SYSTEM_WARNING_LOW_CONFIDENCE, locale).substitute()
            prompt = warning + prompt

        history = build_conversation("avatar1")

        if session_id and self.context_cache:
            ctx_messages = await self.context_cache.get_or_rebuild_context(session_id)
            for msg in ctx_messages:
                if msg["role"] == "user":
                    history.add_user_message(msg["content"])
                elif msg["role"] == "assistant":
                    history.add_assistant_message(msg["content"])

        history.add_user_message(prompt)

        # push user msg to cache
        if session_id:
            if self.context_cache:
                await self.context_cache.push_message(session_id, "user", prompt)

        full_response = []
        async for token_chunk in self.llm.stream(history):
            if token_chunk.token:
                full_response.append(token_chunk.token)

        full_text = "".join(full_response).strip()

        # push assistant response to cache
        if session_id:
            if self.context_cache:
                await self.context_cache.push_message(session_id, "assistant", full_text)

        return full_text
