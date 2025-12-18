import pyaudio
import queue
import logging

# إعداد اللوج لمعرفة حالة المايكروفون
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MicrophoneStream:
    """
    Opens a recording stream as a generator yielding the audio chunks.
    Uses a Queue to ensure no audio is lost while the AI processes data.
    """
    def __init__(self, rate=16000, chunk=1024, device_index=None):
        self.rate = rate
        self.chunk = chunk
        self.device_index = device_index
        self.buff = queue.Queue()
        self.closed = True
        self.audio_interface = None
        self.audio_stream = None

    def __enter__(self):
        """Start the stream when entering 'with' block."""
        self.audio_interface = pyaudio.PyAudio()
        
        try:
            self.audio_stream = self.audio_interface.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.rate,
                input=True,
                frames_per_buffer=self.chunk,
                input_device_index=self.device_index,
                stream_callback=self._fill_buffer,
            )
            self.closed = False
            logger.info(f"🎤 Microphone stream started. Rate: {self.rate}, Chunk: {self.chunk}")
            return self
        except Exception as e:
            logger.error(f"❌ Could not open microphone stream: {e}")
            self.close()
            raise

    def __exit__(self, type, value, traceback):
        """Clean up when exiting."""
        self.close()

    def _fill_buffer(self, in_data, frame_count, time_info, status_flags):
        """Callback: Runs in background thread to collect audio."""
        self.buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        """Yields audio chunks from the buffer one by one."""
        while not self.closed:
            # Use a blocking get() to ensure there's at least one chunk of data
            chunk = self.buff.get()
            if chunk is None:
                return
            data = [chunk]

            # Collect any other queued chunks (to reduce latency)
            while True:
                try:
                    chunk = self.buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break

            yield b"".join(data)

    def close(self):
        """Closes the stream and releases resources."""
        if not self.closed:
            self.closed = True
            self.buff.put(None) # Signal generator to stop
            
            if self.audio_stream:
                self.audio_stream.stop_stream()
                self.audio_stream.close()
            
            if self.audio_interface:
                self.audio_interface.terminate()
            
            logger.info("🛑 Microphone stream closed.")