#!/bin/bash
# Compatibility wrapper for clean.py
python3 "$(dirname "$0")/clean.py" "$@"

# Direct fallback cleanup of cache folders
find "$(dirname "$0")/.." -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -exec rm -rf {} + 2>/dev/null || true
