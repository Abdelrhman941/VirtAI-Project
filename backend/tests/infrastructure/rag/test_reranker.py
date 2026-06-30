from unittest.mock import patch

import pytest

from app.domain.rag.entities import DocumentChunk
from app.infrastructure.rag.reranker import CrossEncoderReranker


@pytest.mark.asyncio
async def test_reranker_graceful_fallback():
    # Reset singleton state
    CrossEncoderReranker._import_failed = False
    CrossEncoderReranker._model_instance = None
    CrossEncoderReranker._model_name_cache = None

    reranker = CrossEncoderReranker()

    chunks = [
        DocumentChunk(
            id="chunk1", chunk_text="text1", chunk_order=1, document_id="doc1", embedding=[]
        ),
        DocumentChunk(
            id="chunk2", chunk_text="text2", chunk_order=2, document_id="doc2", embedding=[]
        ),
    ]

    with patch.object(reranker, "_ensure_model", return_value=False):
        results = await reranker.rerank("query", chunks, top_k=5)

    assert len(results) == 2
    assert results[0][0].chunk_text == "text1"
    assert results[0][1] == 1.0
    assert results[1][0].chunk_text == "text2"
    assert results[1][1] == 0.99
