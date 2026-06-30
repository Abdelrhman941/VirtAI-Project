import asyncio
import os
import sys

from app.infrastructure.rag.smart_chunker import SmartChunker
from app.domain.rag.normalization import normalize_text

text = "Heading 1\n\nParagraph 1 is quite long. " * 50
normalized = normalize_text(text)
chunker = SmartChunker(chunk_size=1000)
chunks = chunker.chunk(normalized)

print(f"Chunks without normalized: {len(chunker.chunk(text))}")
print(f"Chunks with normalized: {len(chunks)}")
print(f"First chunk length: {len(chunks[0])}")
