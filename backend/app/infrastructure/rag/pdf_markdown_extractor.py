"""
PDF-to-Markdown extraction using PyMuPDF (fitz).

Extracted from RAG_project's ProcessController — this module handles
ONLY the PDF→Markdown conversion with intelligent structure detection:
- Heading detection (font size + title-case heuristics)
- Table extraction (fitz table finder → Markdown)
- Code line detection (monospace fonts)
- List item normalization
- OCR fallback for scanned pages (optional, requires pytesseract + poppler)

The resulting Markdown pages can be fed to ``SmartChunker`` for chunking.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path

from loguru import logger

from app.domain.rag.ports import DocumentParser

try:
    import fitz  # PyMuPDF

    # Suppress non-fatal MuPDF structure warnings (e.g. "No common ancestor in structure tree")
    fitz.TOOLS.mupdf_display_errors(False)
except ImportError:
    fitz = None
    logger.warning("PyMuPDF (fitz) not installed — PDF markdown extraction unavailable")


# ── OCR dependencies are optional ────────────────────────────────────────
_HAS_OCR = False
try:
    import pytesseract
    from pdf2image import convert_from_path  # type: ignore[import-not-found]

    _HAS_OCR = True
except ImportError:
    pytesseract = None
    convert_from_path = None
    pass


@dataclass
class ExtractedPage:
    """A single page of extracted markdown content with metadata."""

    page_content: str
    metadata: dict = field(default_factory=dict)


class PDFMarkdownExtractor(DocumentParser):
    """
    Extracts structured Markdown from PDF files using PyMuPDF.

    Falls back to OCR for pages where fitz extraction yields < 50 chars
    (typically scanned pages). OCR requires ``pytesseract`` and ``poppler``
    system packages — if unavailable, scanned pages are silently skipped.

    Usage::

        extractor = PDFMarkdownExtractor()
        pages = extractor.extract(file_path="/path/to/doc.pdf")
        for page in pages:
            print(page.page_content)
    """

    def extract(self, file_path: str) -> list[ExtractedPage]:
        """Extract all pages from a PDF as Markdown."""
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is required for PDF extraction")

        doc = fitz.open(file_path)
        pages: list[ExtractedPage] = []

        try:
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_md = self._extract_page_markdown(page)
                cleaned = self._clean_markdown_text(page_md)

                # OCR fallback for scanned/image pages
                if len(cleaned.strip()) < 30:
                    if _HAS_OCR:
                        logger.debug(f"Page {page_index + 1}: <30 chars — running OCR fallback")
                        cleaned = self._extract_page_via_ocr(file_path, page_index + 1)
                    else:
                        logger.debug(
                            f"Page {page_index + 1}: <30 chars — OCR unavailable, skipping"
                        )

                if not cleaned.strip():
                    continue

                pages.append(
                    ExtractedPage(
                        page_content=cleaned,
                        metadata={
                            "page": page_index + 1,
                            "source": Path(file_path).name,
                        },
                    )
                )
        finally:
            doc.close()

        return pages

    async def parse(self, file_path: str, file_type: str) -> str:
        """Implements DocumentParser.parse — offloads blocking extraction to a thread."""
        import anyio

        pages = await anyio.to_thread.run_sync(self.extract, file_path)
        return "\n\n".join(page.page_content for page in pages)

    async def parse_bytes(self, data: bytes, file_type: str) -> str:
        """Implements DocumentParser.parse_bytes"""
        import os
        import tempfile

        import mimetypes
        ext = mimetypes.guess_extension(file_type) or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            return await self.parse(tmp_path, file_type)
        finally:
            os.remove(tmp_path)

    # ── Page-level extraction ────────────────────────────────────────────

    def _extract_page_markdown(self, page) -> str:
        """Convert a single fitz page to Markdown."""
        page_dict = page.get_text("dict", sort=True)
        blocks = page_dict.get("blocks", [])
        body_font_size = self._estimate_body_font_size(blocks)

        table_blocks = self._extract_tables_from_page(page)

        markdown_lines: list[str] = []
        emitted_table_ids: set = set()

        for block in blocks:
            block_bbox = tuple(block.get("bbox", (0, 0, 0, 0)))

            # Check if this block overlaps with a detected table
            table_match = self._get_table_for_bbox(block_bbox, table_blocks)
            if table_match:
                table_id, table_text = table_match
                if table_id not in emitted_table_ids:
                    markdown_lines.extend(["", table_text.strip(), ""])
                    emitted_table_ids.add(table_id)
                continue

            line_texts: list[str] = []
            for line in block.get("lines", []):
                text, max_font_size, font_names = self._extract_line_properties(line)
                if not text:
                    continue

                normalized = self._normalize_line(text, max_font_size, font_names, body_font_size)
                line_texts.append(normalized)

            if line_texts:
                markdown_lines.append("\n".join(line_texts))

        # Emit any remaining tables not matched to blocks
        for table_id, table_text in table_blocks:
            if table_id not in emitted_table_ids:
                markdown_lines.extend(["", table_text.strip(), ""])

        # Image extraction has been disabled for PDFs.
        # Relying solely on text extraction and Tesseract OCR fallback for scanned pages.

        return "\n".join(markdown_lines)

    # ── Table extraction ─────────────────────────────────────────────────

    @staticmethod
    def _extract_tables_from_page(page) -> list[tuple[tuple, str]]:
        try:
            table_finder = page.find_tables()
            raw_tables = getattr(table_finder, "tables", table_finder)
            return [
                (tuple(t.bbox), t.to_markdown().strip())
                for t in raw_tables
                if t.to_markdown().strip()
            ]
        except Exception:
            return []

    @staticmethod
    def _get_table_for_bbox(bbox, tables):
        for table_bbox, table_text in tables:
            if PDFMarkdownExtractor._boxes_overlap(bbox, table_bbox):
                return table_bbox, table_text
        return None

    @staticmethod
    def _boxes_overlap(a, b) -> bool:
        overlap_x = max(0, min(a[2], b[2]) - max(a[0], b[0]))
        overlap_y = max(0, min(a[3], b[3]) - max(a[1], b[1]))
        return overlap_x > 0 and overlap_y > 0

    # ── Font analysis ────────────────────────────────────────────────────

    @staticmethod
    def _estimate_body_font_size(blocks: list[dict]) -> float:
        sizes = [
            float(span.get("size", 0))
            for block in blocks
            for line in block.get("lines", [])
            for span in line.get("spans", [])
            if span.get("text", "").strip()
        ]
        return statistics.median(sizes) if sizes else 11.0

    @staticmethod
    def _extract_line_properties(line: dict) -> tuple[str, float, list[str]]:
        spans = line.get("spans", [])
        text_parts, max_size, font_names = [], 0.0, []

        for span in spans:
            span_text = span.get("text", "")
            if not span_text:
                continue
            text_parts.append(span_text)
            max_size = max(max_size, float(span.get("size", 0)))
            font_names.append((span.get("font", "") or "").lower())

        text = re.sub(r"\s+", " ", "".join(text_parts)).strip()
        return text, max_size, font_names

    # ── Line normalization ───────────────────────────────────────────────

    def _normalize_line(
        self,
        line_text: str,
        max_font_size: float,
        font_names: list[str],
        body_font_size: float,
    ) -> str:
        text = line_text.strip()
        if not text:
            return ""

        if self._is_list_item(text):
            return self._normalize_list_item(text)
        if self._is_heading(text, max_font_size, body_font_size):
            return f"## {text.lstrip('#').strip()}"
        if self._is_code_line(text, font_names):
            return f"`{text}`"
        return text

    @staticmethod
    def _is_heading(text: str, max_font_size: float, body_font_size: float) -> bool:
        if text.startswith("#"):
            return True
        if len(text) > 120:
            return False
        looks_title = bool(re.match(r"^([A-Z][^\n.]{2,})$", text))
        looks_numbered = bool(re.match(r"^\d+(\.\d+)*\s+[A-Za-z].*", text))
        return max_font_size >= body_font_size + 1.25 or looks_title or looks_numbered

    @staticmethod
    def _is_list_item(text: str) -> bool:
        return bool(re.match(r"^([-*+\u2022\u25E6\u25AA\u2023]|\d+[.)])\s+", text))

    @staticmethod
    def _normalize_list_item(text: str) -> str:
        return re.sub(r"^([-*+\u2022\u25E6\u25AA\u2023]|\d+[.)])\s+", "- ", text)

    @staticmethod
    def _is_code_line(text: str, font_names: list[str]) -> bool:
        if not font_names:
            return False
        is_mono = any("courier" in n or "mono" in n for n in font_names)
        return is_mono and bool(re.search(r"[{}();=<>]|^\s{2,}", text))

    # ── Markdown cleanup ─────────────────────────────────────────────────

    @staticmethod
    def _clean_markdown_text(text: str) -> str:
        """Normalize whitespace while preserving code blocks."""
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")

        # Protect code blocks from whitespace normalization
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

    # ── OCR fallback ─────────────────────────────────────────────────────

    @staticmethod
    def _extract_page_via_ocr(file_path: str, page_number: int) -> str:
        """Run Tesseract OCR on a single PDF page (optional dependency)."""
        if not _HAS_OCR or not convert_from_path or not pytesseract:
            return ""
        try:
            images = convert_from_path(file_path, first_page=page_number, last_page=page_number)
            try:
                parts = [pytesseract.image_to_string(img, lang="eng+ara") for img in images]
            except Exception as e:
                logger.warning(f"OCR failed for eng+ara on page {page_number}, falling back to eng: {e}")
                parts = [pytesseract.image_to_string(img, lang="eng") for img in images]
            return "\n\n".join(p for p in parts if p.strip())
        except Exception as e:
            logger.warning(f"OCR failed for page {page_number}: {e}")
            return ""
