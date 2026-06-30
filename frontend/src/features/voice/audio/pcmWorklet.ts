/**
 * AudioWorkletProcessor for low-latency PCM audio capture
 *
 * Runs on the audio rendering thread to capture microphone input
 * and send Float32Array chunks to the main thread for PCM conversion.
 *
 * Requirements: 2.1 - Capture raw PCM audio using AudioWorklet
 */
declare var AudioWorkletProcessor: any;
declare function registerProcessor(name: string, processorCtor: any): void;

class PCMWorkletProcessor extends AudioWorkletProcessor {
  port: any;
  targetChunkSize: number;
  buffer: number[];

  constructor() {
    super();

    // Target chunk size: 250ms at 16kHz = 4000 samples
    // Using 250ms chunks ensures we send 4 chunks/sec, well below the 25 chunks/sec limit
    this.targetChunkSize = 4000;

    // Accumulation buffer for samples
    this.buffer = [];

    // Handle flush messages from main thread
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'flush') {
        if (this.buffer.length > 0) {
          const chunk = new Float32Array(this.buffer);
          this.port.postMessage(chunk);
          this.buffer = [];
        }
      }
    };
  }

  /**
   * Process audio samples from microphone input
   *
   * Called by the audio system for each render quantum (128 samples at any sample rate).
   * Accumulates samples until target chunk size is reached, then sends to main thread.
   *
   * @param inputs - Input audio data [input][channel][sample]
   * @param _outputs - Output audio data (unused)
   * @param _parameters - Audio parameters (unused)
   * @returns true to keep processor alive
   */
  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    // Get first input (microphone)
    const input = inputs[0];

    // If no input or no channels, skip this quantum
    if (!input || input.length === 0) {
      return true;
    }

    // Get first channel (mono audio)
    const channelData = input[0];

    // Accumulate samples
    for (let i = 0; i < channelData.length; i++) {
      this.buffer.push(channelData[i]);
    }

    // Send chunk when target size reached
    if (this.buffer.length >= this.targetChunkSize) {
      // Create Float32Array from accumulated samples
      const chunk = new Float32Array(this.buffer);

      // Send to main thread
      this.port.postMessage(chunk);

      // Clear buffer
      this.buffer = [];
    }

    // Keep processor alive
    return true;
  }
}

// Register the processor
registerProcessor('pcm-worklet-processor', PCMWorkletProcessor);
