import time
from collections.abc import AsyncGenerator, Callable
from typing import Any

import cohere
from loguru import logger

from app.domain.chat.entities import ConversationHistory, LLMChunk, LLMResult
from app.domain.chat.ports import BaseLLMProvider


class CohereLLMProvider(BaseLLMProvider):
    """LLM Provider using Cohere Chat API."""

    def __init__(self, model: str, temperature: float, api_key: str):
        self.model = model
        self.temperature = temperature
        self._client = cohere.AsyncClientV2(api_key=api_key)

    async def stream(
        self,
        history: ConversationHistory,
        on_sentence: Callable[[str], None] | None = None,
        trace_id: str | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        """
        Streams tokens from Cohere's Chat API.
        """
        messages = self._format_history(history)
        
        try:
            stream = self._client.chat_stream(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )
            
            buffer = ""
            async for event in stream:
                if event.type == "content-delta":
                    text = event.delta.message.content.text
                    if text:
                        buffer += text
                        chunk = LLMChunk(token=text)
                        
                        # Basic sentence detection logic
                        if text and any(punct in text for punct in [". ", "? ", "! ", ".\\n", "?\\n", "!\\n"]):
                            chunk.sentence = buffer.strip()
                            if on_sentence:
                                on_sentence(chunk.sentence)
                            buffer = ""
                            
                        yield chunk
        except Exception as e:
            logger.error(f"Cohere stream failed: {e} | trace_id={trace_id}")
            raise

    async def complete(
        self,
        history: ConversationHistory,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResult:
        """Non-streaming completion."""
        messages = self._format_history(history)
        
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
        }
        
        if response_format and response_format.get("type") == "json_object":
            kwargs["response_format"] = {"type": "json_object"}
            
        try:
            t0 = time.monotonic()
            response = await self._client.chat(**kwargs)
            latency_ms = int((time.monotonic() - t0) * 1000)
            
            text = response.message.content[0].text
            
            total_tokens = 0
            if getattr(response, "usage", None) and getattr(response.usage, "tokens", None):
                total_tokens = (
                    getattr(response.usage.tokens, "input_tokens", 0) + 
                    getattr(response.usage.tokens, "output_tokens", 0)
                )
            
            return LLMResult(
                full_text=text,
                model=self.model,
                total_tokens=total_tokens,
                duration_ms=latency_ms,
            )
        except Exception as e:
            logger.error(f"Cohere complete failed: {e}")
            raise

    async def is_available(self) -> bool:
        """Health check for Cohere API."""
        try:
            await self._client.chat(
                model=self.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1
            )
            return True
        except Exception as e:
            logger.warning(f"Cohere health check failed: {e}")
            return False

    def _format_history(self, history: ConversationHistory) -> list[dict[str, Any]]:
        """Format domain history to Cohere V2 message format."""
        messages = []
        system_prompt = history.system_prompt or "You are a helpful assistant."
        messages.append({"role": "system", "content": system_prompt})
        for msg in history._messages:
            role = msg.role
            if role == "ai":
                role = "assistant"
            elif role not in ("user", "assistant", "system", "tool"):
                role = "user"
            
            messages.append({"role": role, "content": msg.content})
        return messages
