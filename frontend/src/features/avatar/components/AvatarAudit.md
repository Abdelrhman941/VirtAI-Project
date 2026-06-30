# 3D AVATAR RED TEAM AUDIT: EXECUTIVE VERDICT

- **Overall Risk Level:** HIGH (Due to hidden rendering and timing race conditions)
- **Safe to Continue Development?** NO — Blockers must be remediated immediately.
- **Top 3 Blockers:**
  1. **Skeleton Root Contract Mismatch:** Binding `AnimationMixer` to the Armature bone rather than the Scene root destroys all root motion and scale tracking.
  2. **Real-Time Lip Sync Continuity Failure:** `useAvatarLipSync` contains a lethal race condition where streaming consecutive audio segments will permanently freeze the mouth in fallback mode due to un-reset time tracking.
  3. **Audio Timing `NaN` Poisoning:** An unhandled optional reference (`undefined !== null`) guarantees silent math failures (`NaN`) when audio timing starts.
- **Primary Problem Area:** Runtime Integration & State Synchronization across the `useFrame` boundary.

---

# P0 FINDINGS

### 1. Skeleton Root Target Mismatch
- **Severity:** P0 - BLOCKER
- **Layer:** Avatar / Scene Layer
- **Location:** `AvatarComponent.tsx` (Lines 42-47)
- **Evidence:** `const avatarRoot = useMemo(() => nodes.Armature || clone, ...); useAvatarAnimations(avatarRoot as THREE.Group, ...);`
- **Root Cause:** By passing `nodes.Armature` to `useAnimations`, the Three.js `AnimationMixer` treats the `Armature` bone itself as the root of its search hierarchy. The mixer resolves track names (e.g., `Armature.position`) by searching for *children* of the root. It will fail to find `Armature` inside `Armature`, completely breaking root motion.
- **Impact:** The avatar will animate its limbs, but root positioning, scale adjustments, and global spatial tracking embedded in the FBX will be silently dropped. The avatar may float, sink, or detach from its origin.
- **Failure Scenario:** Any FBX animation containing root motion on the `Armature` bone fails to apply that motion.
- **Concrete Fix:** Pass the cloned scene root to the mixer, not the inner Armature node: `const avatarRoot = clone;`
- **Verification Method:** Console log `mixer.getRoot()` and verify it is the `Scene`/`Group`, and ensure `Armature.position` tracks resolve correctly.
- **Owner:** frontend / avatar
- **[Skill Invoked]:** `threejs-animation`, `react-three-fiber`
- **[Educational Note]:** In Three.js, the `AnimationMixer` resolves track bindings relative to the root object. If a track targets a bone that is the root itself, passing the bone as the root breaks the path resolution. Always pass the highest-level grouping `Scene` or `Object3D` that encapsulates the Armature.

### 2. Audio Timing `NaN` Poisoning
- **Severity:** P0 - BLOCKER
- **Layer:** Audio / Lip Sync Layer
- **Location:** `useAvatarLipSync.ts` (Line 140)
- **Evidence:** `if (audioContext && audioContext.state === 'running' && playbackStartTimeRef?.current !== null)`
- **Root Cause:** `playbackStartTimeRef` is a `React.MutableRefObject<number | null>`, making it optionally `undefined`. `undefined !== null` evaluates to `true`. This allows the engine to calculate `audioContext.currentTime - undefined`, yielding `NaN`.
- **Impact:** `currentTime` becomes `NaN`, causing all numeric array comparisons to fail. The lip-sync system entirely stops evaluating cues, resulting in a dead, closed mouth.
- **Failure Scenario:** The parent component omits `playbackStartTimeRef` or it has not been initialized yet, but `audioContext` is running.
- **Concrete Fix:** Use loose equality or explicit checks: `if (audioContext && audioContext.state === 'running' && playbackStartTimeRef?.current != null)`
- **Verification Method:** Pass `undefined` to the ref and verify the lip-sync gracefully falls back to `fallbackTimeRef` instead of breaking.
- **Owner:** frontend / avatar
- **[Skill Invoked]:** `superpowers:systematic-debugging`
- **[Educational Note]:** JavaScript's loose typing around `null` and `undefined` in numeric math operations causes silent `NaN` poisoning. Defensive programming requires strict validation before using optional React refs in real-time math.

---

# P1 FINDINGS

