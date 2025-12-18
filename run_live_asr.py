import yaml
import logging
import os
import numpy as np
from dotenv import load_dotenv

# Libraries for fixing Arabic text display in Windows Console
import arabic_reshaper
from bidi.algorithm import get_display

# Load environment variables
load_dotenv()

# Import our custom modules
from src.audio.microphone import MicrophoneStream
from src.vad.simple_vad import VoiceActivityDetector
from src.asr.whisper_model import WhisperASR
from src.asr.asr_handler import ASRHandler
from src.core.event_bus import EventBus

# Configure Logging
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def load_config(path="configs/asr.yaml"):
    """Load YAML configuration safely."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        logger.error(f"Config file not found at {path}")
        raise

def main():
    # 1. Load Configuration
    config = load_config()
    
    # 2. Initialize Components
    logger.info("🚀 Initializing ASR System...")
    
    # Event Bus (The Messenger)
    bus = EventBus()
    
    # --- Callback function to handle ASR results ---
    def on_asr_result(result):
        if result:
            text = result.get('text', '')
            
            # Fix Arabic display for Windows Console (RTL & Joining)
            try:
                reshaped_text = arabic_reshaper.reshape(text)    # Connect Arabic letters
                bidi_text = get_display(reshaped_text)           # Correct direction (RTL)
                
                print(f"\n✨ Final Result: {bidi_text}")
            except Exception:
                # Fallback if libraries fail
                print(f"\n✨ Final Result: {text}")
                
            print("-" * 30)
    
    # Subscribe to the event
    bus.subscribe("asr_result", on_asr_result)

    # Initialize VAD (Voice Activity Detector)
    vad = VoiceActivityDetector(config)
    
    # Initialize ASR Model (Whisper)
    whisper_engine = WhisperASR(config)
    
    # Initialize ASR Handler (Logic Bridge)
    asr_handler = ASRHandler(whisper_engine, language=os.getenv("ASR_LANGUAGE", "ar"))

    # Audio Settings from Config
    SAMPLE_RATE = config['asr']['audio']['sample_rate']
    CHUNK_SIZE = config['asr']['audio']['chunk_size']
    
    # VAD Logic Variables
    frames = []
    is_speaking = False
    silence_chunks = 0
    
    # Calculate silence duration logic
    # How many milliseconds is one chunk?
    chunk_duration_ms = (CHUNK_SIZE / SAMPLE_RATE) * 1000
    
    # How many chunks of silence equate to the configured 'min_silence_duration'?
    max_silence_chunks = config['asr']['vad']['min_silence_duration_ms'] / chunk_duration_ms

    logger.info("🎤 Listening... (Press Ctrl+C to stop)")

    # 3. Start Microphone Stream
    try:
        with MicrophoneStream(rate=SAMPLE_RATE, chunk=CHUNK_SIZE) as stream:
            for audio_chunk in stream.generator():
                
                # --- Voice Activity Detection ---
                
                # Convert bytes to float32 for Silero VAD input
                audio_float = np.frombuffer(audio_chunk, np.int16).astype(np.float32) / 32768.0
                
                if vad.is_speech(audio_float):
                    # Speech detected!
                    if not is_speaking:
                        print("🗣️", end="", flush=True) # Visual indicator
                        is_speaking = True
                    
                    silence_chunks = 0
                    frames.append(audio_chunk)
                
                else:
                    # Silence detected
                    if is_speaking:
                        frames.append(audio_chunk) # Keep context (trailing silence)
                        silence_chunks += 1
                        
                        # Check if silence has exceeded the limit
                        if silence_chunks > max_silence_chunks:
                            print(" ✅ Processing...")
                            
                            # Combine frames and process
                            full_audio = b''.join(frames)
                            result = asr_handler.process(full_audio)
                            
                            # Publish result if valid
                            if result:
                                bus.publish("asr_result", result)
                            
                            # Reset variables for next sentence
                            frames = []
                            is_speaking = False
                            silence_chunks = 0

    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping ASR System...")
    except Exception as e:
        logger.exception(f"❌ Critical Error: {e}")

if __name__ == "__main__":
    main()