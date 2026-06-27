from dataclasses import dataclass
from enum import Enum, auto
from string import Template

from app.domain.rag.task_types import Locale, TaskType
from app.application.prompts.rag import ar, en


class PromptKey(Enum):
    SIMPLE_QA = auto()
    EXPLANATION = auto()
    QUIZ = auto()
    SUMMARY = auto()
    SUMMARY_BATCH = auto()
    DIAGRAM = auto()
    TITLE_GENERATION = auto()
    SYSTEM_WARNING_LOW_CONFIDENCE = auto()
    INJECT_CONTEXT_SYSTEM = auto()
    INJECT_CONTEXT_USER = auto()
    WALKTHROUGH = auto()


@dataclass(frozen=True)
class PromptSet:
    system: Template
    document: Template
    footer: Template


class PromptNotFoundError(Exception):
    """Critical exception raised when a prompt key is missing. No silent fallbacks."""
    pass


class PromptRegistry:
    """
    Registry for managing prompt sets securely across locales.
    
    WARNING regarding 'Fail Loudly' (.substitute instead of .safe_substitute):
    Because Python's `string.Template.substitute()` strictly enforces all variables,
    it treats ANY unescaped `$` as a variable.
    If you need to use a literal dollar sign in a prompt (e.g., for currency, regex, 
    or LaTeX math like `$x$`), YOU MUST ESCAPE IT AS `$$` (e.g. `$$x$$`).
    Failure to do so will cause the system to crash immediately with a KeyError or ValueError.
    """
    def __init__(self):
        self._table: dict[tuple[PromptKey, Locale], PromptSet | Template] = {}
        self._build_table()

    def _build_table(self) -> None:
        for locale, module in [(Locale.EN, en), (Locale.AR, ar)]:
            doc = module.document_prompt

            self._table[(PromptKey.SIMPLE_QA, locale)] = PromptSet(
                system=module.system_prompt,
                document=doc,
                footer=module.footer_prompt,
            )

            self._table[(PromptKey.EXPLANATION, locale)] = PromptSet(
                system=module.system_prompt,
                document=doc,
                footer=module.footer_prompt,
            )

            self._table[(PromptKey.WALKTHROUGH, locale)] = PromptSet(
                system=module.walkthrough_system_prompt,
                document=doc,
                footer=module.walkthrough_footer_prompt,
            )

            self._table[(PromptKey.QUIZ, locale)] = PromptSet(
                system=module.quiz_system_prompt,
                document=doc,
                footer=module.quiz_footer_prompt,
            )

            self._table[(PromptKey.SUMMARY, locale)] = PromptSet(
                system=module.summarize_system_prompt,
                document=doc,
                footer=module.summarize_footer_prompt,
            )

            self._table[(PromptKey.SUMMARY_BATCH, locale)] = PromptSet(
                system=module.summary_batch_system_prompt,
                document=doc,
                footer=module.summary_batch_footer_prompt,
            )

            self._table[(PromptKey.DIAGRAM, locale)] = PromptSet(
                system=module.diagram_system_prompt,
                document=doc,
                footer=module.diagram_footer_prompt,
            )

            # Single template utilities
            self._table[(PromptKey.TITLE_GENERATION, locale)] = getattr(module, "title_generation_prompt", Template(""))
            self._table[(PromptKey.SYSTEM_WARNING_LOW_CONFIDENCE, locale)] = getattr(module, "system_warning_low_confidence_prompt", Template(""))
            self._table[(PromptKey.INJECT_CONTEXT_SYSTEM, locale)] = getattr(module, "inject_context_system_prompt", Template(""))
            self._table[(PromptKey.INJECT_CONTEXT_USER, locale)] = getattr(module, "inject_context_user_prompt", Template(""))

    def get_prompt_set(self, key: PromptKey, locale: Locale) -> PromptSet:
        """Returns the correct PromptSet for the given task and locale."""
        if (key, locale) not in self._table:
            raise PromptNotFoundError(f"CRITICAL: PromptSet for {key.name} in {locale.name} not found in registry.")
        
        prompt = self._table[(key, locale)]
        if not isinstance(prompt, PromptSet):
            raise PromptNotFoundError(f"CRITICAL: Requested PromptSet for {key.name} but got single Template.")
            
        return prompt

    def get_template(self, key: PromptKey, locale: Locale) -> Template:
        """Returns the single Template for utility prompts."""
        if (key, locale) not in self._table:
            raise PromptNotFoundError(f"CRITICAL: Template for {key.name} in {locale.name} not found in registry.")
            
        prompt = self._table[(key, locale)]
        if not isinstance(prompt, Template):
            raise PromptNotFoundError(f"CRITICAL: Requested single Template for {key.name} but got PromptSet.")
            
        if not prompt.template:
             raise PromptNotFoundError(f"CRITICAL: Template for {key.name} in {locale.name} is empty.")
             
        return prompt

registry = PromptRegistry()

def get_prompt_set(task: TaskType, locale: Locale) -> PromptSet:
    """Legacy mapper from TaskType to PromptKey"""
    mapping = {
        TaskType.SIMPLE_QA: PromptKey.SIMPLE_QA,
        TaskType.EXPLANATION: PromptKey.EXPLANATION,
        TaskType.QUIZ: PromptKey.QUIZ,
        TaskType.SUMMARY: PromptKey.SUMMARY,
        TaskType.SUMMARY_BATCH: PromptKey.SUMMARY_BATCH,
        TaskType.DIAGRAM: PromptKey.DIAGRAM,
    }
    if task not in mapping:
        raise PromptNotFoundError(f"CRITICAL: TaskType {task.name} has no mapping to PromptKey.")
    return registry.get_prompt_set(mapping[task], locale)

def get_utility_template(key: PromptKey, locale: Locale = Locale.EN) -> Template:
    return registry.get_template(key, locale)
