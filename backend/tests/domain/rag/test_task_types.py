from app.domain.rag.task_types import Locale, TaskType, classify_task_type, detect_locale


def test_classify_task_type():
    # AR/EN keyword classification
    assert classify_task_type("please summarize this") == TaskType.SUMMARY
    assert classify_task_type("اكتب ملخص للمحاضرة") == TaskType.SUMMARY

    assert classify_task_type("give me a quiz") == TaskType.QUIZ
    assert classify_task_type("اسئلة امتحان") == TaskType.QUIZ

    assert classify_task_type("explain how this works") == TaskType.EXPLANATION
    assert classify_task_type("بالتفصيل") == TaskType.EXPLANATION

    # Simple QA
    assert classify_task_type("what is AI?") == TaskType.SIMPLE_QA

    # long-query heuristic
    long_query = (
        "this is a very long query that just goes on and on for more than twelve words total here."
    )
    assert len(long_query.split()) > 12
    assert classify_task_type(long_query) == TaskType.EXPLANATION


def test_detect_locale():
    assert detect_locale("what is this?") == Locale.EN
    assert detect_locale("ما هذا؟") == Locale.AR
    assert detect_locale("explain in arabic") == Locale.AR
