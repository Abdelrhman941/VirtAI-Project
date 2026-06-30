# Audio Pipeline Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate audio playback latency and silent failures by shifting viseme generation to the frontend, optimizing backend streaming, and fixing the terminal error state of the microphone UI, while ensuring zero temporary feature regression.

**Architecture:** 
1. The frontend `VoiceModeButton` will implement a robust retry mechanism to escape error lockouts with comprehensive cleanup.
2. The backend `AnimationStage` will bypass synchronous PyDub audio decoding, emitting the audio URL immediately with an empty visemes array (preserving the API contract).
3. The frontend Web Audio API will use an `AnalyserNode` to generate dynamic, frequency-based visemes in real-time, coupled with exponential moving averages (EMA) and transition damping to prevent jitter.
4. Backend and frontend viseme changes will be deployed in a single batch to guarantee the avatar never loses lip-sync capabilities during migration.

**Tech Stack:** React, Web Audio API, FastAPI, Python `asyncio`, THREE.js.

---

## 1. Executive Summary

**What is broken:**
- **Buffering Deadlock (Critical):** The backend blocks sending audio while waiting for full TTS synthesis *and* synchronous PyDub viseme analysis.
- **Lip-Sync Realism (High):** Visemes are generated via a naive volume threshold (`viseme_aa`), making the avatar look robotic.
- **Mic Button Lockout (High):** UI fails silently and permanently locks the mic button if a websocket/TTS error occurs, ignoring the `canRetry` recovery state.

**What is most urgent:**
1. Mic Button Lockout (prevents users from recovering without a page reload).
2. Backend PyDub Blocking coupled with Frontend AnalyserNode Replacement (must be done together to prevent feature regression).

**What must not be touched yet:**
- The underlying `OpenAITTSProvider` API integration.
- Existing WebSocket payload structures (empty arrays will be sent for deprecated fields to preserve backward compatibility).

---

## 2. Assumptions and Boundaries

**Confirmed by the report:**
- `VoiceModeButton.tsx` has `disabled={!!error}` which locks the UI.
- `AnimationStage` blocks waiting for `viseme_generator.generate_from_audio`.
- API Contracts must remain strictly compatible. `make_visemes_ready` must still be emitted, even if the payload's `mouth_cues` array is empty.

**Performance Metrics to Track:**
- **Time to First Audible Sound (TTFAS):** Time from user ending speech to browser outputting audio.
- **Event Loop Blocking Time (Backend):** Must remain < 50ms per task.
- **Main Thread Blocking Time (Frontend):** Must remain < 16ms to ensure 60fps animation.
- **End-to-end Voice Response Time:** Full conversational turn latency.

---

## 3. Phase-by-Phase Plan

### Phase 1: Stability and Recovery (Mic Button UI)
**Goal:** Allow users to recover from transient WebSocket or TTS errors without refreshing the page, ensuring no memory leaks occur during repeated retry cycles.

#### Task 1: VoiceModeButton Recovery State & Lifecycle
**Files:**
- Modify: `frontend/src/features/voice/components/VoiceModeButton.tsx`
- Modify: `frontend/src/features/voice/hooks/useVoiceMode.ts` (ensure `clearError` cleans up listeners if necessary)
- Test: `frontend/src/features/voice/components/VoiceModeButton.test.tsx`

- [ ] **Step 1: Update VoiceModeButton implementation**
```tsx
// frontend/src/features/voice/components/VoiceModeButton.tsx
// Update the onClick handler, tooltip, and disabled prop:
        onClick={async () => {
          if (error && canRetry) {
            clearError();
            // Ensure any stale connections are reset before retrying
            stopListening(); 
            const canStart = onBeforeStart ? await onBeforeStart() : true;
            if (canStart) startListening();
            return;
          }
          if (!!error) return;
          if (isListening) {
            stopListening();
            return;
          }
          const canStart = onBeforeStart ? await onBeforeStart() : true;
          if (canStart) {
            startListening();
          }
        }}
        title={error && canRetry ? 'Click to Retry' : buttonTitle}
        aria-label={error && canRetry ? 'Retry voice mode' : ariaLabel}
        disabled={!!error && !canRetry}
```

- [ ] **Step 2: Add explicit tests for repeated retries and WS reconnect**
```tsx
// frontend/src/features/voice/components/VoiceModeButton.test.tsx
// Add test cases:
// 1. Verifies that clicking the button while in an error state with canRetry=true invokes clearError() and startListening().
// 2. Verifies that consecutive rapid clicks do not spawn orphaned WebSocket connections.
// 3. Verifies background/foreground tab state handling (mock document visibilitychange).
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/features/voice/components/VoiceModeButton.tsx frontend/src/features/voice/components/VoiceModeButton.test.tsx
git commit -m "fix(ui): allow mic button to retry on recoverable errors with strict cleanup"
```

