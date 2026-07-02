# VirtAI Frontend Refactor — TODO

**Last updated by:** Antigravity / 2026-07-02
**Current batch:** 0-E (build investigation)
**Overall progress:** Batch 0 done, build environment being stabilised
**Branch:** refactor/styling-foundation

---

## Batch 0 — Pre-flight (environment gates)
- [x] 0.1 git checkout -b refactor/styling-foundation
- [x] 0.2 Create REFACTOR_TODO.md at project root
- [x] 0.3 Verify react >= 19, framer-motion >= 11, tailwindcss >= 3.4
- [x] 0.4 Install dev tooling
- [x] 0.5 Capture the before bundle baseline
- [x] 0.6 Commit

## Baselines (pre-refactor)
- CSS bundle size (dist/assets/*.css): 221.36 KB total
- JS bundle size (dist/assets/*.js) — total gzipped: ~1.71 MB
- visualizer HTML output path: dist/stats.html

## Batch 0-E — Build Environment Investigation (BLOCKING)

### Context
`pnpm build` failed with 8 `MISSING_EXPORT` errors after upgrading to Vite 8 (Rolldown bundler).
Two independent root causes were identified and fixed. See `WALKTHROUGH.md` for full forensics.

### Root Cause 1 — @react-three/fiber v8 + Zustand v5 + Rolldown strict ESM
- **Package:** `@react-three/fiber@8.18.0`
- **Bug:** R3F v8 ships a pre-bundled ESM that does `import create from 'zustand'` (CJS-compat
  default import, zustand v3 API). Rolldown (Vite 8) is a strict ESM bundler and hard-errors when
  the default export doesn't exist in the resolved module (zustand v5 removed the default export).
- **Compounding factor:** R3F v8 also declares `peerDependencies: react >= 18 < 19` — not
  compatible with React 19 at all.
- **Fix:** Upgrade to `@react-three/fiber@^9.6.1` + `@react-three/drei@^10.7.7`
  (R3F v9 supports React 19, adopts zustand v5 named exports).
- [x] 0-E.1 Identified root cause (R3F v8 / zustand v5 / Rolldown strict ESM)
- [x] 0-E.2 `pnpm add @react-three/fiber@^9.6.1 @react-three/drei@^10.7.7`

### Root Cause 2 — @mermaid-js/parser version mismatch on disk
- **Package:** `@mermaid-js/parser`
- **Bug:** `mermaid@11.16.0` requires `@mermaid-js/parser@^1.2.0` but v1.1.1 was installed on
  disk. Functions `createRailroadServices`, `createRailroadAbnfServices`, `createRailroadPegServices`,
  and `createRailroadEbnfServices` were added in v1.2.0 and are missing in v1.1.1.
  Root cause: pnpm store cache stale entry from prior `npm install` run that displaced into `.ignored/`.
- **Fix:** `pnpm add @mermaid-js/parser@1.2.0` (pin exact version to force resolution).
- [x] 0-E.3 Identified root cause (parser v1.1.1 on disk vs v1.2.0 required)
- [x] 0-E.4 `pnpm add @mermaid-js/parser@1.2.0` (force resolution)

### Root Cause 3 — framer-motion vs motion version conflict
- **Package:** `framer-motion`, `motion-dom`
- **Bug:** `framer-motion@11.18.2` and `motion@12.40.0` were installed concurrently, causing Vite to
  resolve mismatched `motion-dom` versions (v12 for v11), leading to `MISSING_EXPORT` errors.
- **Fix:** Upgrade to `framer-motion@^12.0.0` to match `motion`.
- [x] 0-E.5 `pnpm add framer-motion@^12.0.0`

### Root Cause 4 — TypeScript 5.9 strictness
- **Bug:** `tsc --noEmit` failed with 9 errors, mostly related to `ArrayBufferLike` strictness in TS 5.9 and missing React props.
- **Fix:** Fixed 6 files to cast `Uint8Array/Float32Array` correctly, pass correct arguments to `toast.error`, and add missing `useNavigate` hook.
- [x] 0-E.6 Fixed all TS errors.

### Gates (must all pass before Batch 1)
- [x] 0-E.7 `pnpm build` exits 0 (verified!)
- [x] 0-E.8 `pnpm tsc --noEmit` exits 0 — verified!
- [x] 0-E.9 `pnpm lint` exits 0 — verified!
- [x] 0-E.10 Commit fix + update WALKTHROUGH.md

## Batch 1 — Audit, cn Fix, Globals + Design Tokens
- [x] 1.1 Read and archive files locally
- [x] 1.2 Extract table of root CSS variables
- [x] 1.3 Extract table of kebab-case classes
- [x] 1.4 Consolidate to globals.css
- [x] 1.5 Fix cn.ts
- [x] 1.6 Update main.tsx + remove from App.tsx
- [x] 1.7 Delete index.css + app.css
- [x] 1.8 Rebuild tailwind.config.ts (N/A — Tailwind v4 uses globals.css @theme)
- [x] 1.9 Prove token map scratch check
- [x] 1.10 pnpm tsc --noEmit && pnpm build baseline
- [x] 1.11 Commit

## Batch 2 — Bootstrap shadcn/ui
- [ ] 2.1 Install deps
- [ ] 2.2 Create components.json
- [ ] 2.3 Add primitives via CLI
- [ ] 2.4 Verify utilities
- [ ] 2.5 pnpm tsc --noEmit && pnpm build
- [ ] 2.6 Commit

## Batch 3 — Migrate SlideDrawer → shadcn <Sheet> / <Drawer>
- [ ] 3.1 grep SlideDrawer consumers
- [ ] 3.2 Decide Sheet vs Drawer vs resizable Sheet per consumer
- [ ] 3.3 Preserve focus-trap, ESC-to-close, scroll-lock
- [ ] 3.4 Delete SlideDrawer.tsx + .css
- [ ] 3.5 Commit

## Batch 4 — Action Buttons → shadcn <Button> variants (CVA)
- [ ] 4.1 Extend buttonVariants in button.tsx
- [ ] 4.2 Rewrite action buttons
- [ ] 4.3 Delete .css files
- [ ] 4.4 pnpm tsc --noEmit && pnpm build
- [ ] 4.5 Commit

## Batch 5 — Rebuild the Markdown Renderer as a Design System
- [ ] 5.1 scaffold shared/markdown design system (types, plugins, sanitize schema)
- [ ] 5.2 renderer + streaming split + Shiki lazy code block
- [ ] 5.3 migrate consumers + delete legacy renderers

## Batch 6 — Message Scroller (chat transcript)
- [ ] 6.1 wire MessageScrollerProvider + swap transcript viewport
- [ ] 6.2 animate MessageScrollerItem with framer-motion + right-rail outline
- [ ] 6.3 remove legacy scroll refs + onScrollToBottom prop chain

## Batch 7 — Shimmer for "Thinking…" states
- [ ] 7.1 replace typing dots with shimmer Marker across all "thinking" states

## Batch 8 — Scroll-fade on session / documents / history lists
- [ ] 8.1 apply scroll-fade-24 to all long lists + MessageScroller viewport

## Batch 9 — Context Menu (rename / delete) + Alert Dialog (delete confirm)
- [ ] 9.1 shadcn ContextMenu + AlertDialog for rename/delete + clear-all flows

## Batch 10 — Carousel for Help page (with Autoplay plugin)
- [ ] 10.1 rebuild Help page with shadcn Carousel + Autoplay plugin

## Batch 11 — Alert (custom-colored variants) + Sonner standardization + notify wrapper
- [ ] 11.1 custom-colored Alert set + canonical Sonner Toaster + notify wrapper

## Batch 12 — Convert Remaining Feature CSS & CSS Modules → Tailwind
- [ ] 12.1 SlideQuestionInput.css
- [ ] 12.2 SessionHoverPreview.css
- [ ] 12.3 NotFound.css
- [ ] 12.4 UploadTab.css
- [ ] 12.5 DocumentsPanel.css
- [ ] 12.6 Setup.css
- [ ] 12.7 Quiz.module.css
- [ ] 12.8 Classroom.css
- [ ] 12.9 ExplainSession.css

## Batch 13 — Kill Legacy Chat Primitives + Inline Styles
- [ ] 13.1 rebuild ChatPrimitives with shadcn Avatar + CVA + shimmer thinking state
- [ ] 13.2 remove static inline styles across files

## Batch 14 — Rebuild PageLoader + VoiceIndicator + Splash with Motion
- [ ] 14.1 rebuild PageLoader + VoiceIndicator with Framer Motion

## Batch 15 — Virtualization for large lists
- [ ] 15.1 virtualize SessionList + long transcripts with @tanstack/react-virtual

## Batch 16 — Verification, Bundle Analysis, Cleanup
- [ ] 16.1 Grep sweeps
- [ ] 16.2 pnpm tsc --noEmit && pnpm lint && pnpm build
- [ ] 16.3 Bundle diff (measured, not vibes)
- [ ] 16.4 Manual smoke test on every route
- [ ] 16.5 Update TODO & PR

## Open Questions
> 

## Extras Found
> 

## API Deltas
> 

## Handoff Log
> Completed Batch 0. Baseline captured from previous build log (CSS: 221.36 KB, JS: 1.71 MB). Note: `pnpm build` failed on missing ESM exports (`zustand`, `mermaid`) when using Vite 8 Rolldown with the upgraded dependencies. The next agent should proceed to Batch 1 to consolidate globals and tokens.
