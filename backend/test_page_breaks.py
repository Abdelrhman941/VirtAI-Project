from app.infrastructure.rag.smart_chunker import SmartChunker

text = """# Page 1
This is the first page content.
It is short.

---

# Page 2
This is the second page content.
It has some bullet points:
- Item 1
- Item 2

---

# Page 3
This is the final page."""

chunker = SmartChunker(chunk_size=1000)
chunks = chunker.chunk(text)

print(f"Total chunks: {len(chunks)}")
for i, chunk in enumerate(chunks):
    print(f"--- Chunk {i+1} ---")
    print(chunk)
