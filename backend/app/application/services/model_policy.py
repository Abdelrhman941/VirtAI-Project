"""
Model Policy Service: Registry, Policy Router, and Fallback Chains.
"""

from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

from app.domain.chat.entities import ConversationHistory, LLMChunk, LLMResult
from app.domain.chat.ports import BaseLLMProvider
from app.domain.voice.entities import TTSChunk, TTSResult
from app.domain.voice.ports import BaseTTSProvider


class FallbackLLMChain(BaseLLMProvider):
    """Wraps multiple LLM providers, falling back if the primary fails."""

    def __init__(self, primary: BaseLLMProvider, fallbacks: list[BaseLLMProvider]):
        self.primary = primary
        self.fallbacks = fallbacks

    async def stream(
        self,
        history: ConversationHistory,
        on_sentence: Callable[[str], None] | None = None,
        trace_id: str | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        providers = [self.primary, *self.fallbacks]
        for idx, provider in enumerate(providers):
            try:
                # Try to stream from this provider
                async for chunk in provider.stream(history, on_sentence, trace_id):
                    yield chunk
                # If we successfully yield chunks and finish without raising an exception, we are done
                return
            except Exception as e:
                provider_name = provider.__class__.__name__
                if idx < len(providers) - 1:
                    logger.warning(
                        f"LLM Provider {provider_name} failed stream(). Falling back. "
                        f"Error: {e} | trace_id={trace_id}"
                    )
                else:
                    logger.error(
                        f"All LLM providers failed stream(). Last error from {provider_name}: {e} | trace_id={trace_id}"
                    )
                    raise e

    async def complete(
        self,
        history: ConversationHistory,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResult:
        providers = [self.primary, *self.fallbacks]
        for idx, provider in enumerate(providers):
            try:
                return await provider.complete(history, response_format)
            except Exception as e:
                provider_name = provider.__class__.__name__
                if idx < len(providers) - 1:
                    logger.warning(
                        f"LLM Provider {provider_name} failed complete(). Falling back. Error: {e}"
                    )
                else:
                    logger.error(f"All LLM providers failed complete(). Last error: {e}")
                    raise e
        raise RuntimeError("No LLM providers available")

    async def is_available(self) -> bool:
        # Check if any of the providers in the chain are available
        providers = [self.primary, *self.fallbacks]
        for provider in providers:
            if await provider.is_available():
                return True
        return False


class FallbackTTSChain(BaseTTSProvider):
    """Wraps multiple TTS providers, falling back if the primary fails."""

    def __init__(self, primary: BaseTTSProvider, fallbacks: list[BaseTTSProvider]):
        self.primary = primary
        self.fallbacks = fallbacks

    @property
    def voice(self) -> str | None:
        return getattr(self.primary, "voice", None)

    @voice.setter
    def voice(self, value: str | None) -> None:
        for provider in [self.primary, *self.fallbacks]:
            if hasattr(provider, "voice"):
                provider.voice = value

    @property
    def api_voice(self) -> str | None:
        return getattr(self.primary, "api_voice", None)

    async def synthesize(self, text: str) -> TTSResult:
        providers = [self.primary, *self.fallbacks]
        for idx, provider in enumerate(providers):
            try:
                return await provider.synthesize(text)
            except Exception as e:
                provider_name = provider.__class__.__name__
                if idx < len(providers) - 1:
                    logger.warning(
                        f"TTS Provider {provider_name} failed synthesize(). Falling back. Error: {e}"
                    )
                else:
                    logger.error(f"All TTS providers failed synthesize(). Last error: {e}")
                    raise e
        raise RuntimeError("No TTS providers available")

    async def synthesize_streaming(self, text: str, voice: str | None = None) -> AsyncGenerator[TTSChunk, None]:
        providers = [self.primary, *self.fallbacks]
        for idx, provider in enumerate(providers):
            try:
                # Some TTS providers might not accept 'voice' in their signature, but OpenAITTSProvider does.
                kwargs = {}
                if voice:
                    kwargs["voice"] = voice
                async for chunk in provider.synthesize_streaming(text, **kwargs):
                    yield chunk
                return
            except Exception as e:
                provider_name = provider.__class__.__name__
                if idx < len(providers) - 1:
                    logger.warning(
                        f"TTS Provider {provider_name} failed streaming. Falling back. Error: {e}"
                    )
                else:
                    logger.error(f"All TTS providers failed streaming. Last error: {e}")
                    raise e

    async def generate(
        self,
        text: str,
        session_id: str,
        message_id: str,
        trace_id: str | None = None,
        voice: str | None = None,
    ) -> TTSResult:
        providers = [self.primary, *self.fallbacks]
        for idx, provider in enumerate(providers):
            try:
                return await provider.generate(text, session_id, message_id, trace_id, voice=voice)
            except Exception as e:
                provider_name = provider.__class__.__name__
                if idx < len(providers) - 1:
                    logger.warning(
                        f"TTS Provider {provider_name} failed generate(). Falling back. Error: {e} | trace_id={trace_id}"
                    )
                else:
                    logger.error(
                        f"All TTS providers failed generate(). Last error: {e} | trace_id={trace_id}"
                    )
                    raise e
        raise RuntimeError("No TTS providers available")

    async def get_available_voices(self) -> list[dict[str, str]]:
        return await self.primary.get_available_voices()

    async def get_voice_settings(self, voice_name: str) -> dict[str, Any]:
        return await self.primary.get_voice_settings(voice_name)

    def generate_cache_key(self, text: str, voice: str | None = None) -> str:
        return self.primary.generate_cache_key(text, voice=voice)


@dataclass
class ModelCapabilities:
    streaming_supported: bool = True
    languages: list[str] = field(default_factory=lambda: ["en"])
    latency_tier: str = "fast"  # "fast", "balanced", "high_quality"
    max_context: int = 4096


class ModelRegistry:
    """Central registry holding instantiated Model Providers and their capabilities."""

    def __init__(self):
        self.llm_providers: dict[str, tuple[BaseLLMProvider, ModelCapabilities]] = {}
        self.tts_providers: dict[str, tuple[BaseTTSProvider, ModelCapabilities]] = {}

    def register_llm(
        self, name: str, provider: BaseLLMProvider, caps: ModelCapabilities | None = None
    ):
        self.llm_providers[name] = (provider, caps or ModelCapabilities())

    def register_tts(
        self, name: str, provider: BaseTTSProvider, caps: ModelCapabilities | None = None
    ):
        self.tts_providers[name] = (provider, caps or ModelCapabilities())

    def get_llm(self, name: str) -> BaseLLMProvider | None:
        return self.llm_providers[name][0] if name in self.llm_providers else None

    def get_tts(self, name: str) -> BaseTTSProvider | None:
        return self.tts_providers[name][0] if name in self.tts_providers else None

    def find_llms_by_capability(self, **kwargs) -> list[BaseLLMProvider]:
        results = []
        for name, (provider, caps) in self.llm_providers.items():
            match = True
            for k, v in kwargs.items():
                if getattr(caps, k, None) != v:
                    match = False
                    break
            if match:
                results.append(provider)
        return results


class PolicyRouter:
    """Routes capability requests (e.g. 'fastest') to the right fallback chain."""

    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    def get_llm_chain(self, policy: str = "default") -> FallbackLLMChain:
        if policy == "fastest":
            candidates = self.registry.find_llms_by_capability(latency_tier="fast")
            if candidates:
                return FallbackLLMChain(candidates[0], fallbacks=candidates[1:])

        # Default policy: Cohere as primary (will be registered in BATCH 2).
        primary = self.registry.get_llm("cohere_llm")
        if not primary:
            logger.warning("Primary LLM provider 'cohere_llm' not registered yet. Returning None.")
            # Returning None temporarily to avoid crash before BATCH 2
            return None
        return FallbackLLMChain(primary, fallbacks=[])

    def get_tts_chain(self, policy: str = "default") -> FallbackTTSChain:
        # Default policy: Currently we only have OpenAI TTS, use it as primary.
        primary = self.registry.get_tts("openai_tts")
        if not primary:
            raise RuntimeError("Primary TTS provider 'openai_tts' not registered.")
        return FallbackTTSChain(primary, fallbacks=[])


class ModelPolicyService:
    """Facade for the Model Registry and Policy Router."""

    def __init__(self):
        self.registry = ModelRegistry()
        self.router = PolicyRouter(self.registry)
