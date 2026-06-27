import anyio
from loguru import logger
from app.domain.rag.ports import DocumentParser

class TextExtractor(DocumentParser):
    """
    Extracts raw text from text files (txt, md, csv, etc).
    """

    async def parse(self, file_path: str, file_type: str) -> str:
        """Reads a text file asynchronously."""
        try:
            return await anyio.Path(file_path).read_text(encoding="utf-8")
        except UnicodeDecodeError:
            logger.warning(f"UTF-8 decode failed for {file_path}, trying latin-1")
            return await anyio.Path(file_path).read_text(encoding="latin-1")

    async def parse_bytes(self, data: bytes, file_type: str) -> str:
        """Decodes raw bytes."""
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            logger.warning("UTF-8 decode failed for bytes, trying latin-1")
            return data.decode("latin-1", errors="replace")
