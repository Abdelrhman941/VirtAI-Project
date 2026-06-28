from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.rag.diagram_use_case import DiagramDomainException, DiagramUseCase
from app.application.rag.quiz_use_case import QuizDomainException, QuizUseCase, QuizAttemptModel
from app.application.rag.summary_use_case import SummaryUseCase
from app.application.rag.visualization_use_case import (
    VisualizationDomainException,
    VisualizationUseCase,
)
from app.domain.rag.task_types import Locale
from app.domain.user.entities import UserEntity
from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.infrastructure.visualization.napkin_client import NapkinClient
from app.presentation.http.v1.dependencies import _current_user
from app.shared.ids import parse_uuid

router = APIRouter()


@router.post("/summarize/{document_id}")
async def summarize_document(
    document_id: str,
    request: Request,
    locale: Locale = Locale.EN,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a map-reduce summary of a document."""
    doc_uuid = parse_uuid(document_id)
    if not doc_uuid:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    # In a real app we'd also check if the user owns the document

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = SummaryUseCase(llm=provider)

    async def event_generator():
        try:
            async for chunk in use_case.summarize_document(db, document_id, locale):
                yield chunk
        except Exception as e:
            yield f"Error: {e!s}"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/quiz/{document_id}")
async def generate_quiz(
    document_id: str,
    request: Request,
    num_questions: int = 5,
    locale: Locale = Locale.EN,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a quiz for a document."""
    doc_uuid = parse_uuid(document_id)
    if not doc_uuid:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    state_repo = DocumentRepository(db)
    status = await state_repo.get_status(document_id, str(user.id))
    if not status:
        raise HTTPException(status_code=403, detail="Forbidden or Document not found")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = QuizUseCase(llm=provider)
    try:
        quiz_id = await use_case.generate_quiz(db, document_id, str(user.id), num_questions, locale)
        return {"quiz_id": quiz_id}
    except QuizDomainException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/quiz/{quiz_id}")
async def get_quiz(
    quiz_id: str,
    request: Request,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a previously generated quiz."""
    q_uuid = parse_uuid(quiz_id)
    if not q_uuid:
        raise HTTPException(status_code=400, detail="Invalid quiz ID")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = QuizUseCase(llm=provider)
    try:
        quiz_data = await use_case.get_quiz(db, quiz_id, str(user.id))
        return quiz_data
    except QuizDomainException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/quiz/{quiz_id}/attempt")
async def submit_quiz_attempt(
    quiz_id: str,
    attempt: QuizAttemptModel,
    request: Request,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a quiz attempt and save telemetry data."""
    q_uuid = parse_uuid(quiz_id)
    if not q_uuid:
        raise HTTPException(status_code=400, detail="Invalid quiz ID")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = QuizUseCase(llm=provider)
    try:
        attempt_id = await use_case.submit_attempt(db, quiz_id, str(user.id), attempt)
        return {"attempt_id": attempt_id}
    except QuizDomainException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/quiz/{quiz_id}/analytics")
async def get_quiz_analytics(
    quiz_id: str,
    request: Request,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated analytics for a quiz."""
    q_uuid = parse_uuid(quiz_id)
    if not q_uuid:
        raise HTTPException(status_code=400, detail="Invalid quiz ID")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = QuizUseCase(llm=provider)
    try:
        analytics = await use_case.get_analytics(db, quiz_id, str(user.id))
        return analytics
    except QuizDomainException as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/quiz/attempt/{attempt_id}/insights")
async def get_quiz_insights(
    attempt_id: str,
    request: Request,
    locale: Locale = Locale.EN,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate LLM insights for a quiz attempt asynchronously."""
    a_uuid = parse_uuid(attempt_id)
    if not a_uuid:
        raise HTTPException(status_code=400, detail="Invalid attempt ID")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = QuizUseCase(llm=provider)
    try:
        insights = await use_case.get_insights(db, attempt_id, str(user.id), locale)
        return {"insights": insights}
    except QuizDomainException as e:
        raise HTTPException(status_code=404, detail=str(e))



@router.post("/diagram/{document_id}")
async def generate_diagram(
    document_id: str,
    request: Request,
    locale: Locale = Locale.EN,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a Mermaid diagram for a document."""
    doc_uuid = parse_uuid(document_id)
    if not doc_uuid:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    state_repo = DocumentRepository(db)
    status = await state_repo.get_status(document_id, str(user.id))
    if not status:
        raise HTTPException(status_code=403, detail="Forbidden or Document not found")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = DiagramUseCase(llm=provider)
    try:
        diagram_id = await use_case.generate_diagram(db, document_id, str(user.id), locale)
        return {"diagram_id": diagram_id}
    except DiagramDomainException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/diagram/{diagram_id}")
async def get_diagram(
    diagram_id: str,
    request: Request,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a previously generated diagram."""
    diag_uuid = parse_uuid(diagram_id)
    if not diag_uuid:
        raise HTTPException(status_code=400, detail="Invalid diagram ID")

    provider = request.app.state.model_policy.router.get_llm_chain()
    use_case = DiagramUseCase(llm=provider)
    try:
        diagram_data = await use_case.get_diagram(db, diagram_id, str(user.id))
        return diagram_data
    except DiagramDomainException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/visualization/{message_id}")
async def get_visualization(
    message_id: UUID,
    force: bool = False,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request Napkin.ai visualization for a specific message."""
    msg_uuid = message_id

    provider = NapkinClient()
    use_case = VisualizationUseCase(provider=provider)
    try:
        viz_data = await use_case.get_visualization(db, str(message_id), str(user.id), force)
        return viz_data
    except VisualizationDomainException as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.get("/visualization/{message_id}/image")
async def get_visualization_image(
    message_id: UUID,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Serve the generated image securely by proxying the Napkin URL."""
    from app.infrastructure.db.models import VisualizationCache
    from sqlalchemy import select
    import httpx
    import os
    from fastapi.responses import Response

    existing_query = await db.execute(
        select(VisualizationCache).where(VisualizationCache.message_id == message_id)
    )
    cached = existing_query.scalar_one_or_none()

    if not cached or not cached.image_url:
        raise HTTPException(status_code=404, detail="Image not found")

    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {os.getenv('NAPKIN_API_KEY')}"}
        try:
            res = await client.get(cached.image_url, headers=headers, timeout=15.0)
            res.raise_for_status()
            return Response(content=res.content, media_type="image/png")
        except Exception as e:
            raise HTTPException(status_code=500, detail="Failed to fetch image from provider")
