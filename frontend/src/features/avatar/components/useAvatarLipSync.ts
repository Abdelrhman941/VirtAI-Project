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
const POINTER_RESET_INDEX = 0;
const ARRAY_END_OFFSET = 1;
const FALLBACK_VISEME = 'viseme_sil';

const VISEME_WEIGHT_MAP: Record<string, number> = {
  'viseme_PP': 1.0,
  'viseme_FF': 0.7,
  'viseme_TH': 0.7,
  'viseme_DD': 0.7,
  'viseme_kk': 0.8,
  'viseme_CH': 0.8,
  'viseme_SS': 0.7,
  'viseme_nn': 0.8,
  'viseme_RR': 0.8,
  'viseme_aa': 1.0,
  'viseme_E': 0.8,
  'viseme_I': 0.8,
  'viseme_O': 1.0,
  'viseme_U': 0.95,
  'viseme_oh': 1.0,
  'viseme_ou': 0.95,
  'viseme_ih': 0.8,
  'viseme_sil': 0.0,
};

const JAW_WEIGHT_MAP: Record<string, number> = {
  'viseme_PP': 0.0,
  'viseme_FF': 0.1,
  'viseme_TH': 0.1,
  'viseme_DD': 0.15,
  'viseme_kk': 0.2,
  'viseme_CH': 0.2,
  'viseme_SS': 0.1,
  'viseme_nn': 0.15,
  'viseme_RR': 0.2,
  'viseme_aa': 0.6,
  'viseme_E': 0.3,
  'viseme_I': 0.2,
  'viseme_O': 0.5,
  'viseme_U': 0.3,
  'viseme_oh': 0.5,
  'viseme_ou': 0.4,
  'viseme_ih': 0.2,
  'viseme_sil': 0.0,
};

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
const JAW_OPEN_WIDE = 0.25;
const JAW_CLOSED = 0;

const VISEME_MAP: Record<string, string> = {
  A: 'viseme_PP', // Closed mouth (P, B, M)
  B: 'viseme_kk', // Slightly open (K, S, T)
  C: 'viseme_I',  // Open (E, I)
  D: 'viseme_aa', // Wide open (A)
  E: 'viseme_O',  // O shape
  F: 'viseme_U',  // U shape
  G: 'viseme_FF', // F, V sounds
  H: 'viseme_TH', // Th sounds
  X: 'viseme_sil', // Silence/Idle
};

export interface Viseme {
  start: number;
  end: number;
  value: string;
}

export interface UseAvatarLipSyncProps {
  targetMeshes: THREE.SkinnedMesh[];
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  mouthCuesRef?: React.MutableRefObject<Viseme[]>;
  getAudioContext?: () => AudioContext;
  playbackStartTimeRef?: React.MutableRefObject<number | null>;
  getIsAudioPlaying?: () => boolean;
  getNextPlaybackTime?: () => number;
  groupRef: React.RefObject<THREE.Group | null>;
}

