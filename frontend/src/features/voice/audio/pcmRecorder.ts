/**
 * PCMRecorder - AudioContext + AudioWorklet based PCM audio capture
 *
 * Replaces MediaRecorder to capture raw PCM audio without WebM container headers.
 * Uses AudioContext with 16kHz sample rate and AudioWorklet for low-latency capture.
 * Converts Float32 samples to Int16 PCM and sends binary frames via WebSocket.
 *
 * Requirements: 2.1, 2.3, 2.4
 */

import { logger } from '@/shared/utils/logger';

/**
 * Callback type for PCM audio data
 * @param pcmData - Int16 PCM audio samples
 */
export type PCMDataCallback = (pcmData: Int16Array) => void;

/**
 * PCMRecorder configuration options
 */
export interface PCMRecorderOptions {
  /** Audio sample rate in Hz (default: 16000) */
  sampleRate?: number;
}

/**
 * PCMRecorder class for raw PCM audio capture
 *
 * Captures audio from microphone using AudioContext + AudioWorklet,
 * converts Float32 samples to Int16 PCM, and emits binary data chunks.
 *
 * This eliminates WebM container headers that cause concatenation bugs,
 * enabling safe byte-level concatenation of audio chunks on the backend.
 */
export class PCMRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onDataCallback: PCMDataCallback | null = null;
  private sampleRate: number;
  private isRecording: boolean = false;

  private static cachedWorkletUrl: string | null = null;
  private static cachedAudioContext: AudioContext | null = null;
  private static prewarmPromise: Promise<void> | null = null;

  /**
   * Pre-fetches the AudioWorklet script in the background and initializes AudioContext
   * to eliminate latency when the user first activates the microphone.
   */
  public static async preWarmWorklet(sampleRate: number = 16000): Promise<void> {
    if (this.cachedWorkletUrl || this.prewarmPromise) {
      return this.prewarmPromise || Promise.resolve();
    }
    
    this.prewarmPromise = (async () => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate });
        
        if (ctx.state === 'running') {
          await ctx.suspend();
        }
        
        const workletUrlModule = await import('./pcmWorklet.ts?url');
        this.cachedWorkletUrl = workletUrlModule.default;
        await ctx.audioWorklet.addModule(this.cachedWorkletUrl);
        
        this.cachedAudioContext = ctx;
        
        if (import.meta.env.DEV) {
          logger.debug('[PCMRecorder] AudioWorklet pre-warmed and compiled');
        }
      } catch (err) {
        logger.error('[PCMRecorder] Failed to prewarm worklet', err);
      }
    })();
    return this.prewarmPromise;
  }

  /**
   * Create a new PCMRecorder instance
   *
   * @param onData - Callback invoked with each Int16 PCM chunk
   * @param options - Optional configuration
   */
  constructor(onData: PCMDataCallback, options: PCMRecorderOptions = {}) {
    this.onDataCallback = onData;
    this.sampleRate = options.sampleRate || 16000;
  }

  /**
   * Start recording audio from microphone
   *
   * Initializes AudioContext with 16kHz sample rate, loads AudioWorklet processor,
   * connects microphone input, and starts capturing PCM audio.
   *
   * Requirements:
   * - 2.1: Use AudioContext + AudioWorklet to produce raw PCM audio (16kHz mono, 16-bit)
   * - 2.3: Capture audio without container headers for safe concatenation
   *
   * @throws Error if AudioContext initialization fails
   * @throws Error if microphone access is denied
   * @throws Error if AudioWorklet loading fails
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('[PCMRecorder] Already recording');
      return;
    }

    try {
      // Create AudioContext with target sample rate (Requirement 2.1)
      if (PCMRecorder.cachedAudioContext) {
        this.audioContext = PCMRecorder.cachedAudioContext;
        PCMRecorder.cachedAudioContext = null;
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      } else {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx({
          sampleRate: this.sampleRate,
        });
      }

      if (import.meta.env.DEV) {
        logger.debug(
          `[PCMRecorder] AudioContext running with sample rate: ${this.audioContext.sampleRate}`
        );
      }

      // Request microphone access with audio constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: this.sampleRate },
          channelCount: { ideal: 1 }, // Mono audio
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (import.meta.env.DEV) {
        logger.debug('[PCMRecorder] Microphone access granted');
      }

      // Load AudioWorklet processor module - Vite Production Safe Worker Import
      if (!PCMRecorder.cachedWorkletUrl) {
        await PCMRecorder.preWarmWorklet(this.sampleRate);
      }
      
      if (!PCMRecorder.cachedWorkletUrl) {
        throw new Error('Failed to load AudioWorklet module');
      }
      
      // If we didn't use the cached context, we still need to add the module
      if (!this.audioContext.audioWorklet) {
        throw new Error('AudioWorklet not supported');
      }
      
      // We wrap in try/catch because if we used the cached context, it already has the module
      try {
        await this.audioContext.audioWorklet.addModule(PCMRecorder.cachedWorkletUrl);
      } catch (e) {
        // Module might already be added
        if (import.meta.env.DEV) {
          logger.debug('[PCMRecorder] Module already added or error:', e);
        }
      }

      if (import.meta.env.DEV) {
        logger.debug('[PCMRecorder] AudioWorklet module ready');
      }

      // Create source node from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create AudioWorklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-worklet-processor');

      // Handle audio data from worklet
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const float32Data = event.data as Float32Array;
        this.onAudioProcess(float32Data);
      };

      // Connect audio graph: microphone -> worklet -> destination (for monitoring)
      this.sourceNode.connect(this.workletNode);
      // Note: We don't connect to destination to avoid audio feedback
      // The worklet processes audio and sends data via postMessage

      this.isRecording = true;
      if (import.meta.env.DEV) {
        logger.info('[PCMRecorder] Recording started');
      }
    } catch (error) {
      // Cleanup on error
      this.cleanup();

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error(
            'Microphone access denied. Please grant permission in your browser settings.'
          );
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Microphone is already in use by another application.');
        } else {
          throw new Error(`Failed to start recording: ${error.message}`);
        }
      } else {
        throw new Error('An unknown error occurred while starting recording.');
      }
    }
  }

  /**
   * Stop recording and cleanup resources
   *
   * Disconnects audio graph, stops microphone stream, and releases all resources.
   *
   * Requirements:
   * - 2.4: Implement lifecycle management with proper cleanup
   */
  stopRecording(): void {
    if (!this.isRecording) {
      console.warn('[PCMRecorder] Not currently recording');
      return;
    }

    this.cleanup();
    this.isRecording = false;
    if (import.meta.env.DEV) {
      logger.info('[PCMRecorder] Recording stopped');
    }
  }

  /**
   * Process audio data from AudioWorklet
   *
   * Converts Float32 samples to Int16 PCM and invokes callback.
   *
   * Requirements:
   * - 2.1: Convert Float32 → Int16 PCM
   * - 2.2: Send binary frames via callback (WebSocket transmission handled by caller)
   *
   * @param float32Data - Float32Array of audio samples from worklet
   */
  private onAudioProcess(float32Data: Float32Array): void {
    if (!this.onDataCallback) {
      return;
    }

    // Convert Float32 to Int16 PCM (Requirement 2.1)
    const int16Data = this.float32ToInt16PCM(float32Data);

    // Invoke callback with PCM data (Requirement 2.2)
    this.onDataCallback(int16Data);
  }

  /**
   * Convert Float32 audio samples to Int16 PCM
   *
   * Clamps samples to [-1, 1] range and scales to Int16 range [-32768, 32767].
   * This is the standard conversion for 16-bit PCM audio.
   *
   * Requirements:
   * - 2.1: Convert Float32 → Int16 PCM with proper clamping and scaling
   *
   * @param float32Array - Float32Array of audio samples in range [-1, 1]
   * @returns Int16Array of PCM samples in range [-32768, 32767]
   */
  private float32ToInt16PCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp sample to [-1, 1] range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));

      // Scale to Int16 range
      // Negative samples: multiply by 32768 (0x8000)
      // Positive samples: multiply by 32767 (0x7FFF)
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return int16Array;
  }

  /**
   * Cleanup audio resources
   *
   * Disconnects audio graph, stops media stream tracks, and closes AudioContext.
   * Safe to call multiple times.
   *
   * Requirements:
   * - 2.4: Implement proper resource cleanup
   */
  private cleanup(): void {
    try {
      // Disconnect worklet node
      if (this.workletNode) {
        // Send flush signal to capture remaining audio samples before destruction
        this.workletNode.port.postMessage({ type: 'flush' });
        
        // Delay actual disconnection to allow the final chunk to be sent back
        const node = this.workletNode;
        setTimeout(() => {
          node.port.onmessage = null;
          node.disconnect();
        }, 50);
        this.workletNode = null;
      }

      // Disconnect source node
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      // Stop media stream tracks (release microphone)
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.mediaStream = null;
      }

      // Close AudioContext
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    } catch (error) {
      logger.error('[PCMRecorder] Error during cleanup:', error);
    }
  }

  /**
   * Check if currently recording
   *
   * @returns true if recording is active
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current sample rate
   *
   * @returns Sample rate in Hz
   */
  getSampleRate(): number {
    return this.sampleRate;
  }
}

export default PCMRecorder;
