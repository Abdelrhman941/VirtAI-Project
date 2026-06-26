from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.rag.diagram_use_case import DiagramDomainException, DiagramUseCase
from app.application.rag.quiz_use_case import QuizDomainException, QuizUseCase
from app.application.rag.summary_use_case import SummaryUseCase
from app.application.rag.visualization_use_case import (
    VisualizationDomainException,
    VisualizationUseCase,
)
from app.domain.rag.task_types import Locale
from app.domain.user.entities import UserEntity
from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.ingestion_state_repository import IngestionStateRepository
from app.infrastructure.external.napkin_client import NapkinClient
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

    state_repo = IngestionStateRepository(db)
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

    state_repo = IngestionStateRepository(db)
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


@router.get("/visualization/{message_id}")
async def get_visualization(
    message_id: str,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request Napkin.ai visualization for a specific message."""
    msg_uuid = parse_uuid(message_id)
    if not msg_uuid:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    provider = NapkinClient()
    use_case = VisualizationUseCase(provider=provider)
    try:
        viz_data = await use_case.get_visualization(db, message_id, str(user.id))
        return viz_data
    except VisualizationDomainException as e:
        raise HTTPException(status_code=403, detail=str(e))
