import { AvatarComponent } from '@/features/avatar/components/AvatarComponent';
import { Viseme } from '@/features/voice/hooks/useGaplessAudioQueue';
import { logger } from '@/shared/utils/logger';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const CAMERA_POS_X = 0;
const CAMERA_POS_Y = 1.4;
const CAMERA_POS_Z = 1.8;
const CAMERA_FOV = 45;
const TARGET_POS_X = 0;
const TARGET_POS_Y = 1.25;
const TARGET_POS_Z = 0;
const AMBIENT_INTENSITY = 0.5;
const DIR_LIGHT_POS_X = 1;
const DIR_LIGHT_POS_Y = 2;
const DIR_LIGHT_POS_Z = 3;
const DIR_LIGHT_INTENSITY = 1;

interface AvatarCanvasWrapperProps {
  avatarId: string;
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  movementEnabled: boolean;
  mouthCuesRef: React.MutableRefObject<Viseme[]>;
  getAudioContext: () => AudioContext;
  playbackStartTimeRef: React.MutableRefObject<number | null>;
  getIsAudioPlaying: () => boolean;
  getNextPlaybackTime: () => number;
  getAnalyserNode: () => AnalyserNode | null;
  morphTargetValuesRef?: React.MutableRefObject<Record<string, number>>;
  currentTimeOverrideRef?: React.MutableRefObject<number | null>;
}

// Synchronously dispose WebGL resources on unmount to prevent R3F from lingering
// across route transitions (was the root cause of the Framer Motion exit deadlock).
const CanvasDisposer = memo(function CanvasDisposer() {
  const { gl, scene } = useThree();
  const glRef = useRef(gl);
  const sceneRef = useRef(scene);

  useEffect(() => {
    glRef.current = gl;
    sceneRef.current = scene;
  });

  useEffect(() => {
    return () => {
      sceneRef.current.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: THREE.Material) => m.dispose());
        }
      });
      // Do NOT dispose the renderer (gl) — R3F <Canvas> owns its WebGL context lifecycle.
    };
  }, []);

  return null;
});

const WebGLContextWatcher = memo(({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) => {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const handleLost = (e: Event) => { e.preventDefault(); onLost(); };
    const handleRestored = () => onRestored();

    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onLost, onRestored]);

  return null;
});

export const AvatarCanvasWrapper = memo(function AvatarCanvasWrapper({
  avatarId,
  pipelineState,
  movementEnabled,
  mouthCuesRef,
  getAudioContext,
  playbackStartTimeRef,
  getIsAudioPlaying,
  getNextPlaybackTime,
  getAnalyserNode,
  morphTargetValuesRef,
  currentTimeOverrideRef,
}: AvatarCanvasWrapperProps) {
  const [isContextLost, setIsContextLost] = useState(false);

  const handleContextLost = useCallback(() => {
    logger.warn('WebGL Context Lost! Gracefully pausing 3D rendering.');
    setIsContextLost(true);
  }, []);

  const handleContextRestored = useCallback(() => {
    logger.info('WebGL Context Restored! Resuming 3D rendering.');
    setIsContextLost(false);
  }, []);

  return (
    <div className="w-full h-full relative">
      {isContextLost && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <p className="text-white">Recovering Avatar Graphics...</p>
        </div>
      )}

      <h1
        className="classroom-watermark absolute bottom-4 left-4 z-50 m-0 text-[1.75rem] font-bold tracking-tight opacity-50 pointer-events-none"
      >
        <span className="text-[color:var(--text-primary)]">Virt</span>
        <span className="text-[color:var(--color-gold)]">AI</span>
      </h1>

      <Canvas
        onCreated={(state) => {
          const evidence = {
            camera: {
              position: state.camera.position.toArray(),
              fov: (state.camera as THREE.PerspectiveCamera).fov,
              aspect: (state.camera as THREE.PerspectiveCamera).aspect,
            },
            gl: { size: state.size, viewport: state.viewport },
          };
          logger.debug('[Runtime Evidence] Canvas Created:', evidence);
        }}
      >
        <CanvasDisposer />
        <WebGLContextWatcher onLost={handleContextLost} onRestored={handleContextRestored} />
        <PerspectiveCamera makeDefault position={[CAMERA_POS_X, CAMERA_POS_Y, CAMERA_POS_Z]} fov={CAMERA_FOV} />
        <OrbitControls target={[TARGET_POS_X, TARGET_POS_Y, TARGET_POS_Z]} enablePan={false} />
        <ambientLight intensity={AMBIENT_INTENSITY} />
        <directionalLight position={[DIR_LIGHT_POS_X, DIR_LIGHT_POS_Y, DIR_LIGHT_POS_Z]} intensity={DIR_LIGHT_INTENSITY} />

        <AvatarComponent
          avatarId={avatarId}
          pipelineState={pipelineState}
          movementEnabled={movementEnabled}
          mouthCuesRef={mouthCuesRef}
          getAudioContext={getAudioContext}
          playbackStartTimeRef={playbackStartTimeRef}
          getIsAudioPlaying={getIsAudioPlaying}
          getNextPlaybackTime={getNextPlaybackTime}
          getAnalyserNode={getAnalyserNode}
          morphTargetValuesRef={morphTargetValuesRef}
          currentTimeOverrideRef={currentTimeOverrideRef}
        />
      </Canvas>
    </div>
  );
});
