import asyncio

from loguru import logger


def _pipeline_task_done_callback(task: asyncio.Task) -> None:
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error(f"Pipeline task raised unhandled exception: {exc!r}")


class PipelineBridge:
    """Bridges the WebSocket connection with the ConversationPipeline."""

    def __init__(self, context):
        """
        context must provide:
        - session, _session_pending, _connected
        - pipeline
        - _safe_send, _send (from OutboundSender)
        - _send_protocol_message (from OutboundSender)
        """
        self.ctx = context
        self.pipeline_task: asyncio.Task | None = None

    async def cancel_pipeline(self) -> None:
        """Cancel any running pipeline task and wait for it to stop."""
        if self.pipeline_task and not self.pipeline_task.done():
            if self.ctx.pipeline is not None:
                self.ctx.pipeline.abort()
            self.pipeline_task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(self.pipeline_task), timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                pass
            logger.debug("Pipeline task cancelled")
        self.pipeline_task = None
