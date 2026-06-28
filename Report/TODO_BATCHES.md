# 🛠️ TODO Batches — VirtAI RAG Recovery + Upgrade

> **Golden Rule:** Each batch must pass its Acceptance Criteria before the agent moves to the next. If a batch fails → STOP, write a post-mortem, do not continue.

---

## 📋 Batch Map

| #   | Batch                                                       | Scope         | Estimated Time | Risk               | Depends On |
| --- | ----------------------------------------------------------- | ------------- | -------------- | ------------------ | ---------- |
| 0   | Pre-flight: backup + branch + audit                         | safety        | 15 min         | 🟢 Low             | —          |
| 1   | `.env` compatibility + Cohere wiring                        | config        | 30 min         | 🟢 Low             | B0         |
| 2   | Embedding dimension migration to 1024 (Cohere multilingual) | DB            | 45 min         | 🟡 Med (data loss) | B1         |
| 3   | Hybrid search language fix (auto-detect ar/en)              | retrieval     | 45 min         | 🟡 Med             | B1         |
| 4   | Reranker — switch to Cohere multilingual                    | retrieval     | 30 min         | 🟢 Low             | B1         |
| 5   | OCR — add Arabic language + tighten fallback                | parsing       | 45 min         | 🟢 Low             | —          |
| 6   | Vision adapter — OpenAI `gpt-4o-mini` integration           | new feature   | 2 hr           | 🟡 Med             | B5         |
| 7   | Vision wiring into ingestion pipeline                       | integration   | 1.5 hr         | 🔴 High            | B6         |
| 8   | Explain endpoint — fix `test_user` + add JWT auth           | security      | 1 hr           | 🔴 High            | —          |
| 9   | Standalone image upload support (PNG/JPG documents)         | new feature   | 1 hr           | 🟡 Med             | B5, B6     |
| 10  | Embedding cache in Redis + composite index                  | performance   | 1 hr           | 🟢 Low             | B2         |
| 11  | Quality harness + RAG_DEBUG mode                            | observability | 1.5 hr         | 🟢 Low             | —          |
| 12  | Smoke test + production checklist                           | verification  | 30 min         | 🟢 Low             | All        |

**Total:** ~12 focused work hours.

---

## BATCH 0 — Pre-flight

### Goal

Ensure every change is reversible and we have a baseline to measure against.

### Tasks

1. Create a new branch: `git checkout -b feat/rag-recovery-cohere-vision`
2. Take a full DB backup:

   ```bash
   pg_dump -d virtai -F c -f backups/virtai_pre_recovery_$(date +%Y%m%d_%H%M).dump
   ```

3. Take a snapshot of baseline metrics (save in `docs/refactor/16-baseline.md`):

   ```bash
   psql -d virtai <<SQL
   SELECT 'documents' as table, COUNT(*) FROM documents
   UNION ALL SELECT 'chunks_total', COUNT(*) FROM document_chunks
   UNION ALL SELECT 'chunks_active', COUNT(*) FROM document_chunks WHERE is_active = TRUE
   UNION ALL SELECT 'users', COUNT(*) FROM users;
   SELECT vector_dims(embedding) FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1;
   SELECT current_stage, COUNT(*) FROM documents GROUP BY current_stage;
   SQL
   ```

4. Copy the current `.env` → `.env.backup.YYYYMMDD`

### Acceptance Criteria

- [ ] Branch exists and is pushed to remote
- [ ] Backup `.dump` exists and size > 0
- [ ] Baseline file is created and saved
- [ ] `.env.backup` exists

### In case of failure

If the backup fails for any reason → STOP. Do not start any other batch.

---

## BATCH 1 — `.env` Compatibility + Cohere Wiring

### Goal

Make the Settings accept the values coming from `.env` instead of silently ignoring them.

### Tasks

1. Update `app/shared/config.py` — add **aliases** instead of renaming (backward compatibility):

   ```python
   from pydantic import Field

   class Settings(BaseSettings):
       # ... existing ...

       EMBEDDING_PROVIDER: Literal["openai", "cohere", "fastembed"] = Field(
           default="cohere",  # ← changed default
           validation_alias=AliasChoices("EMBEDDING_PROVIDER", "EMBEDDING_BACKEND")
       )
       EMBEDDING_MODEL: str = Field(
           default="embed-multilingual-v3.0",  # ← changed default
           validation_alias=AliasChoices("EMBEDDING_MODEL", "EMBEDDING_MODEL_ID")
       )
       EMBEDDING_DIMENSION: int = Field(
           default=1024,  # ← changed default to match Cohere multilingual
           validation_alias=AliasChoices("EMBEDDING_DIMENSION", "EMBEDDING_MODEL_SIZE")
       )
       RERANKER_PROVIDER: Literal["cohere", "cross-encoder"] = Field(
           default="cohere",
           validation_alias=AliasChoices("RERANKER_PROVIDER", "RERANKER_BACKEND")
       )
       RERANKER_MODEL: str = Field(
           default="rerank-multilingual-v3.0",  # ← changed
           validation_alias=AliasChoices("RERANKER_MODEL", "RERANKER_MODEL_ID")
       )
       GENERATION_PROVIDER: Literal["openai", "cohere", "groq"] = Field(
           default="groq",  # ← changed
           validation_alias=AliasChoices("GENERATION_PROVIDER", "GENERATION_BACKEND")
       )
       GENERATION_MODEL: str = Field(
           default="llama-3.3-70b-versatile",  # ← unified with LLM_MODEL
           validation_alias=AliasChoices("GENERATION_MODEL", "GENERATION_MODEL_ID")
       )
   ```

