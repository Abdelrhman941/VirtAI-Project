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
      consonantSpeedMultiplier, vowelSpeedMultiplier, fftSpeedMultiplier
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

      // FFT Analysis
      let targetVisemeSS = 0;
      let targetVisemeAA = 0;
      let targetVisemeO = 0;
      let targetJawOpen = 0;
      let activeRealViseme = '';

      if (isEffectivelySpeaking) {
        const analyser = getAnalyserNode?.();
        if (analyser) {
          if (!audioDataArrayRef.current) {
            audioDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount); // usually 128 for fftSize 256
          }
          const dataArray = audioDataArrayRef.current;
          analyser.getByteFrequencyData(dataArray);

          // Calculate band averages
          // Low: 0-3 (0 - ~680Hz)
          // Mid: 4-15 (~680Hz - ~2700Hz)
          // High: 16-45 (~2700Hz - ~8000Hz)
          let lowSum = 0;
          for (let i = 0; i < 4; i++) lowSum += dataArray[i];
          const lowAvg = lowSum / 4;

          let midSum = 0;
          for (let i = 4; i < 16; i++) midSum += dataArray[i];
          const midAvg = midSum / 12;

          let highSum = 0;
          for (let i = 16; i < 46; i++) highSum += dataArray[i];
          const highAvg = highSum / 30;

          // Normalize
          const lowNorm = Math.min(lowAvg / 255.0, 1.0);
          const midNorm = Math.min(midAvg / 255.0, 1.0);
          const highNorm = Math.min(highAvg / 255.0, 1.0);

          // Mapping logic
          if (highNorm > 0.1) {
            targetVisemeSS = highNorm * visemeSSMultiplier;
          }
          if (midNorm > 0.1) {
            targetVisemeAA = midNorm * visemeAAMultiplier;
          }
          if (lowNorm > 0.1) {
            targetVisemeO = lowNorm * visemeOMultiplier;
            targetJawOpen = lowNorm * jawOpenMultiplier;
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

        if (Math.random() < 0.05) { // log 5% of frames
          console.log('[LipSync Debug] isSpeaking:', isEffectivelySpeaking, 'FFT Jaw:', targetJawOpen.toFixed(2), 'RealViseme:', activeRealViseme, 'cuesCount:', mouthCuesRef?.current?.length);
        }
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
            influences[idx] = speed === SPEED_IMMEDIATE
              ? targetValue
              : THREE.MathUtils.lerp(currentValue, targetValue, Math.min(delta * speed, 1.0));
          }
        };

        // Blinking
        safelySetInfluence('eyeBlinkLeft', blinkInfluence, SPEED_IMMEDIATE);
        safelySetInfluence('eyeBlinkRight', blinkInfluence, SPEED_IMMEDIATE);

        // Expressions
        safelySetInfluence('browInnerUp', targetBrow);
        safelySetInfluence('mouthFrownLeft', targetFrown);
        safelySetInfluence('mouthFrownRight', targetFrown);
        safelySetInfluence('mouthSmileLeft', targetSmile);
        safelySetInfluence('mouthSmileRight', targetSmile);

        // Reset all visemes to zero first (so un-triggered visemes fade out naturally)
        for (let i = 0; i < visemeKeysList.length; i++) {
          const key = visemeKeysList[i];
          safelySetInfluence(key, INACTIVE_VISEME_INFLUENCE, defaultDampSpeed);
        }

        // Apply targets based on Real Visemes or fallback to FFT
        let hasRealViseme = false;
        if (activeRealViseme && activeRealViseme !== 'X') {
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
          const targetKeys = VISEME_MAP[activeRealViseme];
          if (targetKeys) {
            targetKeys.forEach(k => {
              const speedMultiplier = (k === 'viseme_PP' || k === 'viseme_FF') ? consonantSpeedMultiplier : vowelSpeedMultiplier;
              safelySetInfluence(k, 1.0, defaultDampSpeed * speedMultiplier);
            });
            hasRealViseme = true;
          }
        }

        if (!hasRealViseme && isEffectivelySpeaking) {
          // Apply FFT targets only if we don't have real visemes
          safelySetInfluence('viseme_SS', Math.min(targetVisemeSS, 1.0), defaultDampSpeed * fftSpeedMultiplier);
          safelySetInfluence('viseme_PP', Math.min(targetVisemeSS * 0.5, 1.0), defaultDampSpeed * fftSpeedMultiplier);
          safelySetInfluence('viseme_aa', Math.min(targetVisemeAA, 1.0), defaultDampSpeed * fftSpeedMultiplier);
          safelySetInfluence('viseme_E', Math.min(targetVisemeAA * 0.8, 1.0), defaultDampSpeed * fftSpeedMultiplier);
          safelySetInfluence('viseme_O', Math.min(targetVisemeO, 1.0), defaultDampSpeed * fftSpeedMultiplier);
          safelySetInfluence('jawOpen', Math.min(targetJawOpen, 1.0), defaultDampSpeed * fftSpeedMultiplier);
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
