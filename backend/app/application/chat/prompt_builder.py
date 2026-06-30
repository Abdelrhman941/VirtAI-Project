from app.domain.rag.task_types import Locale

class PromptBuilder:
    """
    Dedicated builder for assembling LLM prompts.
    Centralizes prompt injection logic to keep UseCases and Stages clean.
    """


    @staticmethod
    def build_system_prompt_with_context(original_system_prompt: str, context: str | None, locale: Locale) -> str:
        if not context:
            return original_system_prompt
        from app.application.prompts.rag.registry import get_utility_template, PromptKey
        template = get_utility_template(PromptKey.INJECT_CONTEXT_SYSTEM, locale)
        return template.substitute(original_system_prompt=original_system_prompt, context=context)

    @staticmethod
    def build_user_prompt_with_context(query: str, context: str | None, locale: Locale) -> str:
        if not context:
            return query
        from app.application.prompts.rag.registry import get_utility_template, PromptKey
        template = get_utility_template(PromptKey.INJECT_CONTEXT_USER, locale)
        return template.substitute(context=context, query=query)
