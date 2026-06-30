/**
 * Voice Activity Detection (VAD) Math Utilities
 *
 * Provides pure mathematical functions for VAD analysis, extracted to
 * be shared across standard, optimized, and Web Worker implementations.
 */

/**
 * Calculate RMS (Root Mean Square) energy from audio samples
 *
 * RMS energy is calculated as: sqrt(sum(sample^2) / sample_count)
 * This provides a measure of the audio signal's power/loudness.
 *
 * @param audioData - Float32Array of audio samples
 * @returns RMS energy value between 0.0 and 1.0
 */
export function calculateRMSEnergy(audioData: Float32Array): number {
  if (audioData.length === 0) {
    return 0.0;
  }

  let sumOfSquares = 0.0;

  // Calculate sum of squared samples
  for (let i = 0; i < audioData.length; i++) {
    const sample = audioData[i];
    sumOfSquares += sample * sample;
  }

  // Calculate RMS: sqrt(mean of squares)
  const rms = Math.sqrt(sumOfSquares / audioData.length);

  // Ensure value is between 0.0 and 1.0
  return Math.min(1.0, Math.max(0.0, rms));
}
