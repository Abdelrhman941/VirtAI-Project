import asyncio
from loguru import logger
from google import genai
from google.genai import types

from app.domain.rag.ports import VisionPort

class GeminiVisionProvider(VisionPort):
    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def health_check(self) -> bool:
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=["Ping"]
            )
            return bool(response.text)
        except Exception:
            return False

    def _get_mime_type(self, img_bytes: bytes) -> str:
        if img_bytes.startswith(b"\xFF\xD8\xFF"): return "image/jpeg"
        if img_bytes.startswith(b"\x89PNG\r\n\x1a\n"): return "image/png"
        if img_bytes.startswith(b"RIFF") and b"WEBP" in img_bytes[:16]: return "image/webp"
        return "image/jpeg"

    async def describe(self, image_b64: str) -> str:
        import base64
        try:
            img_bytes = base64.b64decode(image_b64)
            mime_type = self._get_mime_type(img_bytes)
            part = types.Part.from_bytes(data=img_bytes, mime_type=mime_type)
            prompt = "Describe this image, diagram, or page in detail. Transcribe any significant text exactly."
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[part, prompt]
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini describe failed: {e}")
            raise

    async def describe_batch(self, images: list[bytes]) -> list[str]:
        if not images:
            return []
            
        sem = asyncio.Semaphore(5)  # Rate limit concurrent Gemini requests
        
        async def process_image(idx: int, img_bytes: bytes) -> tuple[int, str]:
            async with sem:
                try:
                    mime_type = self._get_mime_type(img_bytes)
                    part = types.Part.from_bytes(data=img_bytes, mime_type=mime_type)
                    prompt = "Describe this image, diagram, or page in detail. Transcribe any significant text exactly."
                    
                    response = await self.client.aio.models.generate_content(
                        model=self.model,
                        contents=[part, prompt]
                    )
                    return idx, response.text or ""
                except Exception as e:
                    logger.error(f"Gemini vision failed for image {idx}: {e}")
                    raise
                    
        tasks = [process_image(idx, img) for idx, img in enumerate(images)]
        results = await asyncio.gather(*tasks)
        
        # Sort by index to maintain original order
        results.sort(key=lambda x: x[0])
        return [desc for _, desc in results]
