#!/bin/bash
set -e

# Fix permissions for runtime mounted volumes
mkdir -p /app/.data/sessions /app/.data/uploads /app/.cache /app/models

# Chown everything in .data and .cache and models to appuser
chown -R appuser:appuser /app/.data
chown -R appuser:appuser /app/.cache
chown -R appuser:appuser /app/models

# Execute the passed container command via gosu to drop privileges gracefully
exec gosu appuser "$@"