2. Add a validation hook in `__init__` that prints a clear warning if a legacy variable is read:

   ```python
   @model_validator(mode="after")
   def warn_legacy_env_vars(self) -> "Settings":
       import os
       legacy_map = {
           "EMBEDDING_BACKEND": "EMBEDDING_PROVIDER",
           "EMBEDDING_MODEL_ID": "EMBEDDING_MODEL",
           "EMBEDDING_MODEL_SIZE": "EMBEDDING_DIMENSION",
           # ...
       }
       for legacy, new in legacy_map.items():
           if os.getenv(legacy):
               logger.warning(f"[CONFIG] Legacy env var '{legacy}' detected. Use '{new}' instead.")
       return self
   ```

3. Create `cohere_embedder.py` in `app/infrastructure/rag/`:

   ```python
   from cohere import AsyncClient
   from app.domain.rag.ports import EmbeddingProvider
   from app.shared.config import get_settings

   class CohereEmbedder(EmbeddingProvider):
       def __init__(self):
           settings = get_settings()
           if not settings.COHERE_API_KEY:
               raise ValueError("COHERE_API_KEY required for Cohere embedder")
           self.client = AsyncClient(api_key=settings.COHERE_API_KEY)
           self.model = settings.EMBEDDING_MODEL
           self.dimension = settings.EMBEDDING_DIMENSION

       async def embed(self, text: str) -> list[float]:
           resp = await self.client.embed(
               texts=[text], model=self.model, input_type="search_query", embedding_types=["float"]
           )
           return resp.embeddings.float[0]

       async def embed_batch(self, texts: list[str]) -> list[list[float]]:
           if not texts:
               return []
           # Cohere batch limit = 96; chunk if larger
           all_embeds = []
           for i in range(0, len(texts), 96):
               batch = texts[i:i+96]
               resp = await self.client.embed(
                   texts=batch, model=self.model, input_type="search_document",
                   embedding_types=["float"]
               )
               all_embeds.extend(resp.embeddings.float)
           return all_embeds

       async def close(self) -> None:
           pass
   ```

   ⚠️ **Precise note:** Cohere distinguishes between `input_type="search_query"` (for the user query) and `input_type="search_document"` (for chunks). This asymmetric embedding improves quality by 5-10%. The retrieval use case must use a separate `embed_query()` method from `embed_batch()`.

4. Update the `EmbeddingProvider` port in `app/domain/rag/ports.py` to add `embed_query`:

   ```python
   class EmbeddingProvider(Protocol):
       async def embed(self, text: str) -> list[float]: ...
       async def embed_query(self, text: str) -> list[float]: ...   # ← new
       async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...
       async def close(self) -> None: ...
   ```

   And remove or leave fallback for existing ones (`OpenAIEmbedder`, `FastEmbedProvider`) to use `embed` as `embed_query`.

5. Update `worker_startup.py` and dependency injection to choose the embedder based on `EMBEDDING_PROVIDER`:

   ```python
   def build_embedder(settings: Settings) -> EmbeddingProvider:
       if settings.EMBEDDING_PROVIDER == "cohere":
           return CohereEmbedder()
       elif settings.EMBEDDING_PROVIDER == "openai":
           return OpenAIEmbedder()
       elif settings.EMBEDDING_PROVIDER == "fastembed":
           return FastEmbedProvider()
       raise ValueError(f"Unknown EMBEDDING_PROVIDER: {settings.EMBEDDING_PROVIDER}")
   ```

6. Ensure `RetrievalUseCase` uses `embed_query`:

   ```python
   query_vector = await self.embedder.embed_query(query)  # ← was: embed(query)
   ```

7. Update `.env.example` (see `env_example_virtai.txt`)

### Acceptance Criteria

- [ ] `python -c "from app.shared.config import get_settings; s = get_settings(); print(s.EMBEDDING_PROVIDER, s.EMBEDDING_MODEL, s.EMBEDDING_DIMENSION)"` prints: `cohere embed-multilingual-v3.0 1024`
- [ ] If `.env` contains `EMBEDDING_BACKEND=cohere` (old name) → Settings reads it and prints a warning
- [ ] `CohereEmbedder().embed_query("hello")` returns a list of 1024 floats
- [ ] `cohere` library is added to `pyproject.toml`

### Anti-patterns to avoid

- ❌ Do not remove `OpenAIEmbedder` or `FastEmbedProvider` — keep them as options
- ❌ Do not suddenly drop legacy names — use `AliasChoices` for backward compatibility
- ❌ Do not mix `embed_query` and `embed_batch` — Cohere `input_type` is different

---

