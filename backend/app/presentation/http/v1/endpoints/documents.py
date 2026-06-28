import asyncio
import hashlib
import re
from typing import Any

import filetype  # type: ignore[import-not-found]
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.stage_machine import IngestionStage
from app.domain.user.entities import UserEntity
from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.chat_repository import ChatRepository
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.presentation.http.v1.dependencies import StorageDep, _current_user
from app.shared.config import get_settings
from app.shared.ids import parse_uuid

router = APIRouter()
settings = get_settings()


async def _verify_session_ownership(
    request: Request,
    session_id_query: str | None = Query(None, alias="session_id"),
    session_id_form: str | None = Form(None, alias="session_id"),
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> str | None:
    session_id = session_id_query or session_id_form

    if session_id:
        from app.presentation.http.v1.dependencies import get_storage

        storage = get_storage(request)
        session_repo = ChatRepository(db, storage_provider=storage)
        session_obj = await session_repo.get_chat_session(str(session_id))
        if not session_obj or str(session_obj["user_id"]) != str(user.id):
            raise HTTPException(status_code=403, detail="Forbidden")
    return str(session_id) if session_id else None


def sanitize_filename(filename: str | None) -> str:
    """Strip path traversal sequences and special characters."""
    filename = filename or "unnamed_file"
    if not filename:
        return "unnamed_document"
    # Replace anything that isn't alphanumeric, dot, dash, or underscore
    safe = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", filename)
    # Strip any leading dots to prevent hidden files/traversal
    safe = safe.lstrip(".")
    return safe or "unnamed_document"


ALLOWED_MIME_TYPES = {
    "pdf": {"application/pdf", "application/x-pdf", "application/octet-stream"},
    "txt": {"text/plain", "application/octet-stream"},
    "md": {"text/markdown", "text/plain", "application/octet-stream"},
    "png": {"image/png"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "webp": {"image/webp"},
}


def validate_declared_mime(content_type: str | None, declared_ext: str) -> None:
    if not content_type:
        return
    normalized = content_type.split(";", 1)[0].strip().lower()
    allowed = ALLOWED_MIME_TYPES.get(declared_ext, set())
    if normalized and normalized not in allowed:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file content type. Upload a PDF, TXT, MD, or image file.",
        )


async def validate_file_magic(file: UploadFile, declared_ext: str) -> None:
    await file.seek(0)
    magic_chunk = await file.read(2048)
    kind = filetype.guess(magic_chunk)
    if declared_ext == "pdf":
        if kind is None or kind.extension != "pdf":
            raise HTTPException(
                status_code=400, detail="File content does not match declared type 'pdf'"
            )
    elif declared_ext in ("png", "jpg", "jpeg", "webp"):
        if kind is None or not kind.mime.startswith("image/"):
            raise HTTPException(
                status_code=400, detail="File content does not match declared image type"
            )
    elif declared_ext in ("txt", "md"):
        if kind is not None:
            raise HTTPException(
                status_code=400, detail=f"File appears to be {kind.mime}, not text/markdown"
            )
        import codecs

        decoder = codecs.getincrementaldecoder("utf-8")()
        await file.seek(0)
        try:
            while True:
                chunk = await file.read(65536)
                if not chunk:
                    decoder.decode(b"", True)
                    break
                decoder.decode(chunk)
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File is not valid UTF-8") from None


@router.post("/upload", status_code=202)
async def upload_document(
    request: Request,
    storage: StorageDep,
    response: Response,
    file: UploadFile = File(...),
    session_id: str | None = Depends(_verify_session_ownership),
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Upload a document and trigger the RAG ingestion pipeline asynchronously."""
    # 1. Validate file type & size early
    safe_filename = sanitize_filename(file.filename)
    ext = safe_filename.split(".")[-1].lower() if "." in safe_filename else ""
    if ext not in ["pdf", "txt", "md", "png", "jpg", "jpeg", "webp"]:
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Must be pdf, txt, md, or an image."
        )

    max_upload_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file.size and file.size > max_upload_bytes:
        raise HTTPException(
            status_code=413, detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB}MB"
        )
    validate_declared_mime(file.content_type, ext)

    state_repo = DocumentRepository(db)

    # 2. Check per-user active job count
    active_jobs = await state_repo.count_active_jobs(str(user.id))
    if active_jobs >= settings.MAX_ACTIVE_JOBS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail="Too many active ingestion jobs. Please wait for them to finish.",
        )

    # 3. Validate file size and compute sha256 in chunks to prevent memory exhaustion
    import anyio

    file_sha256_hash = hashlib.sha256()
    file_size = 0
    await file.seek(0)
    try:
        while True:
            chunk = await file.read(65536)  # 64KB chunks
            if not chunk:
                break
            await anyio.to_thread.run_sync(file_sha256_hash.update, chunk)
            file_size += len(chunk)
            if file_size > max_upload_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB}MB",
                )
    except asyncio.CancelledError:
        logger.warning("Client disconnected during file upload")
        raise

    if file_size == 0:
        raise HTTPException(status_code=400, detail="File is empty")

    await validate_file_magic(file, ext)

    # 4. Compute sha256
    file_sha256 = file_sha256_hash.hexdigest()

    # 5. Execute StartIngestionUseCase
    async def file_streamer():
        await file.seek(0)
        while chunk := await file.read(65536):
            yield chunk

    from app.application.rag.start_ingestion_use_case import StartIngestionUseCase

    use_case = StartIngestionUseCase(db, storage, request.app.state.arq_pool)

    try:
        result = await use_case.execute(
            user_id=str(user.id),
            session_id=session_id,
            file_sha256=file_sha256,
            file_size=file_size,
            safe_filename=safe_filename,
            ext=ext,
            file_stream=file_streamer(),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    response.status_code = result.pop("http_status_code")
    return result


@router.get("/status", response_model=list[dict[str, Any]])
async def list_statuses(
    active_only: bool = False,
    session_id: str | None = Depends(_verify_session_ownership),
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List statuses for all documents."""
    from app.infrastructure.cache.redis_client import get_redis_or_none

    crud_repo = DocumentRepository(db)

    if active_only:
        docs = await crud_repo.list_active(str(user.id), session_id=session_id)
    else:
        docs = await crud_repo.list_by_user(str(user.id), session_id=session_id)

    redis_client = get_redis_or_none()

    results = []
    for d in docs:
        progress_pct = d.progress_pct
        if redis_client and d.current_stage not in {"COMPLETE", "FAILED", "CANCELLED"}:
            cached_pct = await redis_client.get(f"doc_progress:{d.id}")
            if cached_pct is not None:
                try:
                    progress_pct = int(cached_pct.decode())
                except ValueError:
                    pass

        results.append(
            {
                "id": str(d.id),
                "filename": d.filename,
                "status": d.status,
                "current_stage": d.current_stage,
                "progress_pct": progress_pct,
                "processed_chunks": d.processed_chunks,
                "total_chunks": d.total_chunks,
                "error_message": d.error_message,
                "file_size": d.file_size,
            }
        )

    return results


@router.get("/{document_id}/status", response_model=dict[str, Any])
async def get_document_status(
    document_id: str,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get status of a specific document."""
    from app.infrastructure.cache.redis_client import get_redis_or_none

    if parse_uuid(document_id) is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    state_repo = DocumentRepository(db)
    status = await state_repo.get_status(document_id, str(user.id))
    if not status:
        raise HTTPException(status_code=404, detail="Document not found")

    redis_client = get_redis_or_none()
    if redis_client and status["current_stage"] not in {"COMPLETE", "FAILED", "CANCELLED"}:
        cached_pct = await redis_client.get(f"doc_progress:{document_id}")
        if cached_pct is not None:
            try:
                status["progress_pct"] = int(cached_pct.decode())
            except ValueError:
                pass

    return status


@router.post("/{document_id}/cancel", status_code=200)
async def cancel_document(
    document_id: str,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Cancel document ingestion."""
    if parse_uuid(document_id) is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    state_repo = DocumentRepository(db)
    status = await state_repo.get_status(document_id, str(user.id))
    if not status:
        raise HTTPException(status_code=404, detail="Document not found")

    stage = status["current_stage"]
    if stage in {IngestionStage.COMPLETE, IngestionStage.FAILED, IngestionStage.CANCELLED}:
        raise HTTPException(status_code=400, detail=f"Cannot cancel document in stage {stage}")

    await state_repo.mark_cancelled(document_id)
    await db.commit()

    return {"status": "CANCELLED"}


@router.get("/", response_model=list[dict[str, Any]])
async def list_documents(
    session_id: str | None = None,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all documents for the current user."""
    crud_repo = DocumentRepository(db)
    docs = await crud_repo.list_by_user(str(user.id), session_id=session_id)
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "status": d.status,
            "current_stage": d.current_stage,
            "upload_date": d.upload_date.isoformat(),
            "chunk_count": d.chunk_count,
            "file_type": d.file_type,
            "file_size": getattr(d, "file_size", 0),
        }
        for d in docs
        if d.current_stage not in {IngestionStage.FAILED, IngestionStage.CANCELLED}
    ]


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    storage: StorageDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a document and cascade delete its chunks."""
    if parse_uuid(document_id) is None:
        raise HTTPException(status_code=400, detail="Invalid document_id")
    crud_repo = DocumentRepository(db)
    storage_key = await crud_repo.delete_with_cascade(document_id, str(user.id))
    if not storage_key:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.commit()

    if storage_key and await storage.exists(storage_key):
        await storage.delete(storage_key)
