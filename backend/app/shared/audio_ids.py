import re

from app.shared.ids import parse_uuid

VALID_AUDIO_VOICE_SUFFIXES = {
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "fable",
    "marin",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
}


def is_safe_path_component(component: str) -> bool:
    if not component:
        return False
    if ".." in component or "/" in component or "\\" in component:
        return False
    return re.match(r"^[a-zA-Z0-9_-]+$", component) is not None


def is_valid_audio_message_id(message_id: str) -> bool:
    if not is_safe_path_component(message_id):
        return False

    parts = message_id.split("_")
    if not parts:
        return False
    if parts[0] == "filler":
        return len(parts) >= 2 and parts[1].isdigit()
    if parse_uuid(parts[0]) is None:
        return False
    if len(parts) == 1:
        return True
    if len(parts) == 2:
        return parts[1].isdigit() or parts[1] in VALID_AUDIO_VOICE_SUFFIXES
    if len(parts) == 3:
        return parts[1].isdigit() and parts[2] in VALID_AUDIO_VOICE_SUFFIXES
    return False
