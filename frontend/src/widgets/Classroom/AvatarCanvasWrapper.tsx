import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { AvatarComponent } from '@/features/avatar/components/AvatarComponent';
import { Viseme } from '@/features/voice/hooks/useGaplessAudioQueue';
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
const Z_INDEX_OVERLAY = 10;
const INSET_ZERO = 0;

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

// DEFENSIVE: Synchronously dispose WebGL resources on unmount.
// This prevents the R3F render loop from lingering across route transitions,
// which was the root cause of the Framer Motion exit-animation deadlock.
// Without this, the Canvas kept rendering for multiple RAF cycles after unmount,
// holding the JS thread and blocking mode="wait" AnimatePresence from completing.
const CanvasDisposer = memo(function CanvasDisposer() {
  const { gl, scene } = useThree();
  // Use refs so the cleanup closure captures the live instances, not stale closures
  const glRef = useRef(gl);
  const sceneRef = useRef(scene);

  useEffect(() => {
    glRef.current = gl;
    sceneRef.current = scene;
  });

  useEffect(() => {
    return () => {
      // Traverse the scene graph and release all GPU geometry/material/texture memory
      sceneRef.current.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m: THREE.Material) => m.dispose());
        }
      });
      // Dispose materials and geometries, but DO NOT dispose the renderer (gl).
      // React Three Fiber's `<Canvas>` manages the WebGLContext lifecycle.
      // Calling gl.dispose() inside a child component fights the renderer and causes black screens.
    };
  }, []); // empty dep array: run ONLY on unmount

  return null;
});

// DEFENSIVE: WebGL Context Watcher with strict cleanup
const WebGLContextWatcher = memo(({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) => {
  const gl = useThree((state) => state.gl);
  
  useEffect(() => {
    const handleLost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    
    gl.domElement.addEventListener('webglcontextlost', handleLost);
    gl.domElement.addEventListener('webglcontextrestored', onRestored);
    
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', handleLost);
      gl.domElement.removeEventListener('webglcontextrestored', onRestored);
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
  currentTimeOverrideRef
}: AvatarCanvasWrapperProps) {
  const [isContextLost, setIsContextLost] = useState(false);

  const handleContextLost = useCallback(() => {
    console.warn('WebGL Context Lost! Gracefully pausing 3D rendering.');
    setIsContextLost(true);
  }, []);

  const handleContextRestored = useCallback(() => {
    console.info('WebGL Context Restored! Resuming 3D rendering.');
    setIsContextLost(false);
  }, []);

  return (
    <div className="w-full h-full relative">
      {isContextLost && (
        <div style={{ position: 'absolute', inset: INSET_ZERO, zIndex: Z_INDEX_OVERLAY, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
          <p style={{ color: '#fff' }}>Recovering Avatar Graphics...</p>
        </div>
      )}
      <h1
        className="classroom-watermark"
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          fontSize: '1.75rem',
          fontWeight: '700',
          letterSpacing: '-0.02em',
          opacity: 0.5,
          pointerEvents: 'none',
          zIndex: 50,
          margin: 0,
        }}
      >
        <span style={{ color: 'var(--text-primary)' }}>Virt</span>
        <span style={{ color: 'var(--accent-gold, #D4B47A)' }}>AI</span>
      </h1>
      <Canvas onCreated={(state) => {
        const evidence = {
          camera: {
            position: state.camera.position.toArray(),
            fov: (state.camera as THREE.PerspectiveCamera).fov,
            aspect: (state.camera as THREE.PerspectiveCamera).aspect
          },
          gl: {
            size: state.size,
            viewport: state.viewport
          }
        };
        console.log('[Runtime Evidence] Canvas Created:', evidence);
        (window as any).__CAMERA_EVIDENCE = evidence;
      }}>
        {/* CanvasDisposer MUST be first — it runs cleanup before other children unmount */}
        <CanvasDisposer />
        <WebGLContextWatcher onLost={handleContextLost} onRestored={handleContextRestored} />
        <PerspectiveCamera makeDefault position={[CAMERA_POS_X, CAMERA_POS_Y, CAMERA_POS_Z]} fov={CAMERA_FOV} />
        <OrbitControls target={[TARGET_POS_X, TARGET_POS_Y, TARGET_POS_Z]} enablePan={false} enableZoom={false} enableRotate={false} />
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
}, (prevProps, nextProps) => {
  return (
    prevProps.avatarId === nextProps.avatarId &&
    prevProps.pipelineState === nextProps.pipelineState &&
    prevProps.movementEnabled === nextProps.movementEnabled &&
    // Refs generally don't change, but check them just in case
    prevProps.mouthCuesRef === nextProps.mouthCuesRef &&
    prevProps.getAudioContext === nextProps.getAudioContext &&
    prevProps.playbackStartTimeRef === nextProps.playbackStartTimeRef &&
    prevProps.getIsAudioPlaying === nextProps.getIsAudioPlaying &&
    prevProps.getNextPlaybackTime === nextProps.getNextPlaybackTime &&
    prevProps.getAnalyserNode === nextProps.getAnalyserNode
  );
});
