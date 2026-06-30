from app.domain.rag.task_types import Locale, TaskType
from app.application.prompts.rag.registry import get_prompt_set


def test_all_combinations_exist():
    # Assert every (TaskType × Locale) combination returns a PromptSet
    for task in TaskType:
        for locale in Locale:
            ps = get_prompt_set(task, locale)
            assert ps.system is not None
            assert ps.document is not None
            assert ps.footer is not None


def test_arabic_unicode():
    # Assert AR prompts contain at least one Arabic Unicode codepoint
    ps = get_prompt_set(TaskType.SIMPLE_QA, Locale.AR)
    template_str = ps.system.template
    has_arabic = any("\u0600" <= c <= "\u06ff" for c in template_str)
    assert has_arabic, "Arabic prompt does not contain Arabic characters"


def test_hybrid_knowledge_rule():
    # Assert EN prompts contain Hybrid-Knowledge-Rule trigger phrase
    ps = get_prompt_set(TaskType.SIMPLE_QA, Locale.EN)
    assert "CRITICAL RULE FOR HYBRID KNOWLEDGE:" in ps.system.template
