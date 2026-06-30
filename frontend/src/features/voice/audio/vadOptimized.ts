/**
 * Optimized Voice Activity Detection
 *
 * Wraps the core VoiceActivityDetector with a circular buffer to minimize
 * memory allocations during continuous audio processing.
 *
 * The previous implementation spawned a Web Worker via createObjectURL but
 * never actually used it — both branches of the if/else called processSync().
 * The orphaned Worker and Blob URL were never revoked, leaking memory on every
 * voice-mode session.  This rewrite removes all of that dead code and exposes
 * a clean synchronous API backed by the already-solid VoiceActivityDetector.
 *
 * If VAD processing ever requires true off-thread execution in the future, the
 * existing `vad.worker.ts` file is the correct approach (imported as a Vite
 * Worker, not via createObjectURL).
 */

import { CircularAudioBuffer } from './circularBuffer';
import { VADConfig, VADProcessor, VADResult, VoiceActivityDetector } from './vad';

/**
 * Performance metrics for VAD processing
 */
export interface VADPerformanceMetrics {
  averageProcessingTime: number;
  maxProcessingTime: number;
  totalChunksProcessed: number;
}

/**
 * Optimized VAD processor backed by a circular audio buffer.
 *
 * The circular buffer amortises allocations during continuous recording;
 * the synchronous VAD keeps processing deterministic and latency-free for the
 * chunk sizes used in this app (~10ms frames at 16 kHz = ~160 samples).
 */
export class OptimizedVADProcessor implements VADProcessor {
  private readonly config: VADConfig;
  private readonly syncVAD: VoiceActivityDetector;
  private readonly audioBuffer: CircularAudioBuffer;

  private processingTimes: number[] = [];
  private readonly maxProcessingTimeSamples = 10;

  constructor(
    config: VADConfig,
    options?: {
      /** @deprecated No longer has any effect. Reserved for API compatibility. */
      enableWorker?: boolean;
      bufferCapacity?: number;
    }
  ) {
    this.config = config;
    this.syncVAD = new VoiceActivityDetector(config);
    this.audioBuffer = new CircularAudioBuffer(
      options?.bufferCapacity ?? 100,
      16000 // 1 second of audio at 16 kHz
    );
  }

  /**
   * Process a single audio chunk through the VAD.
   *
   * The chunk is also written into the circular buffer so callers can later
   * replay recent frames if needed.
   */
  processAudioChunk(audioData: Float32Array): VADResult {
    const t0 = performance.now();

    // Archive chunk — write never throws for normally-sized PCM frames.
    this.audioBuffer.write(audioData, Date.now(), false);

    const result = this.syncVAD.processAudioChunk(audioData);

    // Track processing time for diagnostics.
    const elapsed = performance.now() - t0;
    this.processingTimes.push(elapsed);
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes.shift();
    }

    return result;
  }

  reset(): void {
    this.syncVAD.reset();
    this.audioBuffer.clear();
  }

  getState(): 'silence' | 'speech' | 'pending' {
    return this.syncVAD.getState();
  }

  /** Diagnostic metrics — useful for performance profiling. */
  getMetrics(): VADPerformanceMetrics {
    const len = this.processingTimes.length;
    const avg = len > 0 ? this.processingTimes.reduce((a, b) => a + b, 0) / len : 0;
    const max = len > 0 ? Math.max(...this.processingTimes) : 0;
    return { averageProcessingTime: avg, maxProcessingTime: max, totalChunksProcessed: len };
  }

  /**
   * Release resources held by this processor.
   *
   * Safe to call multiple times.
   */
  dispose(): void {
    this.audioBuffer.clear();
    this.processingTimes.length = 0;
  }
}
