import torch
import logging
import numpy as np

logger = logging.getLogger(__name__)

class VoiceActivityDetector:
    def __init__(self, config):
        """
        Initialize Silero VAD model using settings from config.
        """
        # Load settings from asr.yaml
        self.threshold = config['asr']['vad']['threshold']
        self.sample_rate = config['asr']['audio']['sample_rate']
        
        logger.info(f"🧠 Loading Silero VAD (Threshold: {self.threshold})...")
        
        try:
            # Load pre-trained Silero VAD model from PyTorch Hub
            # This is much smarter than simple volume detection
            self.model, utils = torch.hub.load(
                repo_or_dir='snakers4/silero-vad',
                model='silero_vad',
                force_reload=False,
                trust_repo=True
            )
            self.model.eval()  # Optimization mode
            logger.info("✅ Silero VAD loaded successfully.")
            
        except Exception as e:
            logger.error(f"❌ Failed to load Silero VAD: {e}")
            raise

    def is_speech(self, audio_chunk):
        """
        AI-based check: Is this human speech?
        """
        try:
            # Convert numpy array to Tensor
            if not torch.is_tensor(audio_chunk):
                audio_tensor = torch.from_numpy(audio_chunk)
            else:
                audio_tensor = audio_chunk

            # Silero expects float32
            if audio_tensor.dtype != torch.float32:
                audio_tensor = audio_tensor.float()

            # Ensure correct shape [1, N]
            if audio_tensor.ndim == 1:
                audio_tensor = audio_tensor.unsqueeze(0)

            # Ignore extremely quiet chunks (absolute silence) to save CPU
            if torch.max(torch.abs(audio_tensor)) < 0.01:
                return False

            # Get probability of speech
            with torch.no_grad():
                speech_prob = self.model(audio_tensor, self.sample_rate).item()

            return speech_prob > self.threshold

        except Exception as e:
            # If error, fail safe (assume no speech)
            return False