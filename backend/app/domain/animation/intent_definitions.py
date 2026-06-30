"""Domain definitions for semantic animation intents."""

INTENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "question": ("?", "why", "how", "what", "when", "where", "which"),
    "emphasis": ("important", "must", "always", "never", "key", "critical"),
    "explanation": ("because", "therefore", "means", "for example", "step", "first"),
    "reassurance": ("don't worry", "it's okay", "you can", "great", "good job"),
    "transition": ("next", "then", "now", "finally", "also", "in addition"),
}
