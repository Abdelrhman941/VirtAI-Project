import base64
import io
from loguru import logger
from app.domain.rag.ports import DocumentParser, VisionPort

class ImageMarkdownExtractor(DocumentParser):
    def __init__(self, vision_provider: VisionPort):
        self.vision_provider = vision_provider

    async def parse_bytes(self, file_bytes: bytes, file_type: str) -> str:
        # Determine extension from mime type
        ext = file_type.split("/")[-1] if "/" in file_type else "jpeg"
        b64 = base64.b64encode(file_bytes).decode("ascii")
        markdown = []
        
        # 1. OCR text extraction
        try:
            import pytesseract
            import anyio
            from PIL import Image
            img = Image.open(io.BytesIO(file_bytes))
            try:
                ocr_text = await anyio.to_thread.run_sync(
                    lambda: pytesseract.image_to_string(img, lang="eng+ara")
                )
            except Exception as e:
                logger.warning(f"OCR eng+ara failed, falling back to eng: {e}")
                ocr_text = await anyio.to_thread.run_sync(
                    lambda: pytesseract.image_to_string(img, lang="eng")
                )
                
            if ocr_text.strip():
                markdown.append(ocr_text.strip())
        except Exception as e:
            logger.warning(f"OCR completely failed on standalone image: {e}")
            
        # 2. Vision text extraction
        try:
            descriptions = await self.vision_provider.describe_batch([file_bytes])
            if descriptions and descriptions[0]:
                markdown.append(f"\n[Visual content: {descriptions[0]}]\n")
        except Exception as e:
            logger.warning(f"Vision extraction failed: {e}")
            
        return "\n\n".join(markdown)
