import pytest
from unittest.mock import AsyncMock, MagicMock

from app.application.rag.pipeline import (
    DefaultIngestionPipeline,
    IndexableChunk,
    PipelineInput,
)
from app.shared.errors import ChunkLimitExceeded, EmptyDocumentError


@pytest.fixture
def mock_parser():
    parser = AsyncMock()
    parser.parse_bytes.return_value = "Mocked document text."
    return parser


@pytest.fixture
def mock_chunker():
    chunker = MagicMock()
    chunker.chunk.return_value = ["Mocked document", "text."]
    return chunker


@pytest.fixture
def mock_embedder():
    embedder = AsyncMock()
    embedder.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]
    return embedder


@pytest.mark.asyncio
async def test_ingestion_pipeline_transforms_bytes_to_embedded_chunks(
    mock_parser, mock_chunker, mock_embedder
):
    pipeline = DefaultIngestionPipeline(
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
        batch_size=2,
    )

    payload = PipelineInput(
        file_bytes=b"fake data", 
        file_type="pdf", 
        filename="test.pdf"
    )

    batches = [batch async for batch in pipeline.run(payload)]

    assert len(batches) == 1
    assert len(batches[0]) == 2
    
    first_chunk = batches[0][0]
    assert first_chunk.chunk_text == "Mocked document"
    assert first_chunk.embedding == [0.1, 0.2]
    assert first_chunk.chunk_order == 0
    assert first_chunk.metadata["source"] == "test.pdf"


@pytest.mark.asyncio
async def test_ingestion_pipeline_raises_empty_document_error(
    mock_parser, mock_chunker, mock_embedder
):
    mock_parser.parse_bytes.return_value = "   \n  "  # Whitespace only
    
    pipeline = DefaultIngestionPipeline(
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )
    
    payload = PipelineInput(
        file_bytes=b"empty", 
        file_type="pdf", 
        filename="empty.pdf"
    )

    with pytest.raises(EmptyDocumentError):
        async for _ in pipeline.run(payload):
            pass


@pytest.mark.asyncio
async def test_ingestion_pipeline_raises_chunk_limit_exceeded(
    mock_parser, mock_chunker, mock_embedder
):
    mock_chunker.chunk.return_value = ["chunk"] * 10
    
    pipeline = DefaultIngestionPipeline(
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
    )
    
    payload = PipelineInput(
        file_bytes=b"large", 
        file_type="pdf", 
        filename="large.pdf",
        max_chunks=5  # Strictly less than 10
    )

    with pytest.raises(ChunkLimitExceeded):
        async for _ in pipeline.run(payload):
            pass


@pytest.mark.asyncio
async def test_ingestion_pipeline_respects_batch_size(
    mock_parser, mock_chunker, mock_embedder
):
    mock_chunker.chunk.return_value = ["A", "B", "C", "D", "E"]
    mock_embedder.embed_batch.side_effect = [
        [[0.1], [0.2]],       # Batch 1
        [[0.3], [0.4]],       # Batch 2
        [[0.5]]               # Batch 3
    ]
    
    pipeline = DefaultIngestionPipeline(
        parser=mock_parser,
        chunker=mock_chunker,
        embedder=mock_embedder,
        batch_size=2,
    )
    
    payload = PipelineInput(file_bytes=b"data", file_type="txt", filename="file.txt")

    batches = [batch async for batch in pipeline.run(payload)]

    assert len(batches) == 3
    assert len(batches[0]) == 2
    assert len(batches[1]) == 2
    assert len(batches[2]) == 1
    
    assert batches[0][0].chunk_order == 0
    assert batches[0][1].chunk_order == 1
    assert batches[1][0].chunk_order == 2
    assert batches[2][0].chunk_order == 4
