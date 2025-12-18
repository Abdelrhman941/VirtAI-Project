from faster_whisper import WhisperModel
import os
import logging

logger = logging.getLogger(__name__)

class WhisperASR:
    def __init__(self, config=None):
        """
        Initializes the Whisper model.
        Args:
            config (dict): Configuration dictionary (optional).
        """
        if config is None:
            config = {}

        # Load settings structure matching YAML
        asr_section = config.get('asr', config) 
        model_section = asr_section.get('model', {})

        self.model_size = model_section.get("model_size", os.getenv("ASR_MODEL_SIZE", "base"))
        self.device = model_section.get("device", os.getenv("ASR_DEVICE", "cpu"))
        self.compute_type = model_section.get("compute_type", os.getenv("ASR_COMPUTE_TYPE", "int8"))
        
        logger.info(f"⏳ Loading Whisper Model: {self.model_size} ({self.device}/{self.compute_type})...")
        
        try:
            self.model = WhisperModel(
                model_size_or_path=self.model_size,
                device=self.device,
                compute_type=self.compute_type
            )
            logger.info("✅ Whisper Model loaded successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise e

    def transcribe(self, audio_array, language=None, **kwargs):
        """
        Transcribes the given audio array.
        """
        try:
            # 1. Extract beam_size to avoid duplication
            beam_size = kwargs.pop('beam_size', 5)

            # 2. Settings to prevent hallucination and improve Arabic accuracy
            # This custom prompt informs the model about the expected context (Technical & General Arabic)
            custom_prompt = "السلام عليكم، هذا حوار تقني وعام باللغة العربية الفصحى والعامية."
            
            # Run transcription with the optimized settings
            segments, info = self.model.transcribe(
                audio_array,
                beam_size=beam_size,
                language=language,
                initial_prompt=custom_prompt,     # ✅ Provide context to the model
                condition_on_previous_text=False, # ✅ Prevents repetition of incorrect text loops
                no_speech_threshold=0.6,          # ✅ Rejects audio if it looks like noise/silence
                **kwargs
            )

            # Convert the segments generator to a list
            segments_list = list(segments)

            return segments_list, info

        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            return [], None