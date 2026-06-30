from dataclasses import dataclass
from enum import Enum


class TaskType(str, Enum):
    SIMPLE_QA = "simple_qa"
    EXPLANATION = "explanation"
    SUMMARY = "summary"
    QUIZ = "quiz"
    SUMMARY_BATCH = "summary_batch"
    DIAGRAM = "diagram"


class Locale(str, Enum):
    EN = "en"
    AR = "ar"


@dataclass(frozen=True)
class RetrievalSizing:
    fetch_limit: int
    top_n: int
    score_threshold: float


TASK_RETRIEVAL_SIZES: dict[TaskType, RetrievalSizing] = {
    TaskType.SIMPLE_QA: RetrievalSizing(fetch_limit=15, top_n=5, score_threshold=0.30),
    TaskType.EXPLANATION: RetrievalSizing(fetch_limit=30, top_n=12, score_threshold=0.30),
    TaskType.QUIZ: RetrievalSizing(fetch_limit=60, top_n=20, score_threshold=0.05),
    TaskType.SUMMARY: RetrievalSizing(fetch_limit=60, top_n=20, score_threshold=0.05),
    TaskType.DIAGRAM: RetrievalSizing(fetch_limit=60, top_n=20, score_threshold=0.05),
}

TASK_MAX_TOKENS: dict[TaskType, int] = {
    TaskType.SIMPLE_QA: 16000,
    TaskType.EXPLANATION: 24000,
    TaskType.QUIZ: 20000,
    TaskType.SUMMARY: 32000,
    TaskType.DIAGRAM: 32000,
}

_SUMMARY_KEYWORDS = {
    "summarize",
    "summarise",
    "summary",
    "overview of the lecture",
    "ملخص",
    "تلخيص",
    "لخص",
    "اعمل ملخص",
    "اكتب ملخص",
}

_QUIZ_KEYWORDS = {
    "quiz",
    "mcq",
    "multiple choice",
    "exam questions",
    "practice questions",
    "امتحان",
    "اختبار",
    "أسئلة اختيار",
    "اسئلة امتحان",
}

_EXPLANATION_KEYWORDS = {
    "explain",
    "describe",
    "how does",
    "how do",
    "how is",
    "why does",
    "why is",
    "compare",
    "difference between",
    "walk me through",
    "derive",
    "derivation",
    "in detail",
    "step by step",
    "step-by-step",
    "what is the intuition",
    "اشرح",
    "فسر",
    "وضح",
    "اشرحلي",
    "ما الفرق",
    "قارن",
    "بالتفصيل",
    "خطوة بخطوة",
}

_DIAGRAM_KEYWORDS = {
    "diagram",
    "visualize",
    "flowchart",
    "draw",
    "architecture",
    "رسم",
    "مخطط",
    "شكل",
    "ارسم",
    "تصور",
}

_LONG_QUERY_WORD_THRESHOLD = 12


def classify_task_type(query: str, route_hint: str | None = None) -> TaskType:
    query_lower = (query or "").lower()
    route_lower = (route_hint or "").lower()

    if route_lower == TaskType.SUMMARY.value or any(kw in query_lower for kw in _SUMMARY_KEYWORDS):
        return TaskType.SUMMARY

    if route_lower == TaskType.QUIZ.value or any(kw in query_lower for kw in _QUIZ_KEYWORDS):
        return TaskType.QUIZ
        
    if route_lower == TaskType.DIAGRAM.value or any(kw in query_lower for kw in _DIAGRAM_KEYWORDS):
        return TaskType.DIAGRAM

    if (
        route_lower == "reasoning"
        or route_lower == TaskType.EXPLANATION.value
        or any(kw in query_lower for kw in _EXPLANATION_KEYWORDS)
    ):
        return TaskType.EXPLANATION

    if len(query_lower.split()) > _LONG_QUERY_WORD_THRESHOLD:
        return TaskType.EXPLANATION

    return TaskType.SIMPLE_QA


def detect_locale(text: str) -> Locale:
    """Detects locale by checking for Arabic Unicode blocks or keywords."""
    text_lower = (text or "").lower()
    is_arabic = (
        any("\u0600" <= c <= "\u06FF" for c in text)
        or "arabic" in text_lower
        or "عربي" in text_lower
    )
    return Locale.AR if is_arabic else Locale.EN
