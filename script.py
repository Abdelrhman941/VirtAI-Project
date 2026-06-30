import re

with open('D:/A/Projects/VirtAI-Project/frontend/src/pages/AvatarPlayground.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(\"import apiClient from '@/core/api/apiClient';\", \"\")
code = code.replace(\"import { useLipSyncConfigStore, presets, LipSyncParams }\", \"import { useLipSyncConfigStore, LipSyncParams }\")
code = code.replace(\"const SPEECH_SCENARIOS = [\", \"// Fixed Preview Mode\\nconst SPEECH_SCENARIOS = [\")

# Replace handleSpeak
handle_speak_pattern = r\"  const handleSpeak = async \(\) => \{.*?  \};\"
new_handle_speak = \"\"\"  const [isFrozen, setIsFrozen] = useState(false);
  const morphTargetValuesRef = useRef<Record<string, number>>({});
  const currentTimeOverrideRef = useRef<number | null>(null);
  const debugOverlayRef = useRef<HTMLDivElement>(null);
  const timelineCursorRef = useRef<HTMLDivElement>(null);
  const [currentVisemes, setCurrentVisemes] = useState<any[]>([]);

  useEffect(() => {
    let animationFrameId: number;
    const updateDebugUI = () => {
      if (debugOverlayRef.current && morphTargetValuesRef.current) {
        const vals = morphTargetValuesRef.current;
        debugOverlayRef.current.innerText = \Jaw: \ | AA: \ | O: \ | Smile: \ | Blink: \\;
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
        timelineCursorRef.current.style.left = \\%\;
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
      const payload = { audio_url: '/audio/previews/guy.mp3', duration_ms: duration, visemes };
      
      lastFetchedTtsRef.current = payload;
      playPayload(payload);
    } catch (err) {
      console.error(\"[Playground] Failed to load preview assets:\", err);
      alert(\"Failed to load preview assets.\");
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
\"\"\"
code = re.sub(handle_speak_pattern, new_handle_speak, code, flags=re.DOTALL)

# Add Timeline UI to right panel
timeline_ui = \"\"\"
        <AvatarCanvasWrapper
          avatarId=\"avatar1\"
          pipelineState={getIsAudioPlaying() || isFrozen ? \"speaking\" : \"idle\"}
          movementEnabled={true}
          mouthCuesRef={mouthCuesRef}
          getAudioContext={getAudioContext}
          playbackStartTimeRef={playbackStartTimeRef}
          getIsAudioPlaying={getIsAudioPlaying}
          getNextPlaybackTime={getNextPlaybackTime}
          getAnalyserNode={getAnalyserNode}
          morphTargetValuesRef={morphTargetValuesRef}
          currentTimeOverrideRef={currentTimeOverrideRef}
        />
        
        <div className=\"absolute bottom-8 left-4 right-4 bg-black/80 backdrop-blur border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2\">
          <div className=\"flex justify-between items-center text-xs font-mono text-gray-300\">
            <div className=\"flex items-center gap-4\">
               <span>Viseme Timeline</span>
               <div className=\"flex gap-2\">
                 <button onClick={() => handleFrameStep(-16)} className=\"px-2 py-1 bg-white/10 hover:bg-white/20 rounded\">{'<'} 16ms</button>
                 <button onClick={handleFreezeToggle} className=\"px-2 py-1 bg-white/10 hover:bg-white/20 rounded\">{isFrozen ? 'UNFREEZE' : 'FREEZE'}</button>
                 <button onClick={() => handleFrameStep(16)} className=\"px-2 py-1 bg-white/10 hover:bg-white/20 rounded\">16ms {'>'}</button>
               </div>
            </div>
            <div ref={debugOverlayRef} className=\"text-green-400 font-bold\" />
          </div>
          <div className=\"relative w-full h-8 bg-black border border-white/10 overflow-hidden\">
            {currentVisemes.map((v, i) => {
              const totalDuration = lastFetchedTtsRef.current ? lastFetchedTtsRef.current.duration_ms / 1000 : 5;
              const left = (v.start / totalDuration) * 100;
              const width = ((v.end - v.start) / totalDuration) * 100;
              return (
                <div key={i} className=\"absolute h-full border-r border-black flex items-center justify-center text-[10px] text-black overflow-hidden font-bold\" 
                     style={{ left: \\%\, width: \\%\, backgroundColor: v.value === 'X' ? '#333' : '#D4B47A' }}>
                  {v.value}
                </div>
              );
            })}
            <div ref={timelineCursorRef} className=\"absolute top-0 bottom-0 w-0.5 bg-red-500 z-10\" style={{ left: '0%' }} />
          </div>
        </div>
\"\"\"
canvas_pattern = r\"<AvatarCanvasWrapper.*?/>\"
code = re.sub(canvas_pattern, timeline_ui, code, flags=re.DOTALL)

with open('D:/A/Projects/VirtAI-Project/frontend/src/pages/AvatarPlayground.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