export function useAvatarLipSync({
  targetMeshes,
  pipelineState,
  mouthCuesRef,
  getAudioContext,
  playbackStartTimeRef,
  getIsAudioPlaying,
  getNextPlaybackTime,
  groupRef,
}: UseAvatarLipSyncProps) {
  const visemeKeysList = useMemo(() => [
    'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
    'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
    'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
  ], []);
  const currentCueIndexRef = useRef(POINTER_RESET_INDEX);
  const blinkStateRef = useRef({ nextBlinkTime: INITIAL_BLINK_TIME, duration: BLINK_DURATION, isBlinking: false });
  const fallbackTimeRef = useRef(ORIGIN_ZERO);
  const lastCuesRef = useRef<Viseme[] | null>(null);
  const hardwareClockSyncRef = useRef<{ lastAudioTime: number; lastFrameTime: number; }>({
    lastAudioTime: 0,
    lastFrameTime: 0,
  });

  const pipelineStateRef = useRef(pipelineState);
  useEffect(() => {
    pipelineStateRef.current = pipelineState;
  }, [pipelineState]);

  useEffect(() => {
    if (pipelineState === 'speaking') {
      fallbackTimeRef.current = ORIGIN_ZERO;
      currentCueIndexRef.current = POINTER_RESET_INDEX;
      lastCuesRef.current = mouthCuesRef?.current || null;
    }
  }, [pipelineState, mouthCuesRef]);

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
    // ONE-TIME CAMERA LOGGING
    if (!(window as any).__LOGGED_CAMERA) {
      console.log('[Runtime Evidence] Active Camera Frame:', {
        position: state.camera.position.toArray(),
        rotation: state.camera.rotation.toArray(),
        fov: (state.camera as any).fov
      });
      (window as any).__LOGGED_CAMERA = {
        position: state.camera.position.toArray(),
        rotation: state.camera.rotation.toArray(),
        fov: (state.camera as any).fov
      };
    }

    if (targetMeshes.length > ORIGIN_ZERO) {
      // 1. Calculate Target Values
      const t = state.clock.elapsedTime;
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

      const currentPipelineState = pipelineStateRef.current;
      let isAudioPlaying = false;
      if (getIsAudioPlaying) {
        isAudioPlaying = getIsAudioPlaying();
      } else if (playbackStartTimeRef?.current != null) {
        const audioContext = getAudioContext?.();
        if (audioContext?.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
          isAudioPlaying = true;
          if (currentPipelineState !== 'speaking') {
            if (mouthCuesRef?.current && mouthCuesRef.current.length > 0) {
              const lastCue = mouthCuesRef.current[mouthCuesRef.current.length - 1];
              const validEnd = Number.isFinite(lastCue?.end) ? Number(lastCue.end) : 0;
              if (audioContext.currentTime > playbackStartTimeRef.current + validEnd) {
                isAudioPlaying = false;
              }
            } else {
              isAudioPlaying = false;
            }
          }
        }
      }
      const isEffectivelySpeaking = currentPipelineState === 'speaking' || isAudioPlaying;

      if (currentPipelineState === 'thinking') {
        targetBrow = BROW_THINKING;
        targetFrown = FROWN_THINKING;
      } else if (isEffectivelySpeaking) {
        targetSmile = SMILE_SPEAKING;
      }

      let activeVisemeName: string | null = null;
      if (isEffectivelySpeaking && mouthCuesRef?.current) {
        const cues = mouthCuesRef.current;
        
        if (cues !== lastCuesRef.current) {
          fallbackTimeRef.current = ORIGIN_ZERO;
          currentCueIndexRef.current = POINTER_RESET_INDEX;
          lastCuesRef.current = cues;
        }

        let currentTime = ORIGIN_ZERO;
        
        const audioContext = getAudioContext?.();

        if (audioContext && audioContext.state !== 'suspended' && playbackStartTimeRef?.current != null) {
          const currentAudioTime = audioContext.currentTime;
          
          // Hardware Clock Synchronization Fix: smooth out AudioContext's resolution using RAF's high-frequency clock
          if (hardwareClockSyncRef.current.lastAudioTime !== currentAudioTime) {
            hardwareClockSyncRef.current.lastAudioTime = currentAudioTime;
            hardwareClockSyncRef.current.lastFrameTime = t;
          }
          
          const timeSinceLastAudioUpdate = t - hardwareClockSyncRef.current.lastFrameTime;
          // Extrapolate time to prevent stuttering, capped to 100ms to prevent runaway drift
          const smoothedAudioTime = currentAudioTime + Math.min(timeSinceLastAudioUpdate, 0.1);

          currentTime = smoothedAudioTime - playbackStartTimeRef.current;
          fallbackTimeRef.current = currentTime;
        } else {
          // DEFENSIVE: Viseme Pre-Fire Jitter Fix
          // Do NOT advance fallback clock if we are waiting for audio context to start or if suspended.
          // This keeps the mouth closed until audio actually begins.
          currentTime = ORIGIN_ZERO;
        }

        if (currentTime < ORIGIN_ZERO) currentTime = ORIGIN_ZERO;

        let index = currentCueIndexRef.current;

        if (cues.length > ORIGIN_ZERO) {
          const currentTrackedCue = cues[index] || cues[cues.length - ARRAY_END_OFFSET];
          if (currentTime < currentTrackedCue.start) {
            index = POINTER_RESET_INDEX;
          }
        } else {
          index = POINTER_RESET_INDEX;
        }

        while (index < cues.length && currentTime > cues[index].end) {
          index++;
        }

        currentCueIndexRef.current = index;

        if (index < cues.length && currentTime >= cues[index].start) {
          const rawValue = cues[index].value;
          const cueValue = rawValue.toUpperCase();
          const nextViseme = VISEME_MAP[cueValue] || (rawValue.toLowerCase().startsWith('viseme_') ? rawValue : FALLBACK_VISEME);
          
          if (activeVisemeName !== nextViseme) {
            if (Math.random() < 0.05) { // Sample logs to avoid flooding
                console.log(`[Runtime Evidence] Lip-Sync Update - Time: ${currentTime.toFixed(3)}s, Viseme: ${nextViseme}, Index: ${index}`);
            }
          }
          activeVisemeName = nextViseme;
        }
      }

      // 2. Apply calculated values safely
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

        // Visemes
        for (let i = ORIGIN_ZERO; i < visemeKeysList.length; i++) {
          const vKey = visemeKeysList[i];
          let target = INACTIVE_VISEME_INFLUENCE;
          if (vKey === activeVisemeName) {
            target = VISEME_WEIGHT_MAP[vKey] !== undefined ? VISEME_WEIGHT_MAP[vKey] : 0.75;
          }
          safelySetInfluence(vKey, target, DEFAULT_DAMP_SPEED);
        }

        // Jaw Kinematics
        const jawTarget = activeVisemeName ? (JAW_WEIGHT_MAP[activeVisemeName] !== undefined ? JAW_WEIGHT_MAP[activeVisemeName] : 0.0) : 0.0;
        safelySetInfluence('jawOpen', jawTarget, DEFAULT_DAMP_SPEED);
      });
    } else if (targetMeshes.length === ORIGIN_ZERO && groupRef.current) {
      const currentPipelineState = pipelineStateRef.current;
      let isAudioPlaying = false;
      if (getIsAudioPlaying) {
        isAudioPlaying = getIsAudioPlaying();
      } else if (playbackStartTimeRef?.current != null) {
        const audioContext = getAudioContext?.();
        if (audioContext?.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
          isAudioPlaying = true;
          if (currentPipelineState !== 'speaking') {
            if (mouthCuesRef?.current && mouthCuesRef.current.length > 0) {
              const lastCue = mouthCuesRef.current[mouthCuesRef.current.length - 1];
              const validEnd = Number.isFinite(lastCue?.end) ? Number(lastCue.end) : 0;
              if (audioContext.currentTime > playbackStartTimeRef.current + validEnd) {
                isAudioPlaying = false;
              }
            } else {
              isAudioPlaying = false;
            }
          }
        }
      }
      const isEffectivelySpeaking = currentPipelineState === 'speaking' || isAudioPlaying;

      if (isEffectivelySpeaking) {
        fallbackTimeRef.current = (fallbackTimeRef.current + delta) % HEAD_BOB_PERIOD;
        groupRef.current.position.y = Math.sin(fallbackTimeRef.current * HEAD_BOB_FREQUENCY) * HEAD_BOB_AMPLITUDE;
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
