import contextvars
import uuid

# Context variable to hold the trace/request ID
trace_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("trace_id", default="-")


def get_trace_id() -> str:
    """Get the current trace ID."""
    return trace_id_var.get()


def set_trace_id(trace_id: str | None = None) -> str:
    """Set the current trace ID. Generates a new UUID if none is provided."""
    if not trace_id:
        trace_id = str(uuid.uuid4())
    trace_id_var.set(trace_id)
    return trace_id