## BATCH 2 — Embedding Dimension Migration (1024)

### Goal

Change the embedding column from 384 to 1024 and rebuild the HNSW index.

### Tasks

1. Create a new migration:

   ```bash
   cd backend
   alembic revision -m "resize_embedding_to_1024_cohere_multilingual"
   ```

2. Migration content:

   ```python
   """resize embedding to 1024 cohere multilingual

   Revision ID: xxxxxxxxxxxx
   Revises: <head>
   Create Date: 2026-06-25
   """
   from alembic import op
   import sqlalchemy as sa
   from pgvector.sqlalchemy import Vector

   revision = "xxxxxxxxxxxx"
   down_revision = "<previous_head>"

   def upgrade():
       # Drop dependent indexes first
       op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")

       # Drop the column (destructive but intentional — old embeddings unusable)
       op.drop_column("document_chunks", "embedding")

       # Add new column with correct dimension
       op.add_column(
           "document_chunks",
           sa.Column("embedding", Vector(1024), nullable=True)
       )

       # Recreate HNSW index with cosine ops
       op.execute("""
           CREATE INDEX ix_chunks_embedding_hnsw
           ON document_chunks
           USING hnsw (embedding vector_cosine_ops)
           WITH (m = 16, ef_construction = 64)
       """)

       # Mark all docs as needing re-ingestion
       op.execute("""
           UPDATE documents
           SET current_stage = 'QUEUED',
               progress_pct = 0
           WHERE current_stage = 'COMPLETE'
       """)

       # Delete orphaned chunks (no embedding)
       op.execute("DELETE FROM document_chunks")

   def downgrade():
       op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
       op.drop_column("document_chunks", "embedding")
       op.add_column(
           "document_chunks",
           sa.Column("embedding", Vector(384), nullable=True)
       )
       op.execute("""
           CREATE INDEX ix_chunks_embedding_hnsw
           ON document_chunks
           USING hnsw (embedding vector_cosine_ops)
       """)
   ```

3. Run:

   ```bash
   alembic upgrade head
   ```

4. Verify:

   ```bash
   psql -d virtai -c "
   SELECT atttypmod FROM pg_attribute
   WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding';"
   # Should return 1024 + 4 = 1028 (pgvector storage format)
   ```

### Acceptance Criteria

- [ ] Migration ran without errors
- [ ] `\d document_chunks` shows `embedding | vector(1024)`
- [ ] The HNSW index exists and is valid (`\di+ ix_chunks_embedding_hnsw`)
- [ ] All documents reverted to `QUEUED` stage
- [ ] `SELECT COUNT(*) FROM document_chunks;` = 0

### Anti-patterns

- ❌ Do not do an "in-place" migration trying to convert 384→1024 — the vectors are not mutually meaningful, must re-embed
- ❌ Do not forget to update `EMBEDDING_DIMENSION` in `.env` to 1024 **before** starting the worker — otherwise the DocumentChunk model will read an old value from cached settings

---

## BATCH 3 — Hybrid Search Language Fix

### Goal

Make full-text search work correctly for Arabic and English.

### Tasks

1. Update `app/infrastructure/vector/pgvector_store.py`:

   ```python
   import re

   _ARABIC_RE = re.compile(r"[\u0600-\u06FF]")

   def _detect_ts_config(text: str) -> str:
       """Return PostgreSQL text search config based on script detection."""
       if _ARABIC_RE.search(text or ""):
           return "simple"  # No stemmer that ruins Arabic; uses raw lexemes
       return "english"

   async def hybrid_search(self, query_text, query_vector, limit, ...):
       ts_config = _detect_ts_config(query_text)
       text_query = func.websearch_to_tsquery(ts_config, query_text)
       text_vector = func.to_tsvector(ts_config, ChunkModel.chunk_text)
       # ... rest unchanged
   ```

2. The existing index `ix_chunks_text_gin` on `to_tsvector('english', ...)` will not work with `simple`. Two solutions:
   - **(A) Easier:** Add a second index for `simple`:

     ```python
     # in a new migration
     op.execute("""
         CREATE INDEX ix_chunks_text_gin_simple
         ON document_chunks
         USING gin (to_tsvector('simple', chunk_text))
     """)
     ```

   - **(B) Cleaner:** Store the `tsvector` column as a generated column with a per-chunk language config:

     ```python
     # Detect language at ingestion, store in metadata
     # Use stored config in queries
     ```

   - **Recommendation:** Start with (A) for speed and simplicity. (B) for later.

3. Ensure chunk text encoding is correct UTF-8 from the extractor.

### Acceptance Criteria

- [ ] Query: `SELECT * FROM document_chunks WHERE to_tsvector('simple', chunk_text) @@ websearch_to_tsquery('simple', 'الذكاء الاصطناعي') LIMIT 5;` returns results if there is Arabic content
- [ ] English query uses `'english'` and returns results
- [ ] hybrid_search logs show `ts_config_used: simple` or `english`

### Anti-patterns

- ❌ Do not use `arabic` as ts_config — it does not exist in standard PostgreSQL. You need to install the `unaccent` extension + custom dictionary for stemming, but `simple` is sufficient for MVP.
- ❌ Do not remove the old English index — you will still need it.

