FROM ghcr.io/matatonic/openedai-speech:latest

# Pre-download voices during build to ensure immutable infrastructure
RUN ./download_voices_tts-1.sh && ./download_voices_tts-1-hd.sh

# Provide the voices to the runtime by keeping them in the image layer
ENV TTS_HOME=/app/voices
ENV HF_HOME=/app/voices/huggingface
