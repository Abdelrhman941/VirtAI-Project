"""
OpenAI-compatible text generation + embedding provider.

Serves the agentic RAG pipeline (answer, summarize, quiz).
Uses the OpenAI SDK for both generation and embedding.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any, Union

from loguru import logger
from openai import AsyncOpenAI

from app.domain.chat.ports import BaseLLMProvider
from app.infrastructure.llm.enums import OpenAIRole


class OpenAIGenerationProvider(BaseLLMProvider):
    """
    OpenAI-compatible provider for the agentic RAG pipeline.

    Supports any OpenAI-compatible API (OpenAI, Azure, local vLLM, etc.)
    via the ``api_url`` parameter.
    """

    def __init__(
        self,
        api_key: str,
        api_url: str | None = None,
        default_input_max_characters: int = 1000,
        default_generation_max_output_tokens: int = 1000,
        default_generation_temperature: float = 0.1,
    ):
        self.api_key = api_key
        self.api_url = api_url
        self.default_input_max_characters = default_input_max_characters
        self.default_generation_max_output_tokens = default_generation_max_output_tokens
        self.default_generation_temperature = default_generation_temperature

        self.generation_model_id: str | None = None
        self.embedding_model_id: str | None = None
        self.embedding_size: int | None = None

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.api_url if self.api_url else None,
        )
        self.enums = OpenAIRole

    # ── Configuration ────────────────────────────────────────────────────

    def set_generation_model(self, model_id: str) -> None:
        self.generation_model_id = model_id

    def set_embedding_model(self, model_id: str, embedding_size: int) -> None:
        self.embedding_model_id = model_id
        self.embedding_size = embedding_size

    # ── Text processing ──────────────────────────────────────────────────

    def process_text(self, text: str) -> str:
        return text[: self.default_input_max_characters].strip()

    # ── Generation ───────────────────────────────────────────────────────

    async def generate_text(
        self,
        prompt: str,
        chat_history: list | None = None,
        max_output_tokens: int | None = None,
        temperature: float | None = None,
        **kwargs: Any,
    ) -> str | None:
        if not self.client or not self.generation_model_id:
            logger.error("OpenAI client or generation model not configured")
            return None

        # Defensive copy to avoid mutation bugs
        chat_history = list(chat_history) if chat_history else []
        max_output_tokens = max_output_tokens or self.default_generation_max_output_tokens
        temperature = temperature or self.default_generation_temperature

        chat_history.append(self.construct_prompt(prompt=prompt, role=OpenAIRole.USER.value))

        response = await self.client.chat.completions.create(
            model=self.generation_model_id,
            messages=chat_history,
            max_tokens=max_output_tokens,
            temperature=temperature,
        )

        if (
            not response
            or not response.choices
            or len(response.choices) == 0
            or not response.choices[0].message
        ):
            logger.error("Empty response from OpenAI generation")
            return None

        return response.choices[0].message.content

    async def generate_stream(
        self,
        prompt: str,
        chat_history: list | None = None,
        max_output_tokens: int | None = None,
        temperature: float | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """Yields text chunks from a streaming completion."""
        if not self.client or not self.generation_model_id:
            yield "Error: OpenAI client or model not configured."
            return

        chat_history = list(chat_history) if chat_history else []
        max_output_tokens = max_output_tokens or self.default_generation_max_output_tokens
        temperature = temperature or self.default_generation_temperature

        chat_history.append(self.construct_prompt(prompt=prompt, role=OpenAIRole.USER.value))

        try:
            response = await self.client.chat.completions.create(
                model=self.generation_model_id,
                messages=chat_history,
                max_tokens=max_output_tokens,
                temperature=temperature,
                stream=True,
            )
            async for chunk in response:
                delta = chunk.choices[0].delta if chunk.choices else None
                content = getattr(delta, "content", None) if delta else None
                if content:
                    yield content
        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            yield f"Error: {e}"

    # ── Embedding ────────────────────────────────────────────────────────

    async def embed_text(
        self, text: Union[str, list[str]], document_type: str | None = None
    ) -> list[list[float]] | None:
        if not self.client or not self.embedding_model_id:
            logger.error("OpenAI embedding model not configured")
            return None

        if isinstance(text, str):
            text = [text]

        response = await self.client.embeddings.create(
            model=self.embedding_model_id,
            input=text,
        )

        if not response or not response.data:
            logger.error("Empty response from OpenAI embedding")
            return None

        return [rec.embedding for rec in response.data]

    # ── Prompt construction ──────────────────────────────────────────────

    def construct_prompt(self, prompt: str, role: str) -> dict:
        return {"role": role, "content": prompt}
