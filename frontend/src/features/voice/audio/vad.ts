/**
 * Voice Activity Detection (VAD) Module
 *
 * Implements energy-based voice activity detection using RMS (Root Mean Square)
 * energy calculation to distinguish speech from silence.
 */

/**
 * Configuration for Voice Activity Detection
 */
export interface VADConfig {
  /** RMS energy threshold (0-1) below which audio is considered silence */
  silenceThreshold: number;
  /** Duration of silence in milliseconds before triggering finalization */
  silenceDuration: number;
  /** Minimum speech duration in milliseconds required before allowing finalization */
  minSpeechDuration: number;
}

/**
 * Result of VAD processing for a single audio chunk
 */
export interface VADResult {
  /** Whether the current chunk contains speech */
  isSpeech: boolean;
  /** Calculated RMS energy level (0-1) */
  energy: number;
  /** Current duration of continuous silence in milliseconds */
  silenceDurationMs: number;
  /** Whether the audio should be finalized (silence threshold exceeded) */
  shouldFinalize: boolean;
}

/**
 * Interface for VAD processor implementations
 */
export interface VADProcessor {
  /**
   * Process an audio chunk and determine speech/silence state
   * @param audioData - Float32Array of audio samples
   * @returns VADResult with speech detection and finalization status
   */
  processAudioChunk(audioData: Float32Array): VADResult;

  /**
   * Reset the VAD state to initial conditions
   */
  reset(): void;

  /**
   * Get the current VAD state
   * @returns Current state: 'silence', 'speech', or 'pending'
   */
  getState(): 'silence' | 'speech' | 'pending';
}

import { calculateRMSEnergy } from './vadMath';

/**
 * Voice Activity Detector implementation using RMS energy analysis
 *
 * This class analyzes audio chunks to detect speech vs silence by calculating
 * the RMS (Root Mean Square) energy of audio samples and comparing against
 * a configured threshold. It tracks silence duration to determine when to
 * finalize a speech segment.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 14.3
 */
export class VoiceActivityDetector implements VADProcessor {
  private config: VADConfig;
  private lastSpeechTime: number;
  private firstSpeechTime: number | null;
  private currentState: 'silence' | 'speech' | 'pending';
  private silenceDurationMs: number;

  /**
   * Create a new VoiceActivityDetector
   * @param config - VAD configuration parameters
   */
  constructor(config: VADConfig) {
    this.config = config;
    this.lastSpeechTime = Date.now();
    this.firstSpeechTime = null;
    this.currentState = 'silence';
    this.silenceDurationMs = 0;
  }

  /**
   * Process an audio chunk and detect voice activity
   *
   * Calculates RMS energy from audio samples and determines if the chunk
   * contains speech or silence. Tracks silence duration and signals when
   * to finalize the speech segment.
   *
   * @param audioData - Float32Array containing audio samples
   * @returns VADResult with speech detection and finalization status
   *
   * Requirements:
   * - 2.1: Calculate RMS energy of audio samples
   * - 2.2: Classify audio as speech when energy exceeds threshold
   * - 2.3: Classify audio as silence when energy is below threshold
   * - 2.4: Reset silence timer when speech is detected
   * - 2.5: Increment silence timer when silence is detected
   * - 2.6: Set shouldFinalize when silence exceeds threshold and min speech met
   * - 14.3: Return energy value between 0.0 and 1.0
   */
  processAudioChunk(audioData: Float32Array): VADResult {
    // Calculate RMS energy (Requirement 2.1)
    const energy = calculateRMSEnergy(audioData);

    // Determine if speech or silence (Requirements 2.2, 2.3)
    const isSpeech = energy > this.config.silenceThreshold;

    const currentTime = Date.now();

    if (isSpeech) {
      // Speech detected - reset silence timer (Requirement 2.4)
      this.lastSpeechTime = currentTime;
      this.silenceDurationMs = 0;
      this.currentState = 'speech';

      // Track first speech time for minimum duration check
      if (this.firstSpeechTime === null) {
        this.firstSpeechTime = currentTime;
      }
    } else {
      // Silence detected - increment silence timer (Requirement 2.5)
      this.silenceDurationMs = currentTime - this.lastSpeechTime;

      if (this.firstSpeechTime !== null) {
        this.currentState = 'pending';
      } else {
        this.currentState = 'silence';
      }
    }

    // Calculate total speech duration
    const totalSpeechDuration =
      this.firstSpeechTime !== null ? this.lastSpeechTime - this.firstSpeechTime : 0;

    // Determine if should finalize (Requirement 2.6)
    const shouldFinalize =
      !isSpeech &&
      this.silenceDurationMs >= this.config.silenceDuration &&
      totalSpeechDuration >= this.config.minSpeechDuration;

    return {
      isSpeech,
      energy,
      silenceDurationMs: this.silenceDurationMs,
      shouldFinalize,
    };
  }

  // Use calculateRMSEnergy from vadMath.ts directly since we removed the private method

  /**
   * Reset the VAD state to initial conditions
   *
   * Clears all timing information and resets state to silence.
   * Should be called after finalizing a speech segment.
   */
  reset(): void {
    this.lastSpeechTime = Date.now();
    this.firstSpeechTime = null;
    this.currentState = 'silence';
    this.silenceDurationMs = 0;
  }

  /**
   * Get the current VAD state
   *
   * @returns Current state:
   *   - 'silence': No speech detected yet
   *   - 'speech': Currently detecting speech
   *   - 'pending': Speech ended, waiting for silence threshold
   */
  getState(): 'silence' | 'speech' | 'pending' {
    return this.currentState;
  }
}
