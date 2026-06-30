import { useAnimations, useFBX } from '@react-three/drei';
import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAvatarLipSync } from './useAvatarLipSync';
import { Viseme } from '@/features/voice/hooks/useGaplessAudioQueue';

const IDLE_URL = '/models/animations/Idle/Idle.fbx';
const TALK_MANIFEST = [
  '/models/animations/Talk/Talk_1.fbx'
];

const FADE_DURATION = 0.4;

const ANIMATION_LOOP_ONCE_COUNT = 1;
const NORMAL_TIME_SCALE = 1;
const FULL_WEIGHT = 1;
const MS_PER_SECOND = 1000;
const SINGLE_ANIMATION_COUNT = 1;
const FIRST_INDEX = 0;
const INITIAL_TIME = 0;
const NO_INDEX = -1;
const ARRAY_EMPTY_LENGTH = 0;

interface TimelineState {
  phase: 'idle' | 'thinking' | 'speaking' | 'talking' | 'idle_break';
  timeInPhase: number;
  targetBreakDuration: number;
  lastTalkIndex: number;
}

export function useAvatarAnimations(
  scene: THREE.Group,
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error',
  movementEnabled: boolean,
  getAudioContext?: () => AudioContext,
  playbackStartTimeRef?: React.MutableRefObject<number | null>,
  mouthCuesRef?: React.MutableRefObject<Viseme[]>,
  getIsAudioPlaying?: () => boolean,
  getNextPlaybackTime?: () => number
) {
  const idleFbx = useFBX(IDLE_URL);
  const talkFbx1 = useFBX(TALK_MANIFEST[0]);

  const animations = useMemo(() => {
    function captureSkeletonSpace(root: THREE.Object3D): Map<string, THREE.Quaternion> {
      const m = new Map<string, THREE.Quaternion>();
      root.traverse(o => {
        if ((o as any).isBone) {
          const cleanName = o.name.replace(/mixamorig:|Armature\|/gi, '').split('.')[0];
          m.set(cleanName, (o as THREE.Bone).quaternion.clone());
        }
      });
      return m;
    }

    function relaxArmPosture(clip: THREE.AnimationClip) {
      // Gently drop upper arms and shoulders to reduce robotic T-pose abduction
      const qDropArm = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-15));
      const qDropShoulder = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-5));

      for (const track of clip.tracks) {
        if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
        
        let qOffset: THREE.Quaternion | null = null;
        if (track.name.startsWith('LeftArm') || track.name.startsWith('RightArm')) qOffset = qDropArm;
        if (track.name.startsWith('LeftShoulder') || track.name.startsWith('RightShoulder')) qOffset = qDropShoulder;

        if (qOffset) {
          const tmp = new THREE.Quaternion();
          for (let i = 0; i < track.values.length; i += 4) {
            tmp.fromArray(track.values, i);
            tmp.premultiply(qOffset); // Clean local rotation, avoids Mixamo/RPM cross-axis twisting
            tmp.toArray(track.values, i);
          }
        }
      }
    }

    function sanitizeClip(clip: THREE.AnimationClip, isIdle: boolean) {
      clip.tracks = clip.tracks.filter(t => {
        if (t.name.endsWith('.scale')) return false;
        if (t.name.endsWith('.position')) return false;
        if (t.name === 'Hips.quaternion') return false;
        
        // STRIP SHARED BASELINE OFFENDERS:
        // Removing Spine fixes the "chest-forward and robotic" posture.
        if (t.name === 'Spine.quaternion') return false;
        
        // Removing Shoulders fixes "clavicles are elevated / open and stiff".
        // They will fall back to the natural GLB rest pose permanently.
        if (t.name.startsWith('LeftShoulder') || t.name.startsWith('RightShoulder')) return false;
        
        // Removing Arms from Idle forces the avatar to rest its arms in the pure GLB A-pose
        // completely eliminating the robotic T-pose width at the start and end of movement.
        if (isIdle && (t.name.startsWith('LeftArm') || t.name.startsWith('RightArm'))) return false;

        return true;
      });
    }

    function pickStack(anims: THREE.AnimationClip[], preferredSuffixes: string[]): THREE.AnimationClip {
      for (const suffix of preferredSuffixes) {
        const hit = anims.find(c => c.name === suffix || c.name.endsWith(suffix));
        if (hit) return hit;
      }
      return anims.slice().sort((a, b) => b.duration - a.duration)[0];
    }

    if (!scene || !idleFbx || !talkFbx1) return [] as THREE.AnimationClip[];

    // GLB space capture no longer needed for complex retargeting
    // const glbSpace = captureSkeletonSpace(scene);
    // const talk1Space = captureSkeletonSpace(talkFbx1);

    const idleSrc = pickStack(idleFbx.animations, ['mixamo.com']);
    if (!idleSrc) return [];
    
    const idle = idleSrc.clone();
    idle.name = 'Idle';

    // Idle is pristine; it only needs sanitization
    idle.tracks = idle.tracks
      .map(t => {
        const c = t.clone();
        c.name = c.name.replace(/mixamorig:|Armature\|/gi, '');
        return c;
      })
      .filter(t => !t.name.startsWith('Armature.'));
    sanitizeClip(idle, true);
    relaxArmPosture(idle);

    const clips = [idle];
    let talkIndex = 0;

    const talk1Src = pickStack(talkFbx1.animations, ['Armature|Armature|Scene', 'mixamo.com']);
    if (talk1Src) {
      const talk1 = talk1Src.clone();
      talk1.name = `Talk_${talkIndex++}`;
      talk1.tracks = talk1.tracks
        .map(t => {
          const c = t.clone();
          c.name = c.name.replace(/mixamorig:|Armature\|/gi, '');
          return c;
        })
        .filter(t => !t.name.startsWith('Armature.'));
      sanitizeClip(talk1, false);
      relaxArmPosture(talk1);
      clips.push(talk1);
    }

    return clips;
  }, [scene, idleFbx, talkFbx1]);

  const { actions, mixer } = useAnimations(animations, scene);
  const currentActionNameRef = useRef<string | null>(null);
  const stopTimeoutsRef = useRef<Set<number>>(new Set());
  const talkActionNames = useMemo(() => Object.keys(actions).filter(k => k.startsWith('Talk_')), [actions]);

  const timelineStateRef = useRef<TimelineState>({
    phase: 'idle',
    timeInPhase: INITIAL_TIME,
    targetBreakDuration: INITIAL_TIME,
    lastTalkIndex: NO_INDEX,
  });

  useEffect(() => {
    if (actions['Idle']) {
      actions['Idle'].setLoop(THREE.LoopRepeat, Infinity);
    }

    Object.keys(actions).forEach(key => {
      const action = actions[key];
      if (key.startsWith('Talk_') && action) {
        action.setLoop(THREE.LoopOnce, ANIMATION_LOOP_ONCE_COUNT);
        action.clampWhenFinished = true;
      }
    });
  }, [actions]);

  const inFlightFadeRef = useRef<{ to: string; until: number } | null>(null);

  const playAnimation = useCallback(
    (name: string, customFadeTime?: number) => {
      let targetName = name;

      // CRITICAL FIX: The 'Idle' animation is immune to movementEnabled.
      // If movement is disabled, we MUST fallback to 'Idle' to prevent bind-pose mesh collapse.
      if (!movementEnabled && targetName !== 'Idle') {
        targetName = 'Idle';
      }

      // Human-like transition timing: fast excitation (0.3s), slow relaxation (0.6s)
      const fadeTime = customFadeTime !== undefined ? customFadeTime : (targetName === 'Idle' ? 0.6 : 0.3);

      const now = performance.now() / MS_PER_SECOND;
      const inflight = inFlightFadeRef.current;

      // If a fade is already running, COLLAPSE: just retarget the upcoming clip,
      // don't start a second concurrent crossfade.
      if (inflight && inflight.until > now) {
        if (inflight.to === targetName) return; // already heading there
        // Cancel any pending setTimeouts that would .stop() actions mid-blend.
        stopTimeoutsRef.current.forEach(id => clearTimeout(id));
        stopTimeoutsRef.current.clear();
        // The prevAction here is the action currently *rising*; treat it as the new "from"
        // and crossfade from it to the new target.
      }

      const nextAction = actions[targetName];
      if (!nextAction) return;

      if (currentActionNameRef.current === targetName && nextAction.isRunning()) return;

      const prevAction = currentActionNameRef.current ? actions[currentActionNameRef.current] : null;

      if (targetName !== 'Idle') {
        nextAction.reset();
        // Subtly randomize gesture tempo for human-like imperfection
        const timeScale = 0.85 + Math.random() * 0.25;
        nextAction.setEffectiveTimeScale(timeScale);
      } else {
        nextAction.setEffectiveTimeScale(NORMAL_TIME_SCALE);
      }
      nextAction.setEffectiveWeight(FULL_WEIGHT);

      if (prevAction && prevAction !== nextAction) {
        // warp=true enables time-scale syncing for realistic blend
        prevAction.crossFadeTo(nextAction, fadeTime, true);
      } else {
        nextAction.fadeIn(fadeTime);
      }

      nextAction.play();

      currentActionNameRef.current = targetName;
      inFlightFadeRef.current = { to: targetName, until: now + fadeTime };

      // Single deterministic cleanup: stop *every* non-current action after the fade.
      const id = window.setTimeout(() => {
        stopTimeoutsRef.current.delete(id);
        Object.entries(actions).forEach(([k, a]) => {
          if (k !== currentActionNameRef.current && a && a.getEffectiveWeight() < 0.01) {
            // Preserve Idle's continuous timeline to avoid breathing rhythm reset pops
            if (k !== 'Idle') a.stop();
          }
        });
        inFlightFadeRef.current = null;
      }, fadeTime * MS_PER_SECOND);
      stopTimeoutsRef.current.add(id);
    },
    [actions, movementEnabled]
  );

  const startRandomTalk = useCallback(() => {
    const { lastTalkIndex } = timelineStateRef.current;
    let nextIndex: number;

    if (talkActionNames.length > SINGLE_ANIMATION_COUNT) {
      do {
        nextIndex = Math.floor(Math.random() * talkActionNames.length);
      } while (nextIndex === lastTalkIndex);
    } else {
      nextIndex = FIRST_INDEX;
    }

    timelineStateRef.current = {
      phase: 'talking',
      timeInPhase: INITIAL_TIME,
      targetBreakDuration: INITIAL_TIME,
      lastTalkIndex: nextIndex,
    };

    playAnimation(talkActionNames[nextIndex]);
  }, [talkActionNames, playAnimation]);

  const pipelineStateRef = useRef(pipelineState);
  useEffect(() => {
    pipelineStateRef.current = pipelineState;
  }, [pipelineState]);

  useEffect(() => {
    if (!mixer) return;

    const onFinished = (e: THREE.Event) => {
      // @ts-expect-error Three.js AnimationAction event typing is loose
      const finishedName = e.action?.getClip()?.name;

      // DEFENSIVE: Stale callback prevention
      // Ignore 'finished' events from previous animations that were stopped during a crossfade.
      if (currentActionNameRef.current !== finishedName) return;

      let isAudioPlaying = false;
      const audioContext = getAudioContext?.();
      
      if (getIsAudioPlaying) {
        isAudioPlaying = getIsAudioPlaying();
      } else if (playbackStartTimeRef?.current != null && audioContext) {
        if (audioContext.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
          isAudioPlaying = true;
          if (pipelineStateRef.current !== 'speaking') {
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
        
      const isEffectivelySpeaking = pipelineStateRef.current === 'speaking' || isAudioPlaying;

      if (finishedName && typeof finishedName === 'string' && finishedName.startsWith('Talk_')) {
        if (isEffectivelySpeaking) {
          let remainingAudio = 0;
          if (getNextPlaybackTime && audioContext) {
            const audioEndTime = getNextPlaybackTime();
            if (Number.isFinite(audioEndTime)) {
              remainingAudio = Math.max(0, audioEndTime - audioContext.currentTime);
            }
          } else if (mouthCuesRef?.current && mouthCuesRef.current.length > 0 && playbackStartTimeRef?.current != null && audioContext) {
            const lastCue = mouthCuesRef.current[mouthCuesRef.current.length - 1];
            const validEnd = Number.isFinite(lastCue?.end) ? Number(lastCue.end) : 0;
            const audioEndTime = playbackStartTimeRef.current + validEnd;
            
            if (Number.isFinite(audioEndTime)) {
              remainingAudio = Math.max(0, audioEndTime - audioContext.currentTime);
            }
          }

          // Add subtle random jitter so breathing pauses don't feel perfectly mathematical
          const jitter = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x
          let breakDuration = Number.isFinite(remainingAudio) && remainingAudio > 0 ? (remainingAudio * 0.2) * jitter : 0;
          breakDuration = Math.min(1.5, Math.max(0.4, breakDuration));

          timelineStateRef.current = {
            ...timelineStateRef.current,
            phase: 'idle_break',
            timeInPhase: INITIAL_TIME,
            targetBreakDuration: breakDuration,
          };
          playAnimation('Idle');
        } else {
          // No freeze: Audio has already stopped, so transition to Idle immediately
          timelineStateRef.current = {
            ...timelineStateRef.current,
            phase: 'idle',
            timeInPhase: INITIAL_TIME,
            targetBreakDuration: INITIAL_TIME,
          };
          playAnimation('Idle');
        }
      }
    };

    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
    };
  }, [mixer, playAnimation, getAudioContext, playbackStartTimeRef, mouthCuesRef, getIsAudioPlaying, getNextPlaybackTime]);

  useEffect(() => {
    return () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }
      stopTimeoutsRef.current.forEach(id => window.clearTimeout(id));
      stopTimeoutsRef.current.clear();
    };
  }, [mixer, scene]);

  useEffect(() => {
    if (!movementEnabled) {
      if (timelineStateRef.current.phase === 'talking') {
        timelineStateRef.current.phase = 'idle';
      }
      playAnimation('Idle');
      return;
    }

    if (pipelineState === 'thinking' || pipelineState === 'error' || pipelineState === 'idle') {
      timelineStateRef.current = {
        phase: 'idle',
        timeInPhase: INITIAL_TIME,
        targetBreakDuration: INITIAL_TIME,
        lastTalkIndex: NO_INDEX,
      };
      playAnimation('Idle');
    }
  }, [pipelineState, movementEnabled, playAnimation]);

  useFrame((state, delta) => {
    const timeline = timelineStateRef.current;
    const currentState = pipelineStateRef.current;
    
    let isAudioPlaying = false;
    if (getIsAudioPlaying) {
      isAudioPlaying = getIsAudioPlaying();
    } else if (playbackStartTimeRef?.current != null) {
      const audioContext = getAudioContext?.();
      if (audioContext?.state === 'running' && audioContext.currentTime >= playbackStartTimeRef.current) {
        isAudioPlaying = true;
        if (currentState !== 'speaking') {
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

    const isEffectivelySpeaking = currentState === 'speaking' || isAudioPlaying;

    if (isEffectivelySpeaking && isAudioPlaying) {
      if (timeline.phase === 'idle') {
        startRandomTalk();
      } else if (timeline.phase === 'idle_break') {
        timeline.timeInPhase += delta;
        if (timeline.timeInPhase >= timeline.targetBreakDuration) {
          startRandomTalk();
        }
      }
    } else if (!isEffectivelySpeaking && timeline.phase !== 'idle') {
      // Debounce: only force-return to Idle after 0.5s of confirmed silence
      timeline.timeInPhase += delta;
      if (timeline.timeInPhase > 0.5) {
        timeline.phase = 'idle';
        playAnimation('Idle');
      }
    }
  });

  return { actions, mixer };
}
