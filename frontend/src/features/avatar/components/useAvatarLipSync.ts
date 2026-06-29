import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const HEAD_BOB_FREQUENCY = 2;
const HEAD_BOB_AMPLITUDE = 0.05;
const TWO_PI = Math.PI * 2;
const HEAD_BOB_PERIOD = TWO_PI / HEAD_BOB_FREQUENCY;
const FALLBACK_DAMPING = 5;
const ORIGIN_ZERO = 0;
const INACTIVE_VISEME_INFLUENCE = 0;

const BLINK_DURATION = 0.15;
const INITIAL_BLINK_TIME = 0;
const BLINK_START_VAL = 0;
const BLINK_END_VAL = 1;
const BLINK_HALF_DIVISOR = 2;
const BLINK_BASE_DELAY = 2.5;
const BLINK_RANDOM_VARIANCE = 3.5;

const TARGET_ZERO = 0;
const BROW_THINKING = 0.6;
const FROWN_THINKING = 0.3;
const SMILE_SPEAKING = 0.2;
const SPEED_IMMEDIATE = 0;
const DEFAULT_DAMP_SPEED = 12;

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
}: UseAvatarLipSyncProps) {
  const visemeKeysList = useMemo(() => [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
  ], []);
  
  const blinkStateRef = useRef({ nextBlinkTime: INITIAL_BLINK_TIME, duration: BLINK_DURATION, isBlinking: false });
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
    if (getIsAudioPlaying) {
      isAudioPlaying = getIsAudioPlaying();
    } else if (playbackStartTimeRef?.current != null) {
      const audioContext = getAudioContext?.();
      if (audioContext?.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
        isAudioPlaying = true;
      }
    }
    const isEffectivelySpeaking = currentPipelineState === 'speaking' || isAudioPlaying;

    if (targetMeshes.length > ORIGIN_ZERO) {
      const blinkState = blinkStateRef.current;
      if (!blinkState.isBlinking && t > blinkState.nextBlinkTime) {
        blinkState.isBlinking = true;
      }

      let blinkInfluence = TARGET_ZERO;
      if (blinkState.isBlinking) {
        if (t < blinkState.nextBlinkTime + blinkState.duration / BLINK_HALF_DIVISOR) {
          blinkInfluence = THREE.MathUtils.lerp(BLINK_START_VAL, BLINK_END_VAL, (t - blinkState.nextBlinkTime) / (blinkState.duration / BLINK_HALF_DIVISOR));
        } else if (t < blinkState.nextBlinkTime + blinkState.duration) {
          blinkInfluence = THREE.MathUtils.lerp(BLINK_END_VAL, BLINK_START_VAL, (t - (blinkState.nextBlinkTime + blinkState.duration / BLINK_HALF_DIVISOR)) / (blinkState.duration / BLINK_HALF_DIVISOR));
        } else {
          blinkState.isBlinking = false;
          blinkState.nextBlinkTime = t + BLINK_BASE_DELAY + Math.random() * BLINK_RANDOM_VARIANCE;
        }
      }

      let targetBrow = TARGET_ZERO;
      let targetFrown = TARGET_ZERO;
      let targetSmile = TARGET_ZERO;

      if (currentPipelineState === 'thinking') {
        targetBrow = BROW_THINKING;
        targetFrown = FROWN_THINKING;
      } else if (isEffectivelySpeaking) {
        targetSmile = SMILE_SPEAKING;
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
            targetVisemeSS = highNorm * 1.5; // Consonants S, P
          }
          if (midNorm > 0.1) {
            targetVisemeAA = midNorm * 1.5; // Wide vowels A, E
          }
          if (lowNorm > 0.1) {
            targetVisemeO = lowNorm * 1.5; // Closed/deep vowels O, U
            targetJawOpen = lowNorm * 0.1; // Reduced jawOpen influence from 0.5 to 0.1 to prevent overly wide jaw drops
          }
        }
        
        // CHECK REAL VISEMES
        if (mouthCuesRef?.current && mouthCuesRef.current.length > 0 && playbackStartTimeRef?.current != null) {
          const audioContext = getAudioContext?.();
          if (audioContext && audioContext.state === 'running') {
            const elapsed = audioContext.currentTime - playbackStartTimeRef.current;
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

        const safelySetInfluence = (key: string, targetValue: number, speed: number = DEFAULT_DAMP_SPEED) => {
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
          safelySetInfluence(key, INACTIVE_VISEME_INFLUENCE, DEFAULT_DAMP_SPEED);
        }

        // Apply targets based on Real Visemes or fallback to FFT
        let hasRealViseme = false;
        if (activeRealViseme && activeRealViseme !== 'X') {
          const VISEME_MAP: Record<string, string[]> = {
            A: ['viseme_PP'],
            B: ['viseme_kk', 'viseme_SS'],
            C: ['viseme_I'],
            D: ['viseme_aa'], // Removed jawOpen because it causes the mouth to open too wide on most models
            E: ['viseme_O'],
            F: ['viseme_U'],
            G: ['viseme_FF'],
            H: ['viseme_TH']
          };
          const targetKeys = VISEME_MAP[activeRealViseme];
          if (targetKeys) {
            targetKeys.forEach(k => {
              const speedMultiplier = (k === 'viseme_PP' || k === 'viseme_FF') ? 2.5 : 2.0; // Faster attack for consonants
              safelySetInfluence(k, 1.0, DEFAULT_DAMP_SPEED * speedMultiplier);
            });
            hasRealViseme = true;
          }
        }

        if (!hasRealViseme && isEffectivelySpeaking) {
          // Apply FFT targets only if we don't have real visemes
          safelySetInfluence('viseme_SS', Math.min(targetVisemeSS, 1.0), DEFAULT_DAMP_SPEED * 1.5);
          safelySetInfluence('viseme_PP', Math.min(targetVisemeSS * 0.5, 1.0), DEFAULT_DAMP_SPEED * 1.5);
          safelySetInfluence('viseme_aa', Math.min(targetVisemeAA, 1.0), DEFAULT_DAMP_SPEED * 1.5);
          safelySetInfluence('viseme_E', Math.min(targetVisemeAA * 0.8, 1.0), DEFAULT_DAMP_SPEED * 1.5);
          safelySetInfluence('viseme_O', Math.min(targetVisemeO, 1.0), DEFAULT_DAMP_SPEED * 1.5);
          safelySetInfluence('jawOpen', Math.min(targetJawOpen, 1.0), DEFAULT_DAMP_SPEED * 1.5);
        }
      });
    } else if (targetMeshes.length === ORIGIN_ZERO && groupRef.current) {
      if (isEffectivelySpeaking) {
        headBobTimeRef.current = (headBobTimeRef.current + delta) % HEAD_BOB_PERIOD;
        groupRef.current.position.y = Math.sin(headBobTimeRef.current * HEAD_BOB_FREQUENCY) * HEAD_BOB_AMPLITUDE;
      } else {
        groupRef.current.position.y = THREE.MathUtils.damp(
          groupRef.current.position.y,
          ORIGIN_ZERO,
          FALLBACK_DAMPING,
          delta
        );
      }
    }
  });
}
