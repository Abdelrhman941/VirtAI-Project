from app.application.rag.response_formatter import ResponseFormatterService
from app.application.rag.token_budget import TokenBudgetManager
from app.domain.chat.entities import MessageRole
from app.domain.rag.entities import RetrievedDocument
from app.domain.rag.task_types import Locale, TaskType


def test_format_prompt_truncation():
    budget_manager = TokenBudgetManager()
    formatter = ResponseFormatterService(budget_manager=budget_manager)

    # Create lots of long chunks. High score first.
    chunks = [
        RetrievedDocument(
            text="This is a very long text chunk. " * 100,
            score=0.9 - i * 0.01,
            metadata={"source": f"doc{i}.txt"},
        )
        for i in range(50)
    ]

    # Run formatter for QUIZ (max 2500 tokens)
    messages = formatter.format_prompt("give me a quiz", chunks, TaskType.QUIZ, Locale.EN)

    assert len(messages) == 2
    assert messages[0].role == MessageRole.SYSTEM
    assert messages[1].role == MessageRole.USER

    # Check that tokens are constrained by TaskType.QUIZ budget (20000)
    sys_tokens = budget_manager.count_tokens(messages[0].content)
    usr_tokens = budget_manager.count_tokens(messages[1].content)

    assert (sys_tokens + usr_tokens) <= 20000


def test_format_final_citations():
    budget_manager = TokenBudgetManager()
    formatter = ResponseFormatterService(budget_manager=budget_manager)

    chunks = [RetrievedDocument(text="short text", score=0.9, metadata={"source": "book.pdf"})]

    # For EXPLANATION, sources block is appended
    final_text = formatter.format_final(
        "This is the LLM output.", chunks, TaskType.EXPLANATION, Locale.AR
    )

    assert "المصادر" in final_text
    assert "book.pdf" in final_text
    assert "This is the LLM output." in final_text
