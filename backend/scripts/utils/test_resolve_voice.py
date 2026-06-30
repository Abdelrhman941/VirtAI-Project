import os
import sys
from pathlib import Path

# Ensure the backend directory is in the path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.infrastructure.tts.openai_tts_provider import OpenAITTSProvider

print(f"resolve_voice('guy') = {OpenAITTSProvider.resolve_voice('guy')}")
print(f"resolve_voice('aria') = {OpenAITTSProvider.resolve_voice('aria')}")
print(f"resolve_voice('nova') = {OpenAITTSProvider.resolve_voice('nova')}")
print(f"resolve_voice('') = {OpenAITTSProvider.resolve_voice('')}")
print(f"resolve_voice(None) = {OpenAITTSProvider.resolve_voice(None)}")
