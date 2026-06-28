import uuid

import pytest
from sqlalchemy import select


@pytest.mark.asyncio
async def test_summary_cache_insertion(mock_db_session):
    """
    Verify actual DB insertions into the SummaryCache table.
    """
    from app.infrastructure.db.models import SummaryCache

    doc_id = uuid.uuid4()

    # Insert a dummy summary cache entry
    new_entry = SummaryCache(document_id=doc_id, summary_text="This is a dummy summary.")
    mock_db_session.add(new_entry)
    await mock_db_session.commit()

    # Retrieve it
    result = await mock_db_session.execute(
        select(SummaryCache).where(SummaryCache.document_id == doc_id)
    )
    entry = result.scalar_one_or_none()

    assert entry is not None
    assert entry.summary_text == "This is a dummy summary."


@pytest.mark.asyncio
async def test_quiz_attempt_insertion(mock_db_session):
    """
    Verify actual DB insertions into QuizAttempts table.
    """
    from app.infrastructure.db.models import QuizAttempt

    doc_id = uuid.uuid4()

    new_entry = QuizAttempt(
        user_id=uuid.uuid4(), quiz_id=doc_id, score=80
    )
    mock_db_session.add(new_entry)
    await mock_db_session.commit()

    result = await mock_db_session.execute(select(QuizAttempt).where(QuizAttempt.quiz_id == doc_id))
    entry = result.scalar_one_or_none()

    assert entry is not None
    assert entry.score == 80


@pytest.mark.asyncio
async def test_diagram_cache_insertion(mock_db_session):
    """
    Verify actual DB insertions into DiagramCache table.
    """
    from app.infrastructure.db.models import DiagramCache

    doc_id = uuid.uuid4()
    mermaid_code = "graph TD\n A-->B"

    new_entry = DiagramCache(document_id=doc_id, mermaid_code=mermaid_code)
    mock_db_session.add(new_entry)
    await mock_db_session.commit()

    result = await mock_db_session.execute(
        select(DiagramCache).where(DiagramCache.document_id == doc_id)
    )
    entry = result.scalar_one_or_none()

    assert entry is not None
    assert entry.mermaid_code == mermaid_code
