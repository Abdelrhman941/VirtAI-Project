from dataclasses import dataclass

from app.domain.rag.citation import Citation, build_citations, format_sources_block
from app.domain.rag.task_types import Locale


@dataclass
class DummyChunk:
    metadata: dict


def test_build_citations():
    chunks = [
        DummyChunk(metadata={"source": "doc1.pdf", "page": 1, "section": "intro"}),
        DummyChunk(metadata={"source": "doc1.pdf", "page": 1, "section": "intro"}),  # Duplicate
        DummyChunk(metadata={"filename": "doc2.pdf", "page": "2"}),
        DummyChunk(metadata={}),
    ]

    citations = build_citations(chunks)
    assert len(citations) == 3
    assert citations[0] == Citation(source="doc1.pdf", page="1", section="intro")
    assert citations[1] == Citation(source="doc2.pdf", page="2", section=None)
    assert citations[2] == Citation(source="Unknown", page=None, section=None)


def test_format_sources_block():
    citations = [
        Citation(source="doc1.pdf", page="1", section="intro"),
        Citation(
            source="Unknown", page=None, section=None
        ),  # Should produce empty parts -> no line
    ]

    en_block = format_sources_block(citations, Locale.EN)
    assert "### 📌 Sources" in en_block
    assert "**doc1.pdf**" in en_block
    assert "Page 1" in en_block
    assert "Section: *intro*" in en_block
    assert "Unknown" not in en_block

    ar_block = format_sources_block(citations, Locale.AR)
    assert "### 📌 المصادر" in ar_block
    assert "صفحة 1" in ar_block
    assert "قسم: *intro*" in ar_block