---

## BATCH 4 — Reranker: Switch to Cohere Multilingual

### Goal

Remove `CrossEncoderReranker` (English only) and replace it with multilingual `CohereReranker`.

### Tasks

1. Create `app/infrastructure/rag/cohere_reranker.py`:

   ```python
   from cohere import AsyncClient
   from loguru import logger
   from app.domain.rag.entities import DocumentChunk
   from app.domain.rag.ports import RerankerPort
   from app.shared.config import get_settings

   class CohereReranker(RerankerPort):
       def __init__(self):
           settings = get_settings()
           if not settings.COHERE_API_KEY:
               raise ValueError("COHERE_API_KEY required")
           self.client = AsyncClient(api_key=settings.COHERE_API_KEY)
           self.model = settings.RERANKER_MODEL  # rerank-multilingual-v3.0

       async def rerank(self, query: str, chunks: list[DocumentChunk], top_k: int = 5):
           if not chunks:
               return []
           try:
               docs = [c.chunk_text for c in chunks]
               resp = await self.client.rerank(
                   model=self.model, query=query, documents=docs, top_n=top_k
               )
               # resp.results: list of {index, relevance_score}
               return [(chunks[r.index], float(r.relevance_score)) for r in resp.results]
           except Exception as e:
               logger.error(f"Cohere rerank failed, falling back to passthrough: {e}")
               return [(chunk, 1.0 - i * 0.01) for i, chunk in enumerate(chunks[:top_k])]
   ```

2. Update DI in `main.py` / `worker_startup.py`:

   ```python
   def build_reranker(settings: Settings) -> RerankerPort | None:
       if settings.RERANKER_PROVIDER == "cohere":
           if not settings.COHERE_API_KEY:
               logger.warning("RERANKER_PROVIDER=cohere but no COHERE_API_KEY; reranker disabled")
               return None
           return CohereReranker()
       elif settings.RERANKER_PROVIDER == "cross-encoder":
           return CrossEncoderReranker()
       return None
   ```

3. Keep `CrossEncoderReranker` available as a fallback (for users without Cohere).

4. Remove `CROSS_ENCODER_MODEL` from default config values if not needed — or keep it but with a clear docstring that it's fallback only.

### Acceptance Criteria

- [ ] `CohereReranker().rerank("test query", [...], top_k=3)` returns 3 tuples with scores
- [ ] Log shows which reranker is activated at startup
- [ ] If COHERE_API_KEY is missing → fallback to CrossEncoder with clear warning
- [ ] Retrieval results for Arabic query return appropriate chunks (manual smoke test)

---

## BATCH 5 — OCR: Arabic + Better Fallback

### Goal

Add Arabic language to OCR and make the fallback more robust.

### Tasks

1. Install Tesseract Arabic on the container/host:

   ```bash
   # Dockerfile
   RUN apt-get update && apt-get install -y \
       tesseract-ocr \
       tesseract-ocr-eng \
       tesseract-ocr-ara \
       poppler-utils \
       && rm -rf /var/lib/apt/lists/*
   ```

2. Update `app/infrastructure/rag/pdf_markdown_extractor.py`:

   ```python
   @staticmethod
   def _extract_page_via_ocr(file_path: str, page_number: int) -> str:
       if not _HAS_OCR or not convert_from_path or not pytesseract:
           return ""
       try:
           images = convert_from_path(
               file_path, first_page=page_number, last_page=page_number,
               dpi=300  # ← higher DPI for better OCR
           )
           parts = []
           for img in images:
               # Try eng+ara first (handles mixed content)
               try:
                   text = pytesseract.image_to_string(img, lang="eng+ara")
               except pytesseract.TesseractError:
                   # Fallback to eng-only if ara pack missing
                   text = pytesseract.image_to_string(img, lang="eng")
               if text.strip():
                   parts.append(text)
           return "\n\n".join(parts)
       except Exception as e:
           logger.warning(f"OCR failed for page {page_number}: {e}")
           return ""
   ```

3. Lower the threshold from 50 → 30 to activate OCR on more pages:

   ```python
   if len(cleaned.strip()) < 30:  # was 50
       cleaned = self._extract_page_via_ocr(file_path, page_num)
   ```

4. Add healthcheck in `worker_startup.py`:

   ```python
   def check_tesseract_languages():
       try:
           import pytesseract
           langs = pytesseract.get_languages()
           if "ara" not in langs:
               logger.warning("Tesseract 'ara' language pack missing — Arabic OCR will fail")
           if "eng" not in langs:
               logger.warning("Tesseract 'eng' language pack missing")
       except Exception as e:
           logger.warning(f"Tesseract not available: {e}")
   ```

### Acceptance Criteria

- [ ] `tesseract --list-langs` prints `eng` and `ara`
- [ ] Uploading a scanned Arabic PDF → resulting chunks contain readable Arabic text
- [ ] Log shows `ocr_lang_used: eng+ara`

---

## BATCH 6 — Vision Adapter (OpenAI gpt-4o-mini)

### Goal

Add the ability to understand images and diagrams in PDFs.

