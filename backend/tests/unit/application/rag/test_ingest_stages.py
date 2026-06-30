import pytest
import uuid
from unittest.mock import Mock, AsyncMock
from contextlib import asynccontextmanager
from app.application.rag.ingest_document import chunk_document, embed_and_index_chunks
from app.shared.errors import EmptyDocumentError, ChunkLimitExceeded, IngestionCancelledException

@pytest.mark.asyncio
async def test_chunk_document_success():
    class DummyChunker:
        def chunk(self, text):
            return ["chunk1", "chunk2"]
            
    class DummySettings:
        MAX_CHUNKS_PER_DOCUMENT = 100
        
    chunks = await chunk_document("dummy text", DummyChunker(), DummySettings())
    assert chunks == ["chunk1", "chunk2"]

@pytest.mark.asyncio
async def test_chunk_document_empty():
    class DummyChunker:
        def chunk(self, text):
            return []
            
    class DummySettings:
        MAX_CHUNKS_PER_DOCUMENT = 100
        
    with pytest.raises(EmptyDocumentError):
        await chunk_document("dummy text", DummyChunker(), DummySettings())

@pytest.mark.asyncio
async def test_chunk_document_exceeds_limit():
    class DummyChunker:
        def chunk(self, text):
            return ["c1", "c2", "c3"]
            
    class DummySettings:
        MAX_CHUNKS_PER_DOCUMENT = 2
        
    with pytest.raises(ChunkLimitExceeded):
        await chunk_document("dummy text", DummyChunker(), DummySettings())

@pytest.mark.asyncio
async def test_embed_and_index_chunks():
    doc_uuid = uuid.uuid4()
    chunks_text = ["chunk1", "chunk2"]
    
    embedder = AsyncMock()
    embedder.embed_batch.return_value = [[0.1], [0.2]]
    
    vector_store = AsyncMock()
    
    db_session = AsyncMock()
    
    @asynccontextmanager
    async def db_session_factory():
        yield db_session

    vector_store_factory = Mock(return_value=vector_store)
    
    progress_callback = AsyncMock()
    cancellation_check = AsyncMock(return_value=False)
    
    await embed_and_index_chunks(
        doc_uuid=doc_uuid,
        filename="test.pdf",
        retrieval_scope="GLOBAL",
        scope_id=None,
        chunks_text=chunks_text,
        embedder=embedder,
        db_session_factory=db_session_factory,
        vector_store_factory=vector_store_factory,
        batch_size=2,
        progress_callback=progress_callback,
        cancellation_check=cancellation_check,
    )
    
    embedder.embed_batch.assert_called_once_with(["chunk1", "chunk2"])
    vector_store.store_chunks_batch.assert_called_once()
    db_session.commit.assert_called_once()

@pytest.mark.asyncio
async def test_embed_and_index_chunks_cancellation():
    doc_uuid = uuid.uuid4()
    chunks_text = ["chunk1"]
    
    cancellation_check = AsyncMock(return_value=True)
    
    with pytest.raises(IngestionCancelledException):
        await embed_and_index_chunks(
            doc_uuid=doc_uuid,
            filename="test.pdf",
            retrieval_scope="GLOBAL",
            scope_id=None,
            chunks_text=chunks_text,
            embedder=AsyncMock(),
            db_session_factory=Mock(),
            vector_store_factory=Mock(),
            batch_size=2,
            progress_callback=AsyncMock(),
            cancellation_check=cancellation_check,
        )
