from collections.abc import Sequence
from typing import Any

import tiktoken
from loguru import logger

from app.domain.rag.entities import DocumentChunk, RetrievedDocument


def _chunk_text(chunk: Any) -> str:
    return getattr(chunk, "chunk_text", getattr(chunk, "text", ""))


def _chunk_source(chunk: Any) -> str:
    metadata = getattr(chunk, "metadata", None) or {}
    return metadata.get("filename") or metadata.get("source") or "Unknown"


class TokenBudgetManager:
    """Manages the LLM context window by accurately counting tokens and truncating retrieved chunks."""

    def __init__(self, model_encoding: str = "cl100k_base"):
        self.encoding: Any = None
        try:
            self.encoding = tiktoken.get_encoding(model_encoding)
        except Exception as e:
            logger.warning(
                f"[TokenBudgetManager] Failed to load {model_encoding}: {e}. Falling back to character heuristic."
            )

    def count_tokens(self, text: str) -> int:
        if self.encoding:
            return len(self.encoding.encode(text))
        return len(text) // 4  # Fallback heuristic

    def fit_chunks_to_budget(
        self,
        chunks: Sequence[DocumentChunk | RetrievedDocument],
        system_prompt: str,
        user_query: str,
        max_context_tokens: int,
        history_tokens: int = 0,
    ) -> list[DocumentChunk | RetrievedDocument]:
        """
        Calculates the available token budget and returns only the chunks that fit.
        """
        # Calculate base tokens
        system_tokens = self.count_tokens(system_prompt)
        query_tokens = self.count_tokens(user_query)
        base_tokens = system_tokens + query_tokens + history_tokens

        # Add some buffer for formatting and structural tokens
        buffer_tokens = 100
        available_budget = max_context_tokens - base_tokens - buffer_tokens

        if available_budget <= 0:
            logger.warning(
                f"[TokenBudgetManager] Zero or negative budget available! "
                f"max={max_context_tokens}, used={base_tokens}"
            )
            return []

        fitted_chunks = []
        current_used = 0

        for chunk in chunks:
            chunk_tokens = self.count_tokens(_chunk_text(chunk))

            # Additional tokens for formatting like "--- Source: X ---\n"
            source = _chunk_source(chunk)
            formatting_tokens = self.count_tokens(f"--- Document: {source} ---\n\n")
            total_chunk_cost = chunk_tokens + formatting_tokens

            if current_used + total_chunk_cost <= available_budget:
                fitted_chunks.append(chunk)
                current_used += total_chunk_cost
            else:
                # We stop adding chunks once we hit the limit
                break

        if len(fitted_chunks) < len(chunks):
            logger.warning(
                "[TokenBudget] Context truncated",
                extra={
                    "chunks_requested": len(chunks),
                    "chunks_fitted": len(fitted_chunks),
                    "chunks_dropped": len(chunks) - len(fitted_chunks),
                    "budget_used": current_used,
                    "budget_available": available_budget,
                },
            )

        logger.debug(
            f"[TokenBudgetManager] Budget check: max={max_context_tokens}, "
            f"base={base_tokens}, used_by_chunks={current_used}, "
            f"chunks_included={len(fitted_chunks)}/{len(chunks)}"
        )
        return fitted_chunks
