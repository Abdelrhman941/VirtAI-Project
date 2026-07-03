import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { useLipSyncConfigStore } from '../store/useLipSyncConfigStore';

const TWO_PI = Math.PI * 2;
const ORIGIN_ZERO = 0;
const INACTIVE_VISEME_INFLUENCE = 0;

const BLINK_START_VAL = 0;
const BLINK_END_VAL = 1;
const BLINK_HALF_DIVISOR = 2;

const TARGET_ZERO = 0;
const SPEED_IMMEDIATE = 0;

export interface UseAvatarLipSyncProps {
  targetMeshes: THREE.SkinnedMesh[];
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  mouthCuesRef?: React.MutableRefObject<{ start: number; end: number; value: string }[]>;
  getAudioContext?: () => AudioContext;
  playbackStartTimeRef?: React.MutableRefObject<number | null>;
  getIsAudioPlaying?: () => boolean;
  getNextPlaybackTime?: () => number;
  getAnalyserNode?: () => AnalyserNode | null;
  groupRef: React.RefObject<THREE.Group | null>;
  morphTargetValuesRef?: React.MutableRefObject<Record<string, number>>;
  currentTimeOverrideRef?: React.MutableRefObject<number | null>;
}

export function useAvatarLipSync({
  targetMeshes,
  pipelineState,
  mouthCuesRef,
  getAudioContext,
  playbackStartTimeRef,
  getIsAudioPlaying,
  getAnalyserNode,
  groupRef,
  morphTargetValuesRef,
  currentTimeOverrideRef,
}: UseAvatarLipSyncProps) {
  const visemeKeysList = useMemo(() => [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
  ], []);

  const blinkStateRef = useRef({ nextBlinkTime: 0, duration: 0.15, isBlinking: false });
  const headBobTimeRef = useRef(ORIGIN_ZERO);

  // Realtime Audio Analysis Refs
  const audioDataArrayRef = useRef<Uint8Array | null>(null);

  const pipelineStateRef = useRef(pipelineState);
  useEffect(() => {
    pipelineStateRef.current = pipelineState;
  }, [pipelineState]);

  const morphTargetIndices = useMemo(() => {
    const map = new Map<THREE.SkinnedMesh, Record<string, number | undefined>>();
    targetMeshes.forEach(mesh => {
      const dict = mesh.morphTargetDictionary;
      if (!dict) return;

      const indices: Record<string, number | undefined> = {};

      const resolveIndex = (key: string) => {
        if (dict[key] !== undefined) return dict[key];
        const baseKey = key.replace('viseme_', '');
        if (dict[baseKey] !== undefined) return dict[baseKey];
        if (dict[`viseme_${baseKey}`] !== undefined) return dict[`viseme_${baseKey}`];
        if (dict[`mouth${baseKey}`] !== undefined) return dict[`mouth${baseKey}`];
        return undefined;
      };

      visemeKeysList.forEach(vKey => {
        indices[vKey] = resolveIndex(vKey);
      });
      indices['eyeBlinkLeft'] = resolveIndex('eyeBlinkLeft');
      indices['eyeBlinkRight'] = resolveIndex('eyeBlinkRight');
      indices['browInnerUp'] = resolveIndex('browInnerUp');
      indices['mouthFrownLeft'] = resolveIndex('mouthFrownLeft');
      indices['mouthFrownRight'] = resolveIndex('mouthFrownRight');
      indices['mouthSmileLeft'] = resolveIndex('mouthSmileLeft');
      indices['mouthSmileRight'] = resolveIndex('mouthSmileRight');
      indices['jawOpen'] = resolveIndex('jawOpen');

      map.set(mesh, indices);
    });
    return map;
  }, [targetMeshes, visemeKeysList]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Determine speaking state
    const currentPipelineState = pipelineStateRef.current;
    let isAudioPlaying = false;
    if (currentTimeOverrideRef?.current != null) {
      isAudioPlaying = true;
    } else if (getIsAudioPlaying) {
      isAudioPlaying = getIsAudioPlaying();
    } else if (playbackStartTimeRef?.current != null) {
      const audioContext = getAudioContext?.();
      if (audioContext?.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
        isAudioPlaying = true;
      }
    }
    const isEffectivelySpeaking = currentPipelineState === 'speaking' || isAudioPlaying;

    const config = useLipSyncConfigStore.getState().params;
    const {
      headBobFrequency, headBobAmplitude, fallbackDamping,
      blinkDuration, blinkBaseDelay, blinkRandomVariance,
      browThinking, frownThinking, smileSpeaking, defaultDampSpeed,
      visemeSSMultiplier, visemeAAMultiplier, visemeOMultiplier, jawOpenMultiplier,
      consonantSpeedMultiplier, vowelSpeedMultiplier, fftSpeedMultiplier,
      jawDampSpeed, vowelDampSpeed, consonantDampSpeed, microIdleAmplitude, coarticulationBlend, jawSensitivity, formantSensitivity
    } = config;
    const HEAD_BOB_PERIOD = headBobFrequency > 0 ? TWO_PI / headBobFrequency : 0;

    if (targetMeshes.length > ORIGIN_ZERO) {
      const blinkState = blinkStateRef.current;
      if (!blinkState.isBlinking && t > blinkState.nextBlinkTime) {
        blinkState.isBlinking = true;
        blinkState.duration = blinkDuration;
      }

      let blinkInfluence = TARGET_ZERO;
      if (blinkState.isBlinking) {
        if (t < blinkState.nextBlinkTime + blinkState.duration / BLINK_HALF_DIVISOR) {
          blinkInfluence = THREE.MathUtils.lerp(BLINK_START_VAL, BLINK_END_VAL, (t - blinkState.nextBlinkTime) / (blinkState.duration / BLINK_HALF_DIVISOR));
        } else if (t < blinkState.nextBlinkTime + blinkState.duration) {
          blinkInfluence = THREE.MathUtils.lerp(BLINK_END_VAL, BLINK_START_VAL, (t - (blinkState.nextBlinkTime + blinkState.duration / BLINK_HALF_DIVISOR)) / (blinkState.duration / BLINK_HALF_DIVISOR));
        } else {
          blinkState.isBlinking = false;
          blinkState.nextBlinkTime = t + blinkBaseDelay + Math.random() * blinkRandomVariance;
        }
      }

      let targetBrow = TARGET_ZERO;
      let targetFrown = TARGET_ZERO;
      let targetSmile = TARGET_ZERO;

      if (currentPipelineState === 'thinking') {
        targetBrow = browThinking;
        targetFrown = frownThinking;
      } else if (isEffectivelySpeaking) {
        targetSmile = smileSpeaking;
      }

      // FFT Analysis - 6 Bands
      let targetVisemes: Record<string, number> = {};
      let activeRealViseme = '';

      if (isEffectivelySpeaking) {
        const analyser = getAnalyserNode?.();
        if (analyser) {
          if (!audioDataArrayRef.current || audioDataArrayRef.current.length !== analyser.frequencyBinCount) {
            audioDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
          }
          const dataArray = audioDataArrayRef.current;
          analyser.getByteFrequencyData(dataArray);

          // Calculate RMS amplitude for total energy
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = dataArray[i] / 255.0;
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const totalEnergy = Math.min(rms * jawSensitivity * 3.0, 1.0);

          // Band averages for fftSize 512 (24000Hz -> nyquist 12000Hz, ~46.8Hz per bin)
          const getBandAvgNorm = (startBin: number, endBin: number) => {
            let sum = 0;
            for (let i = startBin; i <= endBin; i++) sum += dataArray[i];
            return (sum / (endBin - startBin + 1)) / 255.0;
          };

          const bandLow = getBandAvgNorm(7, 17); // 300-800Hz
          const bandLowMid = getBandAvgNorm(18, 32); // 800-1500Hz
          const bandMid = getBandAvgNorm(33, 53); // 1500-2500Hz
          const bandHighMid = getBandAvgNorm(54, 85); // 2500-4000Hz
          const bandHigh = getBandAvgNorm(86, 170); // 4000-8000Hz

          targetVisemes['jawOpen'] = Math.min(totalEnergy * jawOpenMultiplier, 0.4);

          // Hard cap vowels at 0.5 - 0.7 so the mouth never opens unrealistically wide
          if (bandLow > 0.05) {
            targetVisemes['viseme_aa'] = Math.min(bandLow * formantSensitivity * visemeAAMultiplier, 0.6);
            targetVisemes['viseme_O'] = Math.min(bandLow * 0.8 * formantSensitivity * visemeOMultiplier, 0.5);
          }
          if (bandLowMid > 0.05) {
            targetVisemes['viseme_E'] = Math.min(bandLowMid * formantSensitivity * visemeAAMultiplier, 0.5);
          }
          if (bandMid > 0.05) {
            targetVisemes['viseme_U'] = Math.min(bandMid * formantSensitivity * visemeOMultiplier, 0.5);
            targetVisemes['viseme_FF'] = Math.min(bandMid * 0.6 * formantSensitivity, 0.6);
          }
          if (bandHighMid > 0.05) {
            targetVisemes['viseme_SS'] = Math.min(bandHighMid * formantSensitivity * visemeSSMultiplier, 0.7);
            targetVisemes['viseme_TH'] = Math.min(bandHighMid * 0.7 * formantSensitivity, 0.6);
          }
          if (bandHigh > 0.05) {
            targetVisemes['viseme_PP'] = Math.min(bandHigh * formantSensitivity, 0.6);
            targetVisemes['viseme_kk'] = Math.min(bandHigh * 0.8 * formantSensitivity, 0.7);
          }
        }

        // CHECK REAL VISEMES
        if (mouthCuesRef?.current && mouthCuesRef.current.length > 0 && playbackStartTimeRef?.current != null) {
          const audioContext = getAudioContext?.();
          let elapsed = 0;
          if (currentTimeOverrideRef?.current != null) {
            elapsed = currentTimeOverrideRef.current;
          } else if (audioContext && audioContext.state === 'running') {
            elapsed = audioContext.currentTime - playbackStartTimeRef.current;
          }

          if (elapsed > 0 || currentTimeOverrideRef?.current != null) {
            const activeCue = mouthCuesRef.current.find((c: any) => elapsed >= c.start && elapsed <= c.end);
            if (activeCue) {
              activeRealViseme = activeCue.value;
            }
          }
        }
      } else {
        // Micro-idle movements
        const slowTime = t * 0.5;
        const fastTime = t * 1.5;
        targetVisemes['jawOpen'] = (Math.sin(slowTime) * 0.5 + 0.5) * microIdleAmplitude;
        targetSmile = targetSmile + (Math.sin(fastTime) * 0.5 + 0.5) * (microIdleAmplitude * 0.5);
      }

      // Apply calculated values safely
      targetMeshes.forEach(mesh => {
        const indices = morphTargetIndices.get(mesh);
        const influences = mesh.morphTargetInfluences;
        if (!indices || !influences) return;

        const safelySetInfluence = (key: string, targetValue: number, speed: number = defaultDampSpeed) => {
          const idx = indices[key];
          if (idx !== undefined && idx < influences.length) {
            const currentValue = influences[idx] || TARGET_ZERO;
            // Coarticulation blend gives momentum to previous frame
            const blendedStart = THREE.MathUtils.lerp(currentValue, targetValue, coarticulationBlend);
            influences[idx] = speed === SPEED_IMMEDIATE
              ? targetValue
              : THREE.MathUtils.lerp(blendedStart, targetValue, Math.min(delta * speed, 1.0));
          }
        };

        // Blinking & Expressions
        safelySetInfluence('eyeBlinkLeft', blinkInfluence, SPEED_IMMEDIATE);
        safelySetInfluence('eyeBlinkRight', blinkInfluence, SPEED_IMMEDIATE);
        safelySetInfluence('browInnerUp', targetBrow);
        safelySetInfluence('mouthFrownLeft', targetFrown);
        safelySetInfluence('mouthFrownRight', targetFrown);
        safelySetInfluence('mouthSmileLeft', targetSmile);
        safelySetInfluence('mouthSmileRight', targetSmile);

        // Map Real Visemes to targets if active
        let activeRealKeys: string[] = [];
        if (isEffectivelySpeaking && activeRealViseme && activeRealViseme !== 'X') {
          const VISEME_MAP: Record<string, string[]> = {
            A: ['viseme_PP'],
            B: ['viseme_kk', 'viseme_SS'],
            C: ['viseme_I'],
            D: ['viseme_aa'],
            E: ['viseme_O'],
            F: ['viseme_U'],
            G: ['viseme_FF'],
            H: ['viseme_TH']
          };
          activeRealKeys = VISEME_MAP[activeRealViseme] || [];
        }

        // Apply all viseme keys
        for (let i = 0; i < visemeKeysList.length; i++) {
          const key = visemeKeysList[i];
          let tv = 0;
          let speed = vowelDampSpeed;

          if (key === 'jawOpen') speed = jawDampSpeed;
          else if (['viseme_PP', 'viseme_kk', 'viseme_SS', 'viseme_TH', 'viseme_FF'].includes(key)) speed = consonantDampSpeed;

          if (activeRealKeys.length > 0) {
            if (activeRealKeys.includes(key)) {
              tv = 1.0;
              speed = (key === 'viseme_PP' || key === 'viseme_FF') ? defaultDampSpeed * consonantSpeedMultiplier : defaultDampSpeed * vowelSpeedMultiplier;
            }
            if (key === 'jawOpen') {
              tv = Math.min(targetVisemes['jawOpen'] || 0, 1.0); // Jaw still driven by FFT
            }
          } else {
            // Fallback to FFT targets
            tv = targetVisemes[key] || 0;
            speed = speed * fftSpeedMultiplier;
          }

          safelySetInfluence(key, tv, speed);
        }

        if (morphTargetValuesRef) {
          morphTargetValuesRef.current = {
            jawOpen: influences[indices['jawOpen'] || 0] || 0,
            viseme_aa: influences[indices['viseme_aa'] || 0] || 0,
            viseme_O: influences[indices['viseme_O'] || 0] || 0,
            mouthSmileLeft: influences[indices['mouthSmileLeft'] || 0] || 0,
            eyeBlinkLeft: influences[indices['eyeBlinkLeft'] || 0] || 0,
          };
        }
      });
    } else if (targetMeshes.length === ORIGIN_ZERO && groupRef.current) {
      if (isEffectivelySpeaking && HEAD_BOB_PERIOD > 0) {
        headBobTimeRef.current = (headBobTimeRef.current + delta) % HEAD_BOB_PERIOD;
        groupRef.current.position.y = Math.sin(headBobTimeRef.current * headBobFrequency) * headBobAmplitude;
      } else {
        groupRef.current.position.y = THREE.MathUtils.damp(
          groupRef.current.position.y,
          ORIGIN_ZERO,
          fallbackDamping,
          delta
        );
      }
    }
  });
}