### 1. Real-Time Lip Sync Continuity Failure
- **Severity:** P1 - HIGH
- **Layer:** Audio / Lip Sync Layer
- **Location:** `useAvatarLipSync.ts` (Lines 62-67, 140-146)
- **Evidence:** `fallbackTimeRef` and `currentCueIndexRef` are strictly reset inside a `useEffect` that solely depends on `[pipelineState]`.
- **Root Cause:** If the application streams consecutive audio chunks or sentences while maintaining the `pipelineState === 'speaking'`, the `useEffect` never triggers. If `audioContext` is unavailable (fallback mode), `fallbackTimeRef` continuously increments indefinitely. When the next array of `mouthCues` arrives, the un-reset `fallbackTimeRef` (e.g., 5.4 seconds) will instantly overshoot the new cues (which start at 0.0).
- **Impact:** The avatar's mouth will animate perfectly for the first sentence, and stay completely frozen for the rest of the conversation in fallback mode.
- **Failure Scenario:** Streaming LLM speech where the avatar stays in the `'speaking'` state across multiple chained audio files.
- **Concrete Fix:** Track the `mouthCuesRef.current` object reference directly or reset the pointer when a new start time/array is provided inside `useFrame`.
- **Verification Method:** Simulate two back-to-back sentences without toggling `pipelineState` to `idle` and confirm the mouth animates for the second sentence in fallback mode.
- **Owner:** frontend / avatar
- **[Skill Invoked]:** `react-three-fiber`, `superpowers:systematic-debugging`
- **[Educational Note]:** Relying on React lifecycle hooks (`useEffect`) to reset real-time state (`useFrame`) creates dangerous race conditions when state machines remain constant while underlying data streams change.

---

# P2 FINDINGS

### 1. Idle Animation Reset Pops
- **Severity:** P2 - MEDIUM
- **Layer:** Animation Layer
- **Location:** `useAvatarAnimations.ts` (Line 113)
- **Evidence:** `nextAction.reset().fadeIn(fadeTime).play();`
- **Root Cause:** When transitioning back to the `Idle` animation, calling `.reset()` forces the animation track back to frame 0. Because `Idle` is a `LoopRepeat` animation, it is conceptually always running. Resetting it causes a harsh, visible jump in the avatar's breathing/swaying rhythm every time a talk animation ends.
- **Impact:** Robotic, stuttering transitions whenever the avatar stops talking.
- **Concrete Fix:** Check if the action is already running. If it's a looping background action, just fade it in without resetting its time.
- **Owner:** frontend / avatar
- **[Skill Invoked]:** `threejs-animation`
- **[Educational Note]:** Ambient looping animations should maintain continuous temporal advancement. Transitions should modulate their *weight* (via crossfading), not their *time*.

### 2. Missing Jaw Kinematics
- **Severity:** P2 - MEDIUM
- **Layer:** Lip-Sync / Facial Layer
- **Location:** `useAvatarLipSync.ts` (Line 92)
- **Evidence:** Explicit extraction of `eyeBlink`, `browInnerUp`, `mouthSmile`, etc., but total omission of `jawOpen`.
- **Root Cause:** Relying purely on viseme morph targets (like `viseme_aa`) often only deforms the lips. High-quality rigs require explicit application of `jawOpen` alongside wide visemes to drop the physical jaw bone/mesh and separate the teeth.
- **Impact:** The avatar may exhibit a "mumbling" effect where the lips move but the jaw remains clenched, revealing inner teeth mesh collision.
- **Concrete Fix:** Extract the `jawOpen` morph target and apply a localized weight (e.g., `0.4`) when wide visemes (`viseme_aa`, `viseme_O`) are active.
- **Owner:** frontend / avatar
- **[Skill Invoked]:** `impeccable`

---

# P3 / P4 FINDINGS

### 1. Crossfade Normalization vs. Fade In/Out
- **Severity:** P3 - LOW
- **Location:** `useAvatarAnimations.ts` (Lines 109-117)
- **Root Cause:** Manually commanding simultaneous `fadeOut` and `fadeIn` can lead to brief frames where the combined weight of actions is not exactly `1.0`.
- **Concrete Fix:** Prefer `nextAction.crossFadeFrom(prevAction, fadeTime, true);` when transitioning between explicit states.

---

# SKELETON / RIG REVIEW
- **Exact hierarchy check:** Ground truth matches.
- **Naming normalization review:** The defensive regex (`/mixamorig:|Armature\|/gi`) is perfectly implemented and correctly mirrors the GLB contract without breaking clean tracks.
- **Retargeting safety review:** Safe.

# ANIMATION REVIEW
- **Mixer lifecycle:** Handled well, cleans up on unmount.
- **Idle/Talk transitions:** The state machine properly intercepts movement locks and waits for idle breaks. Solid architecture.
- **Track binding:** **BROKEN** due to `avatarRoot` pointing to the Armature bone instead of the cloned scene root.

# LIP-SYNC / FACIAL REVIEW
- **Viseme mapping:** The 15 visemes are mapped accurately according to standard ARKit/Oculus conventions.
- **Mouth openness / Jaw movement:** **WEAK**. Jaw bone separation is missing.
- **Timing alignment:** **BROKEN** under real-time streaming constraints due to decoupled React/ThreeJS lifecycle resets.

# R3F / THREE.JS PERFORMANCE REVIEW
- **Render loop:** Stable.
- **Cleanup:** `SkeletonUtils.clone` is correctly implemented alongside `useGraph`. The cloned nodes are garbage collected upon unmount.
- **Memory leak risk:** Low. The implementation properly prevents material and geometry duplication.

# FINAL DECISION
**BLOCK**
The codebase is structurally clean and demonstrates excellent separation of concerns. However, the root motion tracking and continuous audio timing defects are silent killers that will catastrophically fail in a production real-time LLM streaming environment. Remediate the P0 and P1 issues before allowing this to pass the release gate.