### Tasks

1. Add a port in `app/domain/rag/ports.py`:

   ```python
   from typing import Protocol

   class VisionPort(Protocol):
       async def describe(
           self, image_b64: str, context: str | None = None
       ) -> str: ...

       async def describe_batch(
           self, images_b64: list[str], context: str | None = None
       ) -> list[str]: ...
   ```

2. Create `app/infrastructure/vision/__init__.py` (new folder) and `openai_vision.py`:

   ```python
   import base64
   from openai import AsyncOpenAI
   from loguru import logger
   from app.domain.rag.ports import VisionPort
   from app.shared.config import get_settings

   class OpenAIVisionProvider(VisionPort):
       VISION_SYSTEM_PROMPT = (
           "You are an Educational Image Analyzer. Describe the image's educational "
           "content in detail. Focus on: diagrams (label every box/arrow), formulas "
           "(transcribe in LaTeX), charts (axis labels + key values), and any text "
           "in the image (transcribe verbatim). Do NOT describe purely decorative "
           "elements. If the image is empty or pure noise, respond with 'EMPTY'."
       )

       def __init__(self, model: str | None = None):
           settings = get_settings()
           if not settings.OPENAI_API_KEY:
               raise ValueError("OPENAI_API_KEY required for vision")
           self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
           self._model = model or "gpt-4o-mini"

       async def describe(self, image_b64: str, context: str | None = None) -> str:
           user_prompt = (
               f"Context: {context}\n\nDescribe this image educationally."
               if context else "Describe this image educationally."
           )
           try:
               resp = await self._client.chat.completions.create(
                   model=self._model,
                   messages=[
                       {"role": "system", "content": self.VISION_SYSTEM_PROMPT},
                       {"role": "user", "content": [
                           {"type": "text", "text": user_prompt},
                           {"type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                       ]},
                   ],
                   max_tokens=600,
                   temperature=0.2,
               )
               text = (resp.choices[0].message.content or "").strip()
               return "" if text.upper() == "EMPTY" else text
           except Exception as e:
               logger.error(f"Vision describe failed: {e}")
               return ""

       async def describe_batch(self, images_b64, context=None):
           import asyncio
           tasks = [self.describe(b64, context) for b64 in images_b64]
           return await asyncio.gather(*tasks, return_exceptions=False)
   ```

3. Add config:

   ```python
   # config.py
   VISION_PROVIDER: Literal["openai", "disabled"] = "openai"
   VISION_MODEL: str = "gpt-4o-mini"
   VISION_MAX_IMAGES_PER_DOC: int = 30   # caps cost for large PDFs
   ```

4. DI factory:

   ```python
   def build_vision(settings: Settings) -> VisionPort | None:
       if settings.VISION_PROVIDER == "disabled":
           return None
       if not settings.OPENAI_API_KEY:
           logger.warning("VISION_PROVIDER=openai but no OPENAI_API_KEY; vision disabled")
           return None
       return OpenAIVisionProvider(model=settings.VISION_MODEL)
   ```

### Acceptance Criteria

- [ ] `OpenAIVisionProvider().describe(b64_of_chart)` returns a non-empty description
- [ ] `describe_batch([5 images])` works in parallel (not serial)
- [ ] If the image is empty → the method returns `""` (not "EMPTY")
- [ ] Cost guard: if `len(images) > VISION_MAX_IMAGES_PER_DOC` → log warning and skip the rest

---

## BATCH 7 — Vision Wiring into Ingestion

### Goal

Make vision descriptions get integrated into the chunks that go into the vector store.

### Tasks

1. Update `PDFMarkdownExtractor` to also extract images:

   ```python
   import fitz  # PyMuPDF

   def extract_with_images(self, file_path: str) -> tuple[str, list[dict]]:
       """Returns (markdown_text, list_of_images)"""
       doc = fitz.open(file_path)
       markdown_parts = []
       images = []
       for page_num, page in enumerate(doc, start=1):
           md = page.get_text("markdown")  # or your existing logic
           markdown_parts.append(md)
           # Extract images
           for img_idx, img in enumerate(page.get_images(full=True)):
               xref = img[0]
               pix = fitz.Pixmap(doc, xref)
               if pix.n - pix.alpha < 4:  # GRAY or RGB
                   img_bytes = pix.tobytes("png")
                   import base64
                   images.append({
                       "b64": base64.b64encode(img_bytes).decode(),
                       "page": page_num,
                       "idx": img_idx,
                   })
               pix = None
       return "\n\n".join(markdown_parts), images
   ```

