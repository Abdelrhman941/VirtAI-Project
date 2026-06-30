import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useClassroomAudio } from '@/widgets/Classroom/hooks/useClassroomAudio';
import { AvatarCanvasWrapper } from '@/widgets/Classroom/AvatarCanvasWrapper';
import { useLipSyncConfigStore, presets, LipSyncParams } from '@/features/avatar/store/useLipSyncConfigStore';


const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];

export default function AvatarPlayground() {
  const { params, updateParam, resetParams, setPlaygroundActive, loadPreset } = useLipSyncConfigStore();


  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Store the last fetched TTS response so we can replay it without hitting the backend
  const lastFetchedTtsRef = useRef<{ audio_url: string; duration_ms: number; visemes: any[] } | null>(null);

  // A/B Testing state
  const [presetA, setPresetA] = useState<LipSyncParams | null>(null);
  const [presetB, setPresetB] = useState<LipSyncParams | null>(null);
  const [activePreset, setActivePreset] = useState<'A' | 'B'>('A');

  const [isFrozen, setIsFrozen] = useState(false);
  const morphTargetValuesRef = useRef<Record<string, number>>({});
  const currentTimeOverrideRef = useRef<number | null>(null);
  const debugOverlayRef = useRef<HTMLDivElement>(null);
  const timelineCursorRef = useRef<HTMLDivElement>(null);
  const [currentVisemes, setCurrentVisemes] = useState<any[]>([]);

  const {
    mouthCuesRef,
    getAudioContext,
    unlockAudioContext,
    playbackStartTimeRef,
    handleTtsReady,
    handleVisemesReady,
    resetAvatarAudio,
    getIsAudioPlaying,
    getNextPlaybackTime,
    getAnalyserNode,
    setPlaybackRate,
  } = useClassroomAudio();

  useEffect(() => {
    setPlaygroundActive(true);
    return () => setPlaygroundActive(false);
  }, [setPlaygroundActive]);

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeedState(speed);
    setPlaybackRate?.(speed);
  };

  const playPayload = useCallback((payload: { audio_url: string; duration_ms: number; visemes: any[] }) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const messageId = crypto.randomUUID();
    
    handleVisemesReady(messageId, payload.visemes);
    handleTtsReady(messageId, payload.audio_url, payload.duration_ms);
  }, [getAudioContext, handleVisemesReady, handleTtsReady]);

  useEffect(() => {
    let animationFrameId: number;
    const updateDebugUI = () => {
      if (debugOverlayRef.current && morphTargetValuesRef.current) {
        const vals = morphTargetValuesRef.current;
        debugOverlayRef.current.innerText = `Jaw: ${vals.jawOpen?.toFixed(3) || '0.000'} | AA: ${vals.viseme_aa?.toFixed(3) || '0.000'} | O: ${vals.viseme_O?.toFixed(3) || '0.000'} | Smile: ${vals.mouthSmileLeft?.toFixed(3) || '0.000'} | Blink: ${vals.eyeBlinkLeft?.toFixed(3) || '0.000'}`;
      }
      if (timelineCursorRef.current && lastFetchedTtsRef.current) {
        const totalDuration = lastFetchedTtsRef.current.duration_ms / 1000;
        let elapsed = 0;
        if (currentTimeOverrideRef.current != null) {
          elapsed = currentTimeOverrideRef.current;
        } else {
          const ctx = getAudioContext();
          if (ctx.state === 'running' && playbackStartTimeRef.current != null) {
            elapsed = ctx.currentTime - playbackStartTimeRef.current;
          }
        }
        const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        timelineCursorRef.current.style.left = `${percent}%`;
      }
      animationFrameId = requestAnimationFrame(updateDebugUI);
    };
    updateDebugUI();
    return () => cancelAnimationFrame(animationFrameId);
  }, [getAudioContext, playbackStartTimeRef]);

  const handleSpeak = async () => {
    setIsGenerating(true);
    try {
      await unlockAudioContext();
      resetAvatarAudio(); 
      setIsFrozen(false);
      currentTimeOverrideRef.current = null;
      
      const response = await fetch('/audio/previews/guy.json');
      const visemes = await response.json();
      setCurrentVisemes(visemes);
      
      const duration = visemes.length > 0 ? visemes[visemes.length - 1].end * 1000 : 5000;
      const payload = { audio_url: window.location.origin + '/audio/previews/guy.mp3', duration_ms: duration, visemes };
      
      lastFetchedTtsRef.current = payload;
      playPayload(payload);
    } catch (err) {
      console.error("[Playground] Failed to load preview assets:", err);
      alert("Failed to load preview assets.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFreezeToggle = () => {
    if (isFrozen) {
      setIsFrozen(false);
      currentTimeOverrideRef.current = null;
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
    } else {
      setIsFrozen(true);
      const ctx = getAudioContext();
      if (ctx.state === 'running') {
        const elapsed = ctx.currentTime - (playbackStartTimeRef.current || 0);
        currentTimeOverrideRef.current = elapsed;
        ctx.suspend();
      } else {
        currentTimeOverrideRef.current = 0;
      }
    }
  };

  const handleFrameStep = (stepMs: number) => {
    if (!isFrozen) handleFreezeToggle();
    const current = currentTimeOverrideRef.current || 0;
    currentTimeOverrideRef.current = Math.max(0, current + stepMs / 1000);
  };

  const handleReplay = async () => {
    if (!lastFetchedTtsRef.current) return;
    await unlockAudioContext();
    resetAvatarAudio();
    playPayload(lastFetchedTtsRef.current);
  };

  const handleStop = () => {
    resetAvatarAudio();
  };

  const handlePause = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'running') ctx.suspend();
  };

  const handleResume = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  };

  // Loop monitor
  useEffect(() => {
    if (!loopEnabled) return;
    const interval = setInterval(() => {
      const isPlaying = getIsAudioPlaying();
      if (!isPlaying && lastFetchedTtsRef.current && !isGenerating) {
        // If we have a payload and we are not playing, trigger replay
        handleReplay();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [loopEnabled, getIsAudioPlaying, handleReplay, isGenerating]);


  const handleSaveToA = () => setPresetA(params);
  const handleSaveToB = () => setPresetB(params);
  const handleToggleAB = () => {
    if (activePreset === 'A' && presetB) {
      Object.entries(presetB).forEach(([k, v]) => updateParam(k as keyof LipSyncParams, v as any));
      setActivePreset('B');
    } else if (activePreset === 'B' && presetA) {
      Object.entries(presetA).forEach(([k, v]) => updateParam(k as keyof LipSyncParams, v as any));
      setActivePreset('A');
    }
  };

  const exportJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(params, null, 2));
    alert('JSON copied to clipboard!');
  };

  const exportTS = () => {
    const tsCode = `export const customLipSyncParams: Partial<LipSyncParams> = ${JSON.stringify(params, null, 2)};`;
    navigator.clipboard.writeText(tsCode);
    alert('TypeScript copied to clipboard!');
  };

  return (
    <div className="flex h-screen w-full bg-[#0A0908] text-white overflow-hidden">
      {/* LEFT PANEL: CONTROLS */}
      <div className="w-1/3 h-full overflow-y-auto border-r border-white/10 p-6 flex flex-col gap-6 bg-dark-secondary/50 scrollbar-hide">
        <h1 className="text-2xl font-bold text-gold shrink-0">Lip Sync Playground</h1>

        <div className="flex flex-col gap-4 shrink-0">
          {/* PLAYBACK CONTROLS */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSpeak}
              disabled={isGenerating}
              className="col-span-2 bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold-soft disabled:opacity-50"
            >
              {isGenerating ? 'Loading...' : 'PLAY PREVIEW (guy.mp3)'}
            </button>
            <button onClick={handleReplay} disabled={!lastFetchedTtsRef.current} className="bg-white/10 py-2 rounded text-sm hover:bg-white/20 disabled:opacity-30">
              Replay Last
            </button>
            <button onClick={handleStop} className="bg-red-500/20 text-red-300 py-2 rounded text-sm hover:bg-red-500/40">
              Stop
            </button>
            <button onClick={handlePause} className="bg-white/5 py-2 rounded text-sm hover:bg-white/10">
              Pause
            </button>
            <button onClick={handleResume} className="bg-white/5 py-2 rounded text-sm hover:bg-white/10">
              Resume
            </button>
            <button 
              onClick={() => setLoopEnabled(!loopEnabled)} 
              className={`col-span-2 py-2 rounded text-sm border ${loopEnabled ? 'bg-gold/20 text-gold border-gold/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
            >
              Loop Playback: {loopEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Playback Speed</label>
            <div className="flex gap-1">
              {PLAYBACK_SPEEDS.map(speed => (
                <button
                  key={speed}
                  onClick={() => handlePlaybackSpeedChange(speed)}
                  className={`flex-1 py-1 text-xs rounded border ${playbackSpeed === speed ? 'bg-gold text-black border-gold' : 'bg-white/5 text-gray-300 border-transparent hover:bg-white/10'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>


        <div className="flex flex-col gap-6 pb-12">
          <ControlGroup title="Head Bob">
            <SliderControl label="Frequency" min={0} max={10} step={0.1} value={params.headBobFrequency} onChange={(v) => updateParam('headBobFrequency', v)} />
            <SliderControl label="Amplitude" min={0} max={0.2} step={0.01} value={params.headBobAmplitude} onChange={(v) => updateParam('headBobAmplitude', v)} />
          </ControlGroup>

          <ControlGroup title="Blinking">
            <SliderControl label="Duration" min={0} max={1} step={0.01} value={params.blinkDuration} onChange={(v) => updateParam('blinkDuration', v)} />
            <SliderControl label="Base Delay" min={0} max={10} step={0.1} value={params.blinkBaseDelay} onChange={(v) => updateParam('blinkBaseDelay', v)} />
            <SliderControl label="Random Variance" min={0} max={10} step={0.1} value={params.blinkRandomVariance} onChange={(v) => updateParam('blinkRandomVariance', v)} />
          </ControlGroup>

          <ControlGroup title="Expressions">
            <SliderControl label="Smile (Speaking)" min={0} max={1} step={0.01} value={params.smileSpeaking} onChange={(v) => updateParam('smileSpeaking', v)} />
            <SliderControl label="Brow (Thinking)" min={0} max={1} step={0.01} value={params.browThinking} onChange={(v) => updateParam('browThinking', v)} />
            <SliderControl label="Frown (Thinking)" min={0} max={1} step={0.01} value={params.frownThinking} onChange={(v) => updateParam('frownThinking', v)} />
          </ControlGroup>

          <ControlGroup title="Interpolation">
            <SliderControl label="Default Damp Speed" min={1} max={30} step={0.5} value={params.defaultDampSpeed} onChange={(v) => updateParam('defaultDampSpeed', v)} />
            <SliderControl label="Fallback Damping" min={1} max={20} step={0.5} value={params.fallbackDamping} onChange={(v) => updateParam('fallbackDamping', v)} />
            <SliderControl label="Consonant Speed Mult" min={0.1} max={5} step={0.1} value={params.consonantSpeedMultiplier} onChange={(v) => updateParam('consonantSpeedMultiplier', v)} />
            <SliderControl label="Vowel Speed Mult" min={0.1} max={5} step={0.1} value={params.vowelSpeedMultiplier} onChange={(v) => updateParam('vowelSpeedMultiplier', v)} />
            <SliderControl label="FFT Speed Mult" min={0.1} max={5} step={0.1} value={params.fftSpeedMultiplier} onChange={(v) => updateParam('fftSpeedMultiplier', v)} />
          </ControlGroup>

          <ControlGroup title="Viseme Multipliers (FFT)">
            <SliderControl label="SS Multiplier" min={0} max={3} step={0.1} value={params.visemeSSMultiplier} onChange={(v) => updateParam('visemeSSMultiplier', v)} />
            <SliderControl label="AA Multiplier" min={0} max={3} step={0.1} value={params.visemeAAMultiplier} onChange={(v) => updateParam('visemeAAMultiplier', v)} />
            <SliderControl label="O Multiplier" min={0} max={3} step={0.1} value={params.visemeOMultiplier} onChange={(v) => updateParam('visemeOMultiplier', v)} />
            <SliderControl label="Jaw Open Mult" min={0} max={2} step={0.01} value={params.jawOpenMultiplier} onChange={(v) => updateParam('jawOpenMultiplier', v)} />
          </ControlGroup>
        </div>
      </div>

      {/* RIGHT PANEL: CANVAS & DEBUG OVERLAY */}
      <div className="w-2/3 h-full relative bg-gradient-to-b from-[#1A1A1A] to-[#000000]">
        <AvatarCanvasWrapper
          avatarId="avatar1"
          pipelineState={getIsAudioPlaying() || isFrozen ? "speaking" : "idle"}
          movementEnabled={false}
          mouthCuesRef={mouthCuesRef}
          getAudioContext={getAudioContext}
          playbackStartTimeRef={playbackStartTimeRef}
          getIsAudioPlaying={getIsAudioPlaying}
          getNextPlaybackTime={getNextPlaybackTime}
          getAnalyserNode={getAnalyserNode}
          morphTargetValuesRef={morphTargetValuesRef}
          currentTimeOverrideRef={currentTimeOverrideRef}
        />
        
        <div className="absolute bottom-8 left-4 right-4 bg-black/80 backdrop-blur border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-mono text-gray-300">
            <div className="flex items-center gap-4">
               <span>Viseme Timeline</span>
               <div className="flex gap-2">
                 <button onClick={() => handleFrameStep(-16)} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded">{'<'} 16ms</button>
                 <button onClick={handleFreezeToggle} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded">{isFrozen ? 'UNFREEZE' : 'FREEZE'}</button>
                 <button onClick={() => handleFrameStep(16)} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded">16ms {'>'}</button>
               </div>
            </div>
            <div ref={debugOverlayRef} className="text-green-400 font-bold" />
          </div>
          <div className="relative w-full h-8 bg-black border border-white/10 overflow-hidden">
            {currentVisemes.map((v, i) => {
              const totalDuration = lastFetchedTtsRef.current ? lastFetchedTtsRef.current.duration_ms / 1000 : 5;
              const left = (v.start / totalDuration) * 100;
              const width = ((v.end - v.start) / totalDuration) * 100;
              return (
                <div key={i} className="absolute h-full border-r border-black flex items-center justify-center text-[10px] text-black overflow-hidden font-bold" 
                     style={{ left: `${left}%`, width: `${width}%`, backgroundColor: v.value === 'X' ? '#333' : '#D4B47A' }}>
                  {v.value}
                </div>
              );
            })}
            <div ref={timelineCursorRef} className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: '0%' }} />
          </div>
        </div>
        
        {/* DEBUG OVERLAY - Read directly from DOM to avoid React renders where possible */}
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur border border-white/10 p-4 rounded-xl text-xs font-mono text-green-400 pointer-events-none min-w-[200px] shadow-2xl">
          <h3 className="text-white font-sans font-bold mb-2 uppercase tracking-widest text-[10px]">Playground Engine</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-400">Audio Playing:</span>
            <span className="text-right">{getIsAudioPlaying() ? 'YES' : 'NO'}</span>
            <span className="text-gray-400">Playback Speed:</span>
            <span className="text-right">{playbackSpeed}x</span>
            <span className="text-gray-400">Looping:</span>
            <span className="text-right">{loopEnabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide border-b border-white/5 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function SliderControl({ label, min, max, step, value, onChange }: { label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gold font-mono">{value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-gold bg-white/10 rounded-full h-1 appearance-none cursor-pointer"
      />
    </div>
  );
}
