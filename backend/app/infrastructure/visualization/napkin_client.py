import asyncio
import os
import time

import httpx
from loguru import logger

from app.domain.rag.ports import VisualizationProviderPort


class NapkinClient(VisualizationProviderPort):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("NAPKIN_API_KEY")
        self.base_url = "https://api.napkin.ai/v1"
        self.timeout_seconds = 60

    async def generate_diagram(self, text: str) -> dict[str, str | bool]:
        if not self.api_key:
            logger.warning("Napkin API key not found. Sentinel degradation triggered.")
            return {"unavailable": True, "reason": "not_configured"}

        if not text.strip():
            return {"unavailable": True, "reason": "empty_text"}

        start_time = time.time()

        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            # Step 1: Submit job
            try:
                payload = {"content": text, "format": "png"}
                response = await client.post(
                    f"{self.base_url}/visual", json=payload, headers=headers, timeout=20.0
                )

                if response.status_code == 429:
                    return {"unavailable": True, "reason": "quota_exceeded"}

                response.raise_for_status()
                task_data = response.json()
                task_id = task_data.get("id")

                if not task_id:
                    return {"unavailable": True, "reason": "unknown_format"}

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    return {"unavailable": True, "reason": "quota_exceeded"}
                logger.error(f"Napkin API error: {e.response.text}")
                return {"unavailable": True, "reason": "api_error"}
            except Exception as e:
                logger.error(f"Napkin request failed: {e}")
                return {"unavailable": True, "reason": "request_failed"}

            # Step 2: Poll for completion
            while time.time() - start_time < self.timeout_seconds:
                try:
                    poll_res = await client.get(
                        f"{self.base_url}/visual/{task_id}/status", headers=headers, timeout=10.0
                    )

                    if poll_res.status_code == 429:
                        return {"unavailable": True, "reason": "quota_exceeded"}

                    poll_res.raise_for_status()
                    poll_data = poll_res.json()

                    status = poll_data.get("status")
                    if status == "completed":
                        generated_files = poll_data.get("generated_files", [])
                        if generated_files and len(generated_files) > 0:
                            img_url = generated_files[0].get("url")
                            if img_url:
                                return {"image_url": img_url}
                        return {"unavailable": True, "reason": "missing_image_url"}
                    elif status in ("failed", "error"):
                        return {"unavailable": True, "reason": "generation_failed"}

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        return {"unavailable": True, "reason": "quota_exceeded"}
                    logger.error(f"Napkin polling error: {e.response.text}")
                except Exception as e:
                    logger.error(f"Napkin polling failed: {e}")

                # CRITICAL: non-blocking sleep
                await asyncio.sleep(3)

        logger.warning("Napkin API polling timed out.")
        return {"unavailable": True, "reason": "timeout"}
