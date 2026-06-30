/**
 * Web Worker for Voice Activity Detection (VAD) processing
 *
 * Offloads VAD calculations from the main thread to prevent UI blocking
 * when processing time exceeds 10ms.
 *
 * Requirements: 14.1, 14.2
 */

import { VADConfig, VADResult } from './vad';
import { calculateRMSEnergy } from './vadMath';

/**
 * Message types for worker communication
 */
interface VADWorkerRequest {
  type: 'process' | 'reset' | 'getState';
  audioData?: Float32Array;
  config?: VADConfig;
}

interface VADWorkerResponse {
  type: 'result' | 'state' | 'error';
  result?: VADResult;
  state?: 'silence' | 'speech' | 'pending';
  error?: string;
}

/**
 * VAD state maintained in worker
 */
let config: VADConfig = {
  silenceThreshold: 0.01,
  silenceDuration: 800,
  minSpeechDuration: 300,
};

let lastSpeechTime: number = Date.now();
let firstSpeechTime: number | null = null;
let currentState: 'silence' | 'speech' | 'pending' = 'silence';
let silenceDurationMs: number = 0;

// Removed duplicate calculateRMSEnergy

/**
 * Process audio chunk and detect voice activity
 *
 * @param audioData - Float32Array containing audio samples
 * @returns VADResult with speech detection and finalization status
 */
function processAudioChunk(audioData: Float32Array): VADResult {
  // Calculate RMS energy
  const energy = calculateRMSEnergy(audioData);

  // Determine if speech or silence
  const isSpeech = energy > config.silenceThreshold;

  const currentTime = Date.now();

  if (isSpeech) {
    // Speech detected - reset silence timer
    lastSpeechTime = currentTime;
    silenceDurationMs = 0;
    currentState = 'speech';

    // Track first speech time for minimum duration check
    if (firstSpeechTime === null) {
      firstSpeechTime = currentTime;
    }
  } else {
    // Silence detected - increment silence timer
    silenceDurationMs = currentTime - lastSpeechTime;

    if (firstSpeechTime !== null) {
      currentState = 'pending';
    } else {
      currentState = 'silence';
    }
  }

  // Calculate total speech duration
  const totalSpeechDuration = firstSpeechTime !== null ? lastSpeechTime - firstSpeechTime : 0;

  // Determine if should finalize
  const shouldFinalize =
    !isSpeech &&
    silenceDurationMs >= config.silenceDuration &&
    totalSpeechDuration >= config.minSpeechDuration;

  return {
    isSpeech,
    energy,
    silenceDurationMs,
    shouldFinalize,
  };
}

/**
 * Reset VAD state
 */
function reset(): void {
  lastSpeechTime = Date.now();
  firstSpeechTime = null;
  currentState = 'silence';
  silenceDurationMs = 0;
}

/**
 * Get current VAD state
 */
function getState(): 'silence' | 'speech' | 'pending' {
  return currentState;
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<VADWorkerRequest>) => {
  const { type, audioData, config: newConfig } = event.data;

  try {
    switch (type) {
      case 'process': {
        if (!audioData) {
          throw new Error('audioData is required for process command');
        }
        if (newConfig) {
          config = newConfig;
        }
        const result = processAudioChunk(audioData);
        const response: VADWorkerResponse = {
          type: 'result',
          result,
        };
        self.postMessage(response);
        break;
      }

      case 'reset':
        reset();
        self.postMessage({ type: 'state', state: getState() });
        break;

      case 'getState':
        self.postMessage({ type: 'state', state: getState() });
        break;

      default:
        throw new Error(`Unknown command type: ${type}`);
    }
  } catch (error) {
    const errorResponse: VADWorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResponse);
  }
};