**Verification Plan (Phase 1):**
- **Success criteria:** Mic button becomes clickable after an error and successfully clears the state.
- **Regression risks:** Overlapping `startListening` calls causing dual microphone streams.
- **Rollback strategy:** Revert to `disabled={!!error}`. No backend changes involved.
- **Expected observable behavior:** Button turns red on error, tooltip changes to "Click to Retry", clicking it resets to normal state.

---

### Phase 2: Low-Latency Real-Time Lip-Sync (Backend & Frontend Combined)
**Goal:** Remove synchronous PyDub decoding from the backend to drastically reduce TTFAS, and implement a jitter-free `AnalyserNode` lip-sync on the frontend in the same batch to avoid feature regression.

#### Task 2: Expose AnalyserNode with Strict Lifecycle
**Files:**
- Modify: `frontend/src/features/voice/hooks/useGaplessAudioQueue.ts`

- [ ] **Step 1: Add AnalyserNode and Cleanup Logic**
```typescript
// frontend/src/features/voice/hooks/useGaplessAudioQueue.ts
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      analyserNodeRef.current = audioContextRef.current.createAnalyser();
      analyserNodeRef.current.fftSize = 256;
      analyserNodeRef.current.smoothingTimeConstant = 0.8; // Built-in WebAudio smoothing
      analyserNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // In flushQueue/unmount cleanup:
  useEffect(() => {
    return () => {
      if (analyserNodeRef.current) {
        analyserNodeRef.current.disconnect();
        analyserNodeRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Expose it:
  return {
    enqueueAudioUrl,
    flushQueue,
    getAudioContext,
    playbackStartTimeRef: visemeBaseStartTimeRef,
    getIsAudioPlaying,
    getNextPlaybackTime,
    getAnalyserNode: useCallback(() => analyserNodeRef.current, []),
  };
```

#### Task 3: Drive Avatar with Jitter-Free Visemes
**Files:**
- Modify: `frontend/src/features/avatar/components/useAvatarLipSync.ts`
- Modify: `frontend/src/widgets/Classroom/hooks/useClassroomAudio.ts`
- Modify: `frontend/src/features/avatar/components/AvatarComponent.tsx`

- [ ] **Step 1: Implement smoothed frequency-based visemes in useAvatarLipSync.ts**
```typescript
// frontend/src/features/avatar/components/useAvatarLipSync.ts
// Add EMA state variables outside useFrame or in a ref:
  const emaRef = useRef({ low: 0, mid: 0, high: 0, energy: 0 });
  const ATTACK = 0.6; // Quick attack
  const RELEASE = 0.2; // Slower release for transition damping
  const SILENCE_THRESHOLD = 15;

// In useFrame, replace the cues-based viseme logic:
      let activeVisemeName: string | null = null;
      if (isEffectivelySpeaking) {
        const analyser = props.getAnalyserNode?.();
        if (analyser) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          
          let rawLow = 0, rawMid = 0, rawHigh = 0;
          for (let i = 0; i < 10; i++) rawLow += dataArray[i];
          for (let i = 10; i < 40; i++) rawMid += dataArray[i];
          for (let i = 40; i < dataArray.length; i++) rawHigh += dataArray[i];
          
          rawLow /= 10; rawMid /= 30; rawHigh /= (dataArray.length - 40);
          
          // Apply Exponential Moving Average for smoothing
          const ema = emaRef.current;
          ema.low += (rawLow > ema.low ? ATTACK : RELEASE) * (rawLow - ema.low);
          ema.mid += (rawMid > ema.mid ? ATTACK : RELEASE) * (rawMid - ema.mid);
          ema.high += (rawHigh > ema.high ? ATTACK : RELEASE) * (rawHigh - ema.high);
          
          const maxEnergy = Math.max(ema.low, ema.mid, ema.high);
          
          if (maxEnergy > SILENCE_THRESHOLD) {
            // Target blending logic based on dominant frequency
            if (ema.low > ema.mid && ema.low > ema.high) activeVisemeName = 'viseme_O';
            else if (ema.mid > ema.low && ema.mid > ema.high) activeVisemeName = 'viseme_aa';
            else activeVisemeName = 'viseme_E';
          } else {
            activeVisemeName = 'viseme_sil';
          }
        }
      }
```

#### Task 4: Bypass Backend Viseme Generation
**Files:**
- Modify: `backend/app/application/voice/pipeline_stages.py`

