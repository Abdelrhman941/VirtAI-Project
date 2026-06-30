from dataclasses import dataclass
from typing import Any

from app.domain.rag.task_types import Locale


@dataclass(frozen=True)
class Citation:
    source: str
    page: str | None
    section: str | None


def build_citations(chunks: list[Any]) -> list[Citation]:
    """Builds a deduplicated list of citations from DocumentChunks or RetrievedDocuments."""
    citations = []
    seen = set()
    for chunk in chunks:
        meta = getattr(chunk, "metadata", {}) or {}
        source = meta.get("filename") or meta.get("source") or "Unknown"

        page = meta.get("page")
        page_str = str(page) if page is not None else None

        section = meta.get("section")
        section_str = str(section) if section is not None else None

        cit = Citation(source=str(source), page=page_str, section=section_str)
        if cit not in seen:
            seen.add(cit)
            citations.append(cit)

    return citations


def format_sources_block(citations: list[Citation], locale: Locale) -> str:
    """Formats the citations block in the requested locale."""
    if not citations:
        return ""

    is_arabic = locale == Locale.AR
    heading = "\n\n---\n### 📌 المصادر" if is_arabic else "\n\n---\n### 📌 Sources"

    lines = []
    for cit in citations:
        parts = []
        if cit.source and cit.source != "Unknown":
            parts.append(f"**{cit.source}**")

        if cit.page:
            label = "صفحة" if is_arabic else "Page"
            parts.append(f"{label} {cit.page}")

        if cit.section:
            label = "قسم" if is_arabic else "Section"
            parts.append(f"{label}: *{cit.section}*")

        if parts:
            lines.append("- " + " · ".join(parts))

    if not lines:
        return ""

    return heading + "\n" + "\n".join(lines)