2. Update `IngestDocumentUseCase`:

   ```python
   def __init__(self, ..., vision: VisionPort | None = None):
       self.vision = vision

   async def execute(self, ...):
       # Stage 2: PARSING (modified)
       if hasattr(self.parser, "extract_with_images"):
           raw_text, images = await asyncio.to_thread(
               self.parser.extract_with_images, local_path
           )
       else:
           raw_text = await self.parser.parse_bytes(file_bytes, file_type)
           images = []

       # NEW Stage 2.5: VISION (if enabled and images exist)
       if self.vision and images:
           settings = get_settings()
           images = images[:settings.VISION_MAX_IMAGES_PER_DOC]
           descriptions = await self.vision.describe_batch(
               [img["b64"] for img in images],
               context=f"Document: {filename}"
           )
           # Inject vision descriptions as synthetic markdown sections
           vision_sections = []
           for img, desc in zip(images, descriptions, strict=False):
               if desc.strip():
                   vision_sections.append(
                       f"\n\n[Visual content from page {img['page']}]\n{desc}\n"
                   )
           if vision_sections:
               raw_text += "\n\n" + "\n".join(vision_sections)

       # Stage 3 onwards unchanged...
   ```

3. Add metadata in chunks for vision-derived content:

   ```python
   # in chunking, if the chunk comes from a vision section
   chunk.metadata["source_type"] = "vision"
   chunk.metadata["page"] = img["page"]
   ```

### Acceptance Criteria

- [ ] Uploading a PDF with diagrams → resulting chunks contain diagram descriptions
- [ ] `SELECT chunk_text FROM document_chunks WHERE metadata->>'source_type' = 'vision';` returns results
- [ ] If `VISION_PROVIDER=disabled` → ingestion works normally without vision
- [ ] Cost guard works: PDF with 100 images → only the first 30 are processed

### Anti-patterns

- ❌ Do not request vision lock-step (one after another) — use `gather` for the batch
- ❌ Do not store raw image bytes in the DB — only the description
- ❌ Do not forget the cost cap — gpt-4o-mini is cheap but not free

---

## BATCH 8 — Explain Endpoint: Fix `test_user` + JWT Auth

### Goal

Remove the shameful `test_user` and put real JWT auth on the explain WS.

### Tasks

1. Look at the WS auth pattern used by `/ws/{avatar_id}` (existing in `gateway.py`) and apply it to explain.

2. Update `app/presentation/http/v1/router.py`:

   ```python
   from app.presentation.ws.session_bootstrap import authenticate_ws

   @router.websocket("/rag/explain/{document_id}")
   async def explain_websocket_endpoint(
       websocket: WebSocket,
       document_id: str,
       db: AsyncSession = Depends(get_db),
       chat_use_case: ChatUseCase = Depends(get_chat_use_case),
   ):
       # JWT auth via subprotocol (matches /ws/{avatar_id} pattern)
       user = await authenticate_ws(websocket)
       if not user:
           await websocket.close(code=4401, reason="Unauthorized")
           return

       # Verify document ownership
       from app.infrastructure.db.models import Document
       from app.shared.ids import parse_uuid
       doc_uuid = parse_uuid(document_id)
       if not doc_uuid:
           await websocket.close(code=4400, reason="Invalid document ID")
           return

       doc = await db.scalar(select(Document).where(
           Document.id == doc_uuid,
           Document.user_id == user.id,  # ← ownership check
       ))
       if not doc:
           await websocket.close(code=4403, reason="Document not found or forbidden")
           return

       # Existing session guard
       if doc.retrieval_scope == "SESSION" and doc.scope_id:
           session_model = await db.scalar(
               select(ChatSession).where(ChatSession.id == doc.scope_id)
           )
           if session_model and session_model.message_count > 0:
               await websocket.close(code=1008, reason="Chat already started")
               return

       await websocket.accept()
       handler = ExplainHandler(
           websocket=websocket,
           document_id=document_id,
           db=db,
           user_id=str(user.id),  # ← real user_id
           chat_use_case=chat_use_case,
       )
       try:
           await handler.run()
       except Exception as e:
           logger.error(f"[ExplainWS] Handler error: {e}")
   ```

3. Create a function `authenticate_ws` if not exists:

   ```python
   # app/presentation/ws/session_bootstrap.py
   async def authenticate_ws(websocket: WebSocket) -> UserEntity | None:
       """Extract JWT from subprotocol/query/cookie, verify, return user."""
       token = None
       # Try subprotocol first (matches /ws/{avatar_id})
       protocols = websocket.headers.get("sec-websocket-protocol", "")
       for p in protocols.split(","):
           p = p.strip()
           if p.startswith("token."):
               token = p[len("token."):]
               break
       # Fall back to query param
       if not token:
           token = websocket.query_params.get("access_token")
       if not token:
           return None
       try:
           payload = decode_jwt(token)  # raises on invalid
           user_repo = UserRepository(...)
           user = await user_repo.get(payload["sub"])
           return user
       except Exception as e:
           logger.warning(f"WS auth failed: {e}")
           return None
   ```

### Acceptance Criteria

- [ ] `wscat -c ws://localhost:8000/api/v1/rag/explain/<doc_id>` without token → closes with 4401
- [ ] `wscat -c ws://localhost:8000/api/v1/rag/explain/<doc_id> -s "token.<jwt>"` with a valid token → connects
- [ ] User A tries to open a document belonging to User B → closes with 4403
- [ ] The retrieval inside ExplainHandler uses the real user_id → returns chunks if the doc belongs to that user

### Anti-patterns

- ❌ Do not remove the existing `/ws/{avatar_id}` auth logic — use it as the source of truth
- ❌ Do not leave detailed error messages for unauthorized — close code + short reason is enough

---

## BATCH 9 — Standalone Image Uploads (PNG/JPG as documents)

### Goal

Let the user upload an image as a standalone "document".

### Tasks

1. Update `ALLOWED_FILE_TYPES`:

   ```python
   ALLOWED_FILE_TYPES: list[str] = ["pdf", "txt", "md", "png", "jpg", "jpeg", "webp"]
   ```

2. Add a parser for images — `app/infrastructure/rag/image_extractor.py`:

   ```python
   import base64
   from app.domain.rag.ports import DocumentParser, VisionPort

   class ImageDocumentParser(DocumentParser):
       def __init__(self, vision: VisionPort | None, ocr_enabled: bool = True):
           self.vision = vision
           self.ocr_enabled = ocr_enabled

       async def parse_bytes(self, file_bytes: bytes, file_type: str) -> str:
           parts = []
           b64 = base64.b64encode(file_bytes).decode()

           # 1. OCR
           if self.ocr_enabled:
               try:
                   from PIL import Image
                   import pytesseract
                   import io
                   img = Image.open(io.BytesIO(file_bytes))
                   ocr_text = pytesseract.image_to_string(img, lang="eng+ara")
                   if ocr_text.strip():
                       parts.append(f"## OCR Text\n\n{ocr_text}")
               except Exception as e:
                   logger.warning(f"Image OCR failed: {e}")

           # 2. Vision description
           if self.vision:
               desc = await self.vision.describe(b64)
               if desc.strip():
                   parts.append(f"## Visual Description\n\n{desc}")

           return "\n\n".join(parts) if parts else ""
   ```

3. Update ingestion task routing:

   ```python
   def build_parser(file_type: str, vision: VisionPort | None) -> DocumentParser:
       if file_type in ("png", "jpg", "jpeg", "webp"):
           return ImageDocumentParser(vision=vision, ocr_enabled=True)
       elif file_type == "pdf":
           return PDFMarkdownExtractor()
       elif file_type in ("txt", "md"):
           return PlainTextParser()
       raise ValueError(f"Unsupported file_type: {file_type}")
   ```

### Acceptance Criteria

- [ ] `curl POST /api/v1/documents/upload -F file=@diagram.png` → returns `QUEUED`
- [ ] After a few minutes `GET /documents/<id>/status` → `COMPLETE`
- [ ] The resulting chunks contain OCR text + vision description
- [ ] Querying about the image content returns an answer based on the vision

---

## BATCH 10 — Embedding Cache + Composite Index

### Goal

Reduce cost and latency.

### Tasks

1. Embedding cache in Redis:

   ```python
   # app/infrastructure/rag/cached_embedder.py
   import hashlib
   import json
   from redis.asyncio import Redis
   from app.domain.rag.ports import EmbeddingProvider

   class CachedEmbedder(EmbeddingProvider):
       def __init__(self, base: EmbeddingProvider, redis: Redis, ttl: int = 86400 * 30):
           self.base = base
           self.redis = redis
           self.ttl = ttl

       def _key(self, text: str) -> str:
           h = hashlib.sha256(text.encode("utf-8")).hexdigest()
           return f"emb:{self.base.__class__.__name__}:{h}"

       async def embed_query(self, text: str) -> list[float]:
           # Don't cache queries (high cardinality, low reuse)
           return await self.base.embed_query(text)

       async def embed_batch(self, texts: list[str]) -> list[list[float]]:
           if not texts:
               return []
           keys = [self._key(t) for t in texts]
           cached = await self.redis.mget(keys)

           result: list[list[float] | None] = [None] * len(texts)
           missing_idx = []
           missing_texts = []
           for i, c in enumerate(cached):
               if c:
                   result[i] = json.loads(c)
               else:
                   missing_idx.append(i)
                   missing_texts.append(texts[i])

           if missing_texts:
               fresh = await self.base.embed_batch(missing_texts)
               pipe = self.redis.pipeline()
               for idx, emb in zip(missing_idx, fresh, strict=False):
                   result[idx] = emb
                   pipe.set(self._key(texts[idx]), json.dumps(emb), ex=self.ttl)
               await pipe.execute()

           return [r for r in result if r is not None]  # type: ignore

       async def close(self):
           await self.base.close()
   ```

2. Composite index:

   ```python
   # migration
   op.create_index(
       "ix_chunks_active_doc_scope",
       "document_chunks",
       ["is_active", "document_id", "scope_id"],
   )
   ```

### Acceptance Criteria

- [ ] Ingest the same PDF twice → the second is 60%+ faster (cache hit)
- [ ] `EXPLAIN ANALYZE` on a retrieval query shows the composite index being used

---

## BATCH 11 — Quality Harness + RAG_DEBUG

### Goal

Be able to measure regression quickly.

### Tasks

1. `tests/rag_quality/golden_queries.yaml`:

   ```yaml
   - query: 'ما هي خوارزمية الـ HNSW؟'
     doc: 'test_arabic_ml.pdf'
     expected_chunks_min: 2
     must_contain_any: ['HNSW', 'Hierarchical', 'بياني']
   - query: 'What is gradient descent?'
     doc: 'test_ml_intro.pdf'
     expected_chunks_min: 3
     must_contain_any: ['gradient', 'minimize', 'loss']
   # ... 30 total
   ```