- [ ] **Step 1: Update AnimationStage**
```python
# backend/app/application/voice/pipeline_stages.py
# In AnimationStage.process, remove the viseme_generator call:
        mouth_cues = [] # Maintain API contract with empty array
        # REMOVED: await self._viseme_generator.generate_from_audio(...)
        
        context.mouth_cues = mouth_cues

        safe_tts_result = context.tts_result or TTSResult(
            audio_bytes=b"",
            visemes=[],
            word_boundaries=[],
            audio_duration_ms=len(text_to_animate or "") * 60.0,
        )

        # Mock audio features since we bypassed analysis
        audio_features = {
            "duration": safe_tts_result.audio_duration_ms / 1000.0,
            "energy_curve": [],
            "word_count": len(text_to_animate.split()) if text_to_animate else 0,
            "speaking_segments": []
        }

        timeline_payload = self._animation_service.build_timeline_v2(
            text=text_to_animate,
            audio_features=audio_features,
            recent_assets=self._recent_animation_assets,
            emotion=context.llm_emotion,
            profile_usage=self._profile_usage,
            intent_history=self._intent_history,
        )
```

- [ ] **Step 2: Commit Phase 2 (Backend + Frontend)**
```bash
git add frontend/src/features/voice/hooks/useGaplessAudioQueue.ts frontend/src/features/avatar/components/useAvatarLipSync.ts frontend/src/widgets/Classroom/hooks/useClassroomAudio.ts frontend/src/features/avatar/components/AvatarComponent.tsx backend/app/application/voice/pipeline_stages.py
git commit -m "feat(audio): migrate to frontend jitter-free lip-sync and remove backend pydub bottleneck"
```

**Verification Plan (Phase 2):**
- **Success criteria:** TTFAS is reduced by the time previously spent in `viseme_generator.py`. Avatar mouth moves fluidly without jitter, responding to vowels accurately. API contract (`make_visemes_ready` event) remains intact.
- **Regression risks:** `AnalyserNode` memory leaks if not cleaned up during AudioContext closure. Viseme arrays received from backend are empty, so any hard dependency on them in `useAvatarLipSync` must be removed gracefully.
- **Rollback strategy:** Revert the Phase 2 commit. Backend will resume processing PyDub visemes and frontend will fallback to using the `mouthCuesRef` from WebSocket events.
- **Expected observable behavior:** Instant audio playback start with smooth, realistic mouth movements.

---

## 4. Priority Order

1. **Phase 1 (Mic Button UI):** Safest, high UX impact. Fixes the permanent lockout. Standalone deployable.
2. **Phase 2 (Latency + Realism Combined):** Must be deployed together to prevent avatar paralysis while ensuring massive latency reduction.

---

## 5. Commit Strategy

- **Small Logical Commits:** Phase 1 and Phase 2 are separate commits. Phase 2 must contain both the backend removal and frontend replacement to guarantee zero temporary regression.
- **API Contracts:** Do not alter the `TranscriptMessage`, `make_visemes_ready`, or `make_tts_ready` structural schemas. The `visemes` array will simply be empty.

---

## 6. Test Strategy

- **Unit Tests:** Verify `VoiceModeButton` calls `clearError` and `stopListening` for cleanup before attempting a restart.
- **Integration Tests:** Verify WebSocket reconnect logic handles rapidly changing connection states. Test overlapping TTS requests to ensure `flushQueue` correctly closes the previous `AnalyserNode`.
- **UI/State Tests:** Simulate long conversations and browser tab backgrounding (visibility API) to ensure `requestAnimationFrame` pauses gracefully and resumes without queued viseme flooding.
- **Performance Checks:** Track *Time to First Audible Sound (TTFAS)* by measuring the delta between `client.speech_stopped` emission and the first `AnalyserNode` energy spike. Ensure it is noticeably shorter than before.

---

## 7. Definition of Done

- When an ASR or TTS timeout occurs, the microphone button turns red but remains clickable to clear the error. Repeated retry cycles cause zero memory leaks or orphaned WebSocket connections.
- The `viseme_generator.py` module is no longer invoked on the backend, completely eliminating synchronous Event Loop blocking overhead.
- The `make_visemes_ready` API contract is preserved but transmits an empty payload to reduce network overhead.
- The avatar's mouth moves synchronously with the audio using Web Audio `AnalyserNode` frequency data, filtered through an Exponential Moving Average to prevent jitter, displaying varied visemes (`O`, `aa`, `E`).
- Time to First Audible Sound (TTFAS) is measurably reduced.
