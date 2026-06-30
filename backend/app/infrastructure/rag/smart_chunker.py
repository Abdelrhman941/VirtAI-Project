"""
Markdown-aware smart chunker for the agentic RAG pipeline.

Extracted from RAG_project's ProcessController — this module handles
ONLY the text→chunks conversion with awareness of:
- Code blocks (never split mid-block)
- Markdown tables (never split mid-table)
- Headings (used as chunk boundaries)
- Lists (grouped together)
- Overlap via block-level carry-forward (not naive character overlap)

This is a higher-fidelity chunker than the existing ``markdown_chunker.py``
which uses simple ``RecursiveCharacterTextSplitter``. The existing chunker
is still used by the ingestion pipeline; this one will serve the agentic
RAG pipeline for re-processing uploaded documents.
"""

from __future__ import annotations

import re

from loguru import logger

try:
    from langchain_text_splitters import MarkdownTextSplitter
except ImportError:
    pass


class SmartChunker:
    """
    Markdown-aware chunker that respects document structure.

    Processes input text through:
    1. Markdown block extraction (headings, code, tables, lists, paragraphs)
    2. Structure-aware chunk assembly (never splits protected blocks)
    3. Overlap via block carry-forward (not character-level)

    Usage::

        chunker = SmartChunker(chunk_size=1000, overlap_size=200)
        chunks = chunker.chunk_pages(pages)  # list[ExtractedPage] → list[ChunkedDocument]
    """

    # Markdown-aware separators (ordered by priority)
    SEPARATORS = [
        "\n```",  # code blocks
        "\n\n|",  # tables
        "\n\n## ",  # h2
        "\n\n### ",  # h3
        "\n\n#### ",  # h4
        "\n\n",  # paragraph break
        "\n",  # line break
        " ",  # word break
        "",  # character break (last resort)
    ]

    def __init__(
        self,
        chunk_size: int = 1000,
        overlap_size: int = 200,
        max_tokens: int | None = 512,
        encoding_name: str = "cl100k_base",
    ):
        self.chunk_size = chunk_size
        self.overlap_size = overlap_size
        self.max_tokens = max_tokens
        self.encoding_name = encoding_name

        try:
            import tiktoken

            self.tokenizer = tiktoken.get_encoding(self.encoding_name)
        except ImportError:
            self.tokenizer = None
            logger.warning("tiktoken not installed — Token validation unavailable")

        try:
            from langchain_text_splitters import MarkdownTextSplitter
            self._splitter = MarkdownTextSplitter(chunk_size=self.chunk_size, chunk_overlap=self.overlap_size)
        except ImportError:
            self._splitter = None
            logger.warning("langchain_text_splitters not installed — Langchain fallback splitting disabled")

        # Splitting logic now handled natively within chunk()

    def chunk_text(self, raw_text: str) -> list[str]:
        """
        Simple text chunking (no metadata tracking).
        """
        return self.chunk(raw_text)

    def chunk(self, text: str) -> list[str]:
        """
        Implementation of the ChunkingStrategy interface.
        """
        blocks = self._extract_markdown_blocks(text)
        return self._build_chunks_from_blocks(blocks)

    # ── Block extraction ─────────────────────────────────────────────────

    def _extract_markdown_blocks(self, text: str) -> list[dict[str, str]]:
        """Parse markdown text into typed blocks (heading, code, table, list, paragraph)."""
        lines = text.split("\n")
        blocks: list[dict[str, str]] = []
        current_lines: list[str] = []
        in_code_block = False

        for line in lines:
            stripped = line.strip()

            # Code block toggle
            if stripped.startswith("```"):
                if current_lines:
                    blocks.append(self._make_block(current_lines))
                    current_lines = []
                current_lines.append(line)
                in_code_block = not in_code_block
                if not in_code_block:
                    blocks.append({"type": "code", "text": "\n".join(current_lines).strip()})
                    current_lines = []
                continue

            if in_code_block:
                current_lines.append(line)
                continue

            # Empty line = block separator
            if stripped == "":
                if current_lines:
                    blocks.append(self._make_block(current_lines))
                    current_lines = []
                continue

            # Table lines
            if self._is_table_line(stripped):
                if current_lines and not self._is_table_line(current_lines[-1].strip()):
                    blocks.append(self._make_block(current_lines))
                    current_lines = []
                current_lines.append(line)
                continue

            # End of table
            if current_lines and self._is_table_line(current_lines[-1].strip()):
                blocks.append({"type": "table", "text": "\n".join(current_lines).strip()})
                current_lines = []

            current_lines.append(line)

        # Flush remaining
        if current_lines:
            if self._is_table_line(current_lines[0].strip()):
                blocks.append({"type": "table", "text": "\n".join(current_lines).strip()})
            else:
                blocks.append(self._make_block(current_lines))

        return blocks

    def _make_block(self, lines: list[str]) -> dict[str, str]:
        text = "\n".join(lines).strip()
        if not text:
            return {"type": "paragraph", "text": ""}

        first = lines[0].strip()
        if first.startswith("#"):
            return {"type": "heading", "text": text}
        if self._is_list_item(first):
            return {"type": "list", "text": text}
        return {"type": "paragraph", "text": text}

    # ── Chunk assembly ───────────────────────────────────────────────────

    def _build_chunks_from_blocks(self, blocks: list[dict[str, str]]) -> list[str]:
        """Assemble blocks into chunks respecting size limits and structure."""
        chunks: list[str] = []
        current_blocks: list[str] = []

        def flush():
            nonlocal current_blocks
            if not current_blocks:
                return
            chunks.append("\n\n".join(current_blocks).strip())

            # Block-level overlap
            if self.overlap_size <= 0:
                current_blocks = []
                return

            overlap, length = [], 0
            for prev in reversed(current_blocks):
                overlap.insert(0, prev)
                length += len(prev) + 2
                if length >= self.overlap_size:
                    break
            current_blocks = overlap

        for block in blocks:
            block_text = block.get("text", "").strip()
            if not block_text:
                continue

            is_protected = block.get("type") in {"code", "table"}

            # Force hard chunk boundary on horizontal rules (used for PDF page breaks)
            if block_text == "---":
                flush()
                # Clear overlap so the new page starts fresh
                current_blocks = []
                continue

            # Oversized non-protected blocks: split with langchain
            if len(block_text) > self.chunk_size and not is_protected:
                flush()
                if hasattr(self, "_splitter") and self._splitter:
                    for segment in self._splitter.split_text(block_text):
                        if segment.strip():
                            chunks.append(segment.strip())
                else:
                    # fallback if no langchain
                    chunks.append(block_text)
                continue

            # Check if adding this block exceeds the limit
            candidate = [*current_blocks, block_text]
            candidate_text = "\n\n".join(candidate)
            if current_blocks and len(candidate_text) > self.chunk_size:
                flush()
                current_blocks.append(block_text)
            else:
                current_blocks = candidate

        flush()

        if not self.max_tokens or not self.tokenizer:
            return chunks

        # Final Token Safety Pass
        safe_chunks = []
        for chunk in chunks:
            tokens = self.tokenizer.encode(chunk, disallowed_special=())
            if len(tokens) <= self.max_tokens:
                safe_chunks.append(chunk)
            else:
                # Absolute worst case fallback: truncate directly
                logger.warning(
                    f"Chunk still exceeded max_tokens ({len(tokens)} > {self.max_tokens}). Truncating directly."
                )
                truncated_tokens = tokens[: self.max_tokens]
                safe_chunks.append(self.tokenizer.decode(truncated_tokens))


        return safe_chunks

    # ── Utilities ────────────────────────────────────────────────────────

    @staticmethod
    def _is_table_line(line: str) -> bool:
        if "|" not in line:
            return False
        if re.match(r"^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$", line):
            return True
        return line.count("|") >= 2

    @staticmethod
    def _is_list_item(text: str) -> bool:
        return bool(re.match(r"^([-*+\u2022\u25E6\u25AA\u2023]|\d+[.)])\s+", text))

    @staticmethod
    def _clean_markdown_text(text: str) -> str:
        """Normalize whitespace while preserving code blocks."""
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")

        code_blocks: list[str] = []

        def protect(match):
            code_blocks.append(match.group(0))
            return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

        protected = re.compile(r"```[\s\S]*?```").sub(protect, normalized)
        protected = re.sub(r"[ \t]+", " ", protected)
        protected = re.sub(r"\n{3,}", "\n\n", protected)

        cleaned = "\n".join(line.rstrip() for line in protected.split("\n")).strip()

        for idx, block in enumerate(code_blocks):
            cleaned = cleaned.replace(f"__CODE_BLOCK_{idx}__", block)

        return cleaned