2. `scripts/run_quality_pipeline.sh` (if not exists):

   ```bash
   #!/bin/bash
   set -e
   pytest tests/rag_quality -v --tb=short
   ```

3. RAG_DEBUG mode:

   ```python
   # config.py
   RAG_DEBUG: bool = False

   # retrieval_use_case.py
   if settings.RAG_DEBUG:
       debug_payload = {
           "query": query,
           "chunks": [{"id": str(c.id), "score": s, "preview": c.chunk_text[:100]}
                      for c, s in results],
           "task_type": task_type.value,
       }
       logger.info(f"[RAG_DEBUG] {json.dumps(debug_payload, ensure_ascii=False)}")
   ```

### Acceptance Criteria

- [ ] `bash scripts/run_quality_pipeline.sh` runs and prints pass rate
- [ ] In CI, a RAG quality drop > 10% fails the build
- [ ] `RAG_DEBUG=1` in `.env` prints debugging info on every query

---

## BATCH 12 — Smoke Test + Production Checklist

### Goal

Comprehensive verification before we say "it's done".

### Tasks

1. Run the smoke test script:

   ```bash
   # scripts/smoke_test_rag.sh
   set -e

   # 1. Login
   TOKEN=$(curl -sX POST http://localhost:8000/api/v1/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"test@test.com","password":"test1234"}' \
       | jq -r .access_token)

   # 2. Upload Arabic PDF
   DOC_ID=$(curl -sX POST http://localhost:8000/api/v1/documents/upload \
       -H "Authorization: Bearer $TOKEN" \
       -F "file=@tests/fixtures/arabic_ml.pdf" \
       | jq -r .id)
   echo "Uploaded doc: $DOC_ID"

   # 3. Wait for COMPLETE
   for i in {1..60}; do
       STATUS=$(curl -s http://localhost:8000/api/v1/documents/$DOC_ID/status \
           -H "Authorization: Bearer $TOKEN" | jq -r .stage)
       echo "Stage: $STATUS"
       [ "$STATUS" = "COMPLETE" ] && break
       sleep 2
   done

   # 4. Query in Arabic
   curl -X POST http://localhost:8000/api/v1/chat/query \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"query":"ما هو الذكاء الاصطناعي؟","document_id":"'$DOC_ID'"}'

   # 5. Verify DB state
   psql -d virtai <<SQL
   SELECT vector_dims(embedding) FROM document_chunks WHERE document_id = '$DOC_ID' LIMIT 1;
   SELECT COUNT(*) FILTER (WHERE is_active) AS active_chunks FROM document_chunks WHERE document_id = '$DOC_ID';
   SQL
   ```

2. Production checklist:
   - [ ] `.env.example` is complete
   - [ ] Dockerfile has `tesseract-ocr-ara`
   - [ ] `docker-compose.yml` runs API + Worker + Redis + Postgres
   - [ ] `alembic upgrade head` runs cleanly on an empty DB
   - [ ] All tests pass (`pytest`)
   - [ ] No `# TODO` or `# FIXME` or `"test_user"` literal in the code
   - [ ] `grep -rn "test_user" backend/app/` → empty
   - [ ] HEALTHCHECK in Dockerfile
   - [ ] Logs are in JSON mode when `LOG_JSON=true`
   - [ ] Documentation is written in `docs/ARCHITECTURE.md`

### Acceptance Criteria — Final

- [ ] The smoke test runs end-to-end without errors
- [ ] Arabic query returns an answer based on the doc (not "I could not find")
- [ ] English query returns an answer based on the doc
- [ ] PDF with diagrams → answer mentions the visual content
- [ ] Explain WS requires a valid JWT
- [ ] `RAG_DEBUG=1` shows retrieved chunks in the logs
- [ ] The quality harness pass rate >= 80%
- [ ] Embedding dimension in the DB = 1024
- [ ] Cohere reranker is used and logs confirm it

---

## 🚨 Anti-Hallucination Guards for the Agent

Each batch must apply these guards:

1. **Read the actual code before editing** — use `Read` on the full file. Do not rely on partial grep.
2. **Do not change anything outside the scope** — if a batch is about embeddings, **do not touch** TTS or ASR or Auth.
3. **Do not remove any feature** — aliases and backward compatibility only. No breaking removals.
4. **Every change must have a test** — if you add a new method, add a test for it. If you change behavior, update the test.
5. **If a batch fails its acceptance criteria, STOP** — write a post-mortem in `docs/refactor/16-batch-<n>-failure.md` and wait for human review.
6. **Do not write a "smart" fallback that you don't see** — if COHERE_API_KEY is missing, the embedder fails with a clear ValueError. Do not silently fall back to fastembed.
7. **Commit after each batch** — with message: `feat(rag): BATCH X — <title>` and the verification output in the body.
8. **If you find a bug outside your scope** — open an issue/TODO, do not fix it in the same PR.

---

**End of TODO.**
