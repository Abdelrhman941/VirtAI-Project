import { useAvatarAnimations } from '@/features/avatar/hooks/useAvatarAnimations';
import { useAvatarLipSync } from '@/features/avatar/hooks/useAvatarLipSync';
import { Viseme } from '@/features/voice/hooks/useGaplessAudioQueue';
import { logger } from '@/shared/utils/logger';
import { notify } from '@/shared/utils/notify';
import { logger } from '@/shared/utils/logger';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

export interface AvatarComponentProps {
  avatarId: string;
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  movementEnabled?: boolean;
  mouthCuesRef?: React.MutableRefObject<Viseme[]>;
  getAudioContext?: () => AudioContext;
  playbackStartTimeRef?: React.MutableRefObject<number | null>;
  getIsAudioPlaying?: () => boolean;
  getNextPlaybackTime?: () => number;
  getAnalyserNode?: () => AnalyserNode | null;
  morphTargetValuesRef?: React.MutableRefObject<Record<string, number>>;
  currentTimeOverrideRef?: React.MutableRefObject<number | null>;
}

interface GLTFResult {
  scene: THREE.Group;
  nodes: Record<string, THREE.Object3D | THREE.Mesh>;
}

/**
 * AvatarComponent — 3D avatar renderer.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ARM RELAXATION — POSTURE CONVENTION (fixes the "arm behind body" bug)
 * ────────────────────────────────────────────────────────────────────────
 *
 * Root cause of the previous bug:
 *   • baseline (this file)  premultiplied  +20°  around **X-axis** on BOTH sides.
 *   • clip relaxation (`relaxArmPosture` in useAvatarAnimations.ts) applied -15°
 *     around **X-axis** on BOTH sides.
 *   • Net effect at rest: baseline (+20°) alone = 20° arm pitch BACKWARD
 *     (X-axis on Mixamo/RPM rigs = pitch, not roll → wrong axis for a shoulder drop).
 *     Also, mirroring L/R with the same quaternion sends BOTH arms in the same
 *     world-direction (they should mirror), so one arm ended up "behind the body".
 *
 * Correct convention (used everywhere now):
 *   • Axis:   Z  (roll, i.e. adduction — arm drops toward the torso).
 *   • Angle:  small negative on the LEFT side; INVERTED on the RIGHT side.
 *   • Applied identically in baseline AND clip tracks so rest ↔ animation align.
 *
 *   qDropArmL      = axisAngle(Z, -12°)    → left arm drops closer to torso
 *   qDropArmR      = qDropArmL.invert()    → mirror for right arm
 *   qDropShoulderL = axisAngle(Z,  -4°)    → very subtle clavicle relaxation
 *   qDropShoulderR = qDropShoulderL.invert()
 *
 * Any change to these angles must be mirrored in `useAvatarAnimations.ts`.
 * ────────────────────────────────────────────────────────────────────────
 */
export function AvatarComponent({
  avatarId,
  pipelineState,
  movementEnabled = true,
  mouthCuesRef,
  getAudioContext,
  playbackStartTimeRef,
  getIsAudioPlaying,
  getNextPlaybackTime,
  getAnalyserNode,
  morphTargetValuesRef,
  currentTimeOverrideRef,
}: AvatarComponentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const avatarUrl = `/models/${avatarId}.glb`;
  const { scene } = useGLTF(avatarUrl) as unknown as GLTFResult;

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone) as unknown as GLTFResult;

  const avatarRoot = useMemo(() => {
    // ✅ FIX: match sign, axis, AND L/R mirror with useAvatarAnimations.relaxArmPosture()
    // Z-axis (roll) with negative sign drops the arm inward (adduction).
    // Right side uses inverse quaternion so both arms mirror correctly.
    const qDropArmL = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(-12),
    );
    const qDropArmR = qDropArmL.clone().invert();

    const qDropShoulderL = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(-4),
    );
    const qDropShoulderR = qDropShoulderL.clone().invert();

    clone.traverse((node) => {
      if (!(node as THREE.Bone).isBone) return;
      const bone = node as THREE.Bone;

      if (bone.name.startsWith('LeftArm')) {
        bone.quaternion.premultiply(qDropArmL);
      } else if (bone.name.startsWith('RightArm')) {
        bone.quaternion.premultiply(qDropArmR);
      } else if (bone.name.startsWith('LeftShoulder')) {
        bone.quaternion.premultiply(qDropShoulderL);
      } else if (bone.name.startsWith('RightShoulder')) {
        bone.quaternion.premultiply(qDropShoulderR);
      }
    });

    return clone;
  }, [clone]);

  useAvatarAnimations(
    avatarRoot as THREE.Group,
    pipelineState,
    movementEnabled,
    getAudioContext,
    playbackStartTimeRef,
    mouthCuesRef,
    getIsAudioPlaying,
    getNextPlaybackTime,
  );

  const toastShownRef = useRef(false);

  const targetMeshes = useMemo(() => {
    if (!nodes) return [];
    return Object.values(nodes).filter((node) => {
      const mesh = node as THREE.SkinnedMesh;
      if (
        mesh.isSkinnedMesh &&
        mesh.morphTargetDictionary &&
        mesh.morphTargetInfluences
      ) {
        logger.debug(
          `[AvatarComponent] Morph Targets on ${mesh.name}:`,
          Object.keys(mesh.morphTargetDictionary),
        );
        return true;
      }
      return false;
    }) as THREE.SkinnedMesh[];
  }, [nodes]);

  useEffect(() => {
    if (nodes && targetMeshes.length === 0 && !toastShownRef.current) {
      logger.warn(
        '[AvatarComponent] Missing morphTargetDictionary or morphTargetInfluences. Lip-sync will fail silently.',
      );
      notify.warning(
        'Avatar Warning',
        'Lip-sync targets missing. Using fallback animation.',
      );
      toastShownRef.current = true;
    }
  }, [nodes, targetMeshes]);

  useAvatarLipSync({
    targetMeshes,
    pipelineState,
    mouthCuesRef,
    getAudioContext,
    playbackStartTimeRef,
    getIsAudioPlaying,
    getNextPlaybackTime,
    getAnalyserNode,
    groupRef,
    morphTargetValuesRef,
    currentTimeOverrideRef,
  });

  useEffect(() => {
    if (clone && groupRef.current) {
      const box = new THREE.Box3().setFromObject(clone);
      const evidence = {
        box: {
          minY: box.min.y,
          maxY: box.max.y,
          height: box.max.y - box.min.y,
          centerY: (box.min.y + box.max.y) / 2,
        },
        modelTransform: {
          position: groupRef.current.position.toArray(),
          scale: groupRef.current.scale.toArray(),
          rotation: groupRef.current.rotation.toArray(),
        },
      };
      logger.debug('[Runtime Evidence] Avatar Mount:', evidence);
    }
  }, [clone]);

  useEffect(() => {
    return () => {
      if (groupRef.current) groupRef.current.clear();
    };
  }, []);

  return (
    <group position={[0, -0.2, 0]}>
      <primitive object={clone} ref={groupRef} />
    </group>
  );
}
