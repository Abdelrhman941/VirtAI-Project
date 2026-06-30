"""
Viseme Timeline Generator

Generates phoneme-to-viseme timelines for lip synchronization using audio amplitude analysis.

Key Features:
- Amplitude-based mouth cue generation from audio waveform
- Returns MouthCue objects compatible with RPM morph targets
"""

import asyncio
import os
import re

from loguru import logger

from app.schemas.ws_messages import MouthCue


class VisemeGenerator:
    """
    Generates viseme timeline from audio using amplitude envelope analysis.

    Analyzes audio amplitude to produce mouth open/close cues
    synchronized with speech peaks.
    """

    def __init__(self) -> None:
        try:
            import numpy  # noqa: F401
            import pydub  # noqa: F401
        except ImportError as e:
            raise RuntimeError(f"VisemeGenerator requires numpy and pydub: {e}") from e

    def _generate_cues(self, audio_path: str) -> list[MouthCue]:
        """
        Generate mouth cues from audio amplitude envelope.

        Creates open/close mouth movements synchronized with audio peaks.

        Args:
            audio_path: Path to audio file (.pcm raw Int16 LE 24kHz mono, or other pydub-supported format)

        Returns:
            List of MouthCue objects with viseme patterns
        """
        try:
            import numpy as np
            from pydub import AudioSegment

            # Load audio file.
            # For raw PCM (Int16 LE, 24 kHz, mono) pydub cannot detect the format
            # from the file header because there is no header.  Use from_raw() instead.
            ext = os.path.splitext(audio_path)[1].lower()
            if ext == ".pcm":
                with open(audio_path, "rb") as f:
                    raw_data = f.read()
                audio = AudioSegment(
                    data=raw_data,
                    sample_width=2,   # Int16 = 2 bytes
                    frame_rate=24000, # 24 kHz
                    channels=1,       # mono
                )
            else:
                audio = AudioSegment.from_file(audio_path)

            # Convert to mono and get raw samples
            audio = audio.set_channels(1)
            samples = np.array(audio.get_array_of_samples(), dtype=np.float64)
            frame_rate = audio.frame_rate

            # Handle very short audio
            if len(samples) < 10:
                logger.warning(f"Audio too short for cue generation: {len(samples)} samples")
                return []

            # Calculate amplitude envelope (RMS in 50ms windows)
            window_size = int(frame_rate * 0.05)  # 50ms windows
            hop_size = int(frame_rate * 0.02)  # 20ms hop (overlap)

            # Adjust window size for short audio
            if window_size > len(samples):
                window_size = max(10, len(samples) // 4)
                hop_size = max(1, window_size // 4)

            if hop_size < 1:
                hop_size = 1

            envelope = []
            i = 0
            while i + window_size <= len(samples):
                window = samples[i : i + window_size]
                rms = np.sqrt(np.mean(window**2))
                envelope.append(rms)
                i += hop_size

            # Handle case where no windows were processed
            if len(envelope) == 0:
                if len(samples) > 0:
                    rms = np.sqrt(np.mean(samples**2))
                    envelope = [rms]
                    window_size = len(samples)
                    hop_size = len(samples)
                else:
                    logger.warning(f"No envelope data generated for audio: {audio_path}")
                    return []

            # Normalize envelope to 0-1
            max_rms = np.max(envelope)
            if max_rms > 0:
                envelope = [e / max_rms for e in envelope]
            else:
                logger.warning(f"Audio contains only silence: {audio_path}")
                return []

            # Generate mouth cues based on amplitude threshold
            mouth_cues = []
            threshold = 0.15  # Amplitude threshold for mouth open

            is_open = False
            start_time = 0.0

            for idx, amplitude in enumerate(envelope):
                time = idx * (hop_size / frame_rate)  # Convert to seconds

                if amplitude > threshold and not is_open:
                    start_time = time
                    is_open = True
                elif amplitude <= threshold and is_open:
                    mouth_cues.append(MouthCue(start=start_time, end=time, value="viseme_aa"))
                    is_open = False

            # Close final cue if still open
            if is_open:
                duration = len(audio) / 1000.0  # pydub duration in ms -> seconds
                mouth_cues.append(MouthCue(start=start_time, end=duration, value="viseme_aa"))

            logger.info(f"Generated mouth cues | cues={len(mouth_cues)} | audio={audio_path}")

            return mouth_cues

        except ImportError as e:
            logger.warning(f"Cue generation requires numpy and pydub: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to generate cues: {e}")
            return []

    def _validate_path_component(self, component: str) -> bool:
        """
        Validate path component for security (prevent directory traversal).

        Returns:
            True if safe, False otherwise
        """
        if not component:
            return False
        if ".." in component or "/" in component or "\\" in component:
            return False
        if not re.match(r"^[a-zA-Z0-9_-]+$", component):
            return False
        return True

    async def generate_from_audio(
        self, audio_path: str, text: str, session_id: str, message_id: str
    ) -> list[MouthCue]:
        """
        Generate viseme timeline from audio file.

        This is the main entry point for viseme generation.
        Uses amplitude envelope analysis to produce mouth cues.

        Args:
            audio_path: Path to audio file (MP3)
            text: Spoken text (unused, kept for API compatibility)
            session_id: Session identifier
            message_id: Message identifier

        Returns:
            List of MouthCue objects sorted by start time
        """
        # Validate session_id and message_id
        if not self._validate_path_component(session_id):
            logger.error(f"Invalid session_id: {session_id}")
            return []
        if not self._validate_path_component(message_id):
            logger.error(f"Invalid message_id: {message_id}")
            return []

        # Verify audio file exists
        if not os.path.isfile(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return []

        return await asyncio.to_thread(self._generate_cues, audio_path)
