from app.application.rag.token_budget import TokenBudgetManager
from app.domain.chat.entities import ChatMessage, MessageRole
from app.domain.rag.citation import build_citations, format_sources_block
from app.domain.rag.entities import RetrievedDocument
from app.domain.rag.task_types import TASK_MAX_TOKENS, Locale, TaskType
from app.application.prompts.rag.registry import get_prompt_set


class ResponseFormatterService:
    """Domain/Application service for formatting RAG prompts and final outputs."""

    def __init__(self, budget_manager: TokenBudgetManager) -> None:
        self.budget_manager = budget_manager

    def format_prompt(
        self,
        query: str,
        chunks: list[RetrievedDocument],
        task_type: TaskType,
        locale: Locale,
        history_tokens: int = 0,
    ) -> list[ChatMessage]:
        """
        Maps context, intent, and locale into a final LLM prompt (system, user messages).
        Truncates documents safely (dropping lowest scored) to respect the intent's token budget.
        Does NOT truncate system prompts, guardrails, or citations.
        """
        prompt_set = get_prompt_set(task_type, locale)
        max_tokens = TASK_MAX_TOKENS.get(task_type, 1500)

        # Build system and footer strings safely
        kwargs: dict[str, str | int] = {}
        if task_type == TaskType.QUIZ:
            kwargs["num_questions"] = 10

        system_str = prompt_set.system.substitute(**kwargs)
        if not system_str.endswith("\n\n"):
            system_str += "\n\n"
        footer_str = prompt_set.footer.substitute(**kwargs)

        # Safely fit chunks
        # TokenBudgetManager processes chunks in order. The retrieved chunks are already sorted by score (desc).
        # Thus, lowest scored chunks are dropped first.
        fitted_chunks = self.budget_manager.fit_chunks_to_budget(
            chunks=chunks,
            system_prompt=system_str,
            user_query=footer_str,
            max_context_tokens=max_tokens,
            history_tokens=history_tokens,
        )

        # Format context block
        context_parts = []
        for i, chunk in enumerate(fitted_chunks, 1):
            doc_str = prompt_set.document.substitute(doc_num=i, chunk_text=chunk.chunk_text)
            context_parts.append(doc_str)

        context_str = "\n\n".join(context_parts)

        # Assemble User message (without citations, because they are appended to the output via format_final)
        user_parts = []
        if context_str:
            user_parts.append(context_str)
        user_parts.append(footer_str)

        user_content = "\n\n".join(user_parts)

        return [
            ChatMessage(role=MessageRole.SYSTEM, content=system_str),
            ChatMessage(role=MessageRole.USER, content=user_content),
        ]

    def format_final(
        self,
        response_text: str,
        chunks: list[RetrievedDocument],
        task_type: TaskType,
        locale: Locale,
    ) -> str:
        """Appends the citations block to the bottom of the response text."""
        # Mini-RAG behaviour: Do not append citations for QUIZ or SUMMARY tasks typically,
        # but let's append based on task type.
        if task_type in (TaskType.QUIZ, TaskType.SUMMARY):
            return response_text

        citations = build_citations(chunks)
        sources_str = format_sources_block(citations, locale)

        if not sources_str:
            return response_text

        return f"{response_text}\n\n{sources_str}"
