# 🎯 VirtAI Frontend Refactor — Master Agent Prompt (v3 — FINAL)

> **READ THIS FILE END-TO-END BEFORE WRITING A SINGLE LINE OF CODE.**
> Then start with **Batch 0** and never skip ahead.
> This is v3 — supersedes v1 and v2. Do NOT read older versions.

---

## 🧠 ROLE & MINDSET

You are a **Senior Frontend Engineer + Product Designer** with 10+ years of experience in:
- React 19 + TypeScript strict mode
- Tailwind CSS 3.4+ + `@tailwindcss/typography`
- shadcn/ui (Radix UI primitives) + `class-variance-authority`
- Design systems (Vercel Geist, Linear, ChatGPT UI, assistant-ui)
- Streaming chat UIs + WCAG AA accessibility
- Migrating legacy CSS/SCSS to utility-first architectures

**Non-negotiable behavior (Rules of Engagement):**

1. **NO HALLUCINATION.** If a file is missing, say `> BLOCKED: file not found: <path>` in the TODO and ask. Never invent content, imports, or APIs.
2. **NO LAZINESS.** If a batch says "convert all .css files", do not leave a single file behind. Large files are split into sub-commits — but never skipped.
3. **NO CHEAP SHORTCUTS.** A 200-character `className="…"` is a code smell. Use CVA variants, `cn()` composition, or extract to a wrapper component. Long class strings must be broken into arrays joined with spaces or extracted into `@apply` inside a component-scoped CSS layer — never a naked mile-long string.
4. **NO EMPTY COMMENTS.** `// this is a component` is banned. Comments explain the **why**, not the what.
5. **NO COMMENTED-OUT CODE.** Delete it. Git remembers.
6. **NO SPECULATIVE FIXES.** If the current API from `pnpm dlx shadcn@latest add <name>` differs from what this prompt shows, follow what the CLI actually shipped. Log the delta under `## API Deltas` in the TODO.
7. **REFERENCE-QUALITY OUTPUT** — the final result should feel like [`vercel/ai-chatbot`](https://github.com/vercel/ai-chatbot), [`shadcn-ui/ui`](https://github.com/shadcn-ui/ui), and [`assistant-ui/assistant-ui`](https://github.com/assistant-ui/assistant-ui) had a baby with Linear.
8. **RTL AWARENESS.** The app supports Arabic. Any component with directional icons/animations must be RTL-safe. Use logical props (`start`/`end`, `s`/`e` in shadcn utilities) over physical ones (`left`/`right`, `l`/`r`) whenever possible.
9. **TICK THE TODO IN THE SAME COMMIT THAT COMPLETES THE TASK.** Not before. Not later.

**Handoff protocol** (context-limit safety):
- If you feel the context window getting tight, immediately:
  1. Commit and push all in-flight work.
  2. Tick the TODO up to the last **fully verified** sub-task only.
  3. Append a `## Handoff Log` entry: current file, exact line, what remains, next batch.
  4. End the reply with `> HANDOFF: next agent resumes at Batch X.Y. Branch: refactor/styling-foundation.`

---

## 📋 PROJECT CONTEXT

**Project:** VirtAI — Real-time AI Avatar platform for interactive learning.

**Frontend stack (target):**
- React 19 + TypeScript strict
- Vite
- Tailwind CSS 3.4+ (v4 acceptable if already installed) + `shadcn` utility package (adds `shimmer`, `scroll-fade`, `no-scrollbar`)
- `@tailwindcss/typography`
- shadcn/ui (Radix primitives + Embla for carousel + vaul for drawer)
- Zustand + TanStack Query + React Router
- react-hook-form + Zod
- `react-markdown` + remark/rehype ecosystem (rebuilt as a design system in Batch 5)
- Framer Motion (**version ≥ 11 required** — see Batch 0 pre-flight)
- Sonner (already used → standardized in Batch 11)
- lucide-react (consolidate `react-icons` usage opportunistically)

**Feature-based folder structure** (already in place — do not restructure):
```
src/
├── app/          bootstrap, layouts, providers, router, styles
├── core/         api client, realtime (WebSocket)
├── features/     auth, avatar, chat, classroom, diagrams, documents,
│                 explain, overview, quiz, session, setup, summary, voice
├── shared/       components, hooks, utils, (NEW) markdown/
├── widgets/      Classroom, Overview
├── services/     wsManager, uploadService
├── pages/        route-level pages
└── workers/      web workers
```

---

## 🚨 CORE PROBLEM (verified against the actual codebase)

The project has **20 external `.css` imports** + hundreds of kebab-case classes + 22 files with inline `style={{}}` + no real shadcn/ui adoption. We convert everything to **Tailwind + shadcn/ui + Framer Motion** without touching business logic.

**CSS files that must be handled:**

| File | Action |
|---|---|
| `app/styles/index.css` | Merge into `globals.css` |
| `app/styles/app.css` | Merge into `globals.css` |
| `shared/components/SlideDrawer.css` | **Delete** → shadcn `<Sheet>` / `<Drawer>` |
| `features/chat/components/StreamingMessageRenderer.css` | **Delete** → new `StreamingMarkdownRenderer` (Batch 5) |
| `features/chat/components/VisualizeButton.css` | **Delete** → shadcn `<Button>` variants |
| `features/diagrams/components/DiagramButton.css` | **Delete** → shadcn `<Button>` variants |
| `features/documents/components/DocumentsPanel.css` | **Delete** → Tailwind + shadcn |
| `features/documents/components/UploadTab.css` | **Delete** → Tailwind + shadcn |
| `features/explain/components/ExplainButton.css` | **Delete** → shadcn `<Button>` variants |
| `features/explain/components/ExplainSession.css` | **Trim to ≤30 lines** — Markdown overrides for slide-mode only |
| `features/explain/components/SlideQuestionInput.css` | **Delete** → Tailwind |
| `features/session/components/SessionHoverPreview.css` | **Delete** → Tailwind + Framer Motion |
| `features/voice/components/VoiceModeButton.css` | **Delete** → shadcn `<Button>` variants |
| `features/setup/components/Setup.css` | **Delete** → Tailwind |
| `pages/NotFound/NotFound.css` | **Delete** → Tailwind |
| `pages/Help/Help.module.css` | **Delete** → Tailwind + shadcn `<Carousel>` |
| `pages/Quiz/Quiz.module.css` | **Delete** → Tailwind |
| `widgets/Classroom/Classroom.css` | **Delete** → Tailwind (largest — 3 sub-commits) |
| `katex/dist/katex.min.css` | **Keep** (third-party) |

**End state:** `globals.css` + `shared/markdown/theme.css` + trimmed `ExplainSession.css` + `katex.min.css`. Everything else is deleted.

---

## ✅ REQUIRED TODO FILE — SINGLE SOURCE OF TRUTH

**First thing you do:** create `REFACTOR_TODO.md` at the **project root** (NOT inside `frontend/`).

Template:
```md
# VirtAI Frontend Refactor — TODO

**Last updated by:** <agent name / date>
**Current batch:** <#>
**Overall progress:** X/N tasks done
**Branch:** refactor/styling-foundation

---

## Batch 0 — Pre-flight (environment gates)
- [ ] 0.1 …

## Batch 1 — Audit, cn Fix, Globals + Design Tokens
- [ ] 1.1 …

… (all 16 batches expanded, see below)

## Open Questions
> (agent adds here when unsure — never guess)

## Extras Found
> (agent logs findings outside the plan)

## API Deltas
> (log any shadcn CLI output that differs from this prompt)

## Handoff Log
> (agent writes here when hitting context limits)
```

**Rules for the TODO:**
- After completing each sub-task, tick ✅ **in the same commit** that finishes it.
- If a step is blocked, write `> BLOCKED: <reason>` under it. Never skip silently.
- Before touching Batch N+1, verify Batch N is 100% ✅ and quality gates pass.

---

## 🗂️ BATCHES

### 🔹 Batch 0 — Pre-flight (environment gates) **NEW**

**Goal:** guarantee the environment is ready before any code moves.

1. `git checkout -b refactor/styling-foundation`.
2. Create `REFACTOR_TODO.md` at project root (template above). Commit: `chore: add refactor TODO`.
3. Read `frontend/package.json`. Verify:
   - `react` ≥ 19
   - `framer-motion` ≥ 11 (needed for `motion.create(...)` in Batch 6). If `< 11`, run `pnpm add framer-motion@^11.0.0` and pin it. Log the change under `## API Deltas`.
   - `tailwindcss` ≥ 3.4 (v4 also acceptable). If < 3.4, upgrade.
4. Install dev tooling that enforces the "no giant className" rule mechanically (not just verbally):
   ```bash
   pnpm add -D eslint-plugin-tailwindcss prettier-plugin-tailwindcss rollup-plugin-visualizer
   ```
   - Wire `eslint-plugin-tailwindcss` into the ESLint config with `classnames-order` + `no-contradicting-classname` + a hard `no-custom-classname` for kebab-case leftovers (allow-list `shimmer`, `scroll-fade*`, `no-scrollbar`, `prose*`, KaTeX, and anything you export from CVA).
   - Wire `prettier-plugin-tailwindcss` at the end of the plugin list in `.prettierrc` so class order is auto-sorted on save.
5. Capture the **before** bundle baseline:
   ```bash
   pnpm build
   # Save the following to REFACTOR_TODO.md under "Baselines":
   #  - CSS bundle size (dist/assets/*.css)
   #  - JS bundle size (dist/assets/*.js) — total gzipped
   #  - visualizer HTML output path
   ```
   Add `rollup-plugin-visualizer` to `vite.config.ts` under `plugins`, output to `dist/stats.html`. Do NOT overwrite existing plugin config.
6. Commit: `chore(env): pre-flight — pin deps, add ESLint/Prettier Tailwind plugins, capture baseline`.

Tick 0.1 → 0.6 in TODO.

**Quality gate to leave Batch 0:** `pnpm tsc --noEmit && pnpm build` clean, baseline sizes written to TODO.

---

### 🔹 Batch 1 — Audit, `cn` Fix, Globals Consolidation + Design Tokens

**Goal:** unified styling foundation with an **explicit design-token map** so shadcn variants render on-brand.

1. Read verbatim (do not edit yet) and archive locally in `REFACTOR_TODO.md` under `## Extras Found`:
   - `frontend/tailwind.config.ts` (create if missing)
   - `frontend/postcss.config.js`
   - `frontend/src/app/styles/index.css`
   - `frontend/src/app/styles/app.css`
   - `frontend/src/shared/utils/cn.ts`
2. **Extract table** of every `:root` CSS variable + its value from the two globals.
3. **Extract table** of every custom kebab-case class defined in the two globals + their CSS.
4. **Consolidate** to `frontend/src/app/styles/globals.css`:
   ```css
   /* 1. Tailwind + shadcn utility package */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   /* If Tailwind v4 is used: @import "tailwindcss"; @import "shadcn/tailwind.css"; */

   /* 2. Design tokens — HSL space so shadcn variants match the VirtAI brand.
         Values are canonical; adjust in one place only.               */
   @layer base {
     :root {
       --background: 0 0% 6%;                  /* #0F0F0F */
       --foreground: 40 10% 92%;               /* off-white body */
       --card: 0 0% 8%;
       --card-foreground: 40 10% 92%;
       --popover: 0 0% 6%;
       --popover-foreground: 40 10% 92%;
       --primary: 42 30% 65%;                  /* gold #D4B47A */
       --primary-foreground: 0 0% 6%;
       --secondary: 0 0% 14%;
       --secondary-foreground: 40 10% 92%;
       --muted: 0 0% 14%;
       --muted-foreground: 0 0% 63%;
       --accent: 42 30% 65%;
       --accent-foreground: 0 0% 6%;
       --destructive: 349 100% 21%;            /* crimson #6D001A */
       --destructive-foreground: 0 0% 98%;
       --border: 0 0% 100%;                    /* used with /10 opacity */
       --input: 0 0% 100%;
       --ring: 42 30% 65%;
       --radius: 0.5rem;
       --vv-height: 100vh;                     /* preserved for useVisualViewport */

       /* Brand extensions used by CVA in Batch 4 & 11 */
       --gold-soft: 40 20% 62%;
       --gold-deep: 33 21% 43%;
       --crimson-glow: 350 71% 44%;
     }
   }

   @layer base {
     * { @apply border-border/10; }
     body {
       @apply bg-background text-foreground antialiased font-sans;
       font-feature-settings: "rlig" 1, "calt" 1;
     }
     [dir="rtl"] { font-family: 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif; }
   }

   @layer utilities {
     .no-scrollbar::-webkit-scrollbar { display: none; }
     .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
   }
   ```
5. **Fix `cn.ts`:**
   ```ts
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs));
   }
   ```
6. Update `main.tsx` → `import './styles/globals.css';`. Remove `import './styles/app.css';` from `App.tsx`.
7. Delete `index.css` + `app.css` after verifying every token migrated (grep the values you extracted in step 2 — they must all appear in `globals.css`).
8. Rebuild `tailwind.config.ts`:
   ```ts
   import type { Config } from 'tailwindcss';

   export default {
     darkMode: 'class',
     content: ['./index.html', './src/**/*.{ts,tsx}'],
     theme: {
       container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
       extend: {
         colors: {
           border: 'hsl(var(--border) / <alpha-value>)',
           input:  'hsl(var(--input)  / <alpha-value>)',
           ring:   'hsl(var(--ring))',
           background: 'hsl(var(--background))',
           foreground: 'hsl(var(--foreground))',
           primary:     { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },
           secondary:   { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
           muted:       { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
           accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
           destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
           card:        { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },
           popover:     { DEFAULT: 'hsl(var(--popover))',     foreground: 'hsl(var(--popover-foreground))' },
           /* VirtAI brand palette (kept for backwards compat + CVA variants) */
           gold:    { DEFAULT: '#D4B47A', soft: 'hsl(var(--gold-soft))', deep: 'hsl(var(--gold-deep))' },
           crimson: { DEFAULT: '#6D001A', soft: '#8B1E3F',                glow: 'hsl(var(--crimson-glow))' },
           offwhite: '#F5F1EC',
         },
         borderRadius: {
           lg: 'var(--radius)',
           md: 'calc(var(--radius) - 2px)',
           sm: 'calc(var(--radius) - 4px)',
         },
         fontFamily: {
           sans:    ['Inter', 'system-ui', 'sans-serif'],
           display: ['Cal Sans', 'Inter', 'sans-serif'],
           mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
           arabic:  ['IBM Plex Sans Arabic', 'sans-serif'],
         },
         keyframes: {
           'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
           'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
           'pulse-ring':     { '0%,100%': { transform: 'scale(1)', opacity: '0.6' }, '50%': { transform: 'scale(1.4)', opacity: '0' } },
         },
         animation: {
           'accordion-down': 'accordion-down 0.2s ease-out',
           'accordion-up':   'accordion-up 0.2s ease-out',
           'pulse-ring':     'pulse-ring 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
         },
       },
     },
     plugins: [
       require('@tailwindcss/typography'),
       require('tailwindcss-animate'),
     ],
   } satisfies Config;
   ```
9. Prove the token map with a scratch check inside `AppShell.tsx` (do NOT commit this scratch — remove before commit):
   ```tsx
   <Button variant="destructive">Test crimson</Button>
   <Button className="bg-primary text-primary-foreground">Test gold</Button>
   ```
   Both should be on-brand. If not, adjust HSL values in `globals.css` — never in the config.
10. `pnpm tsc --noEmit && pnpm build`. Baseline vs. current: CSS bundle should already shrink from removing `index.css` + `app.css`.
11. Commit: `chore(styles): consolidate globals + design tokens + fix cn types + rebuild tailwind config`.

Tick 1.1 → 1.11 in TODO.

---

### 🔹 Batch 2 — Bootstrap shadcn/ui

**Goal:** shadcn/ui installed with every primitive we need. No half-installed component in Batch ≥3.

1. Install deps:
   ```bash
   pnpm add class-variance-authority tailwindcss-animate \
     @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
     @radix-ui/react-tooltip @radix-ui/react-tabs \
     @radix-ui/react-scroll-area @radix-ui/react-separator \
     @radix-ui/react-label @radix-ui/react-slot \
     @radix-ui/react-avatar @radix-ui/react-alert-dialog \
     @radix-ui/react-context-menu \
     vaul embla-carousel-react embla-carousel-autoplay
   pnpm add shadcn        # provides shimmer, scroll-fade, no-scrollbar utilities
   ```
2. Create `frontend/components.json`:
   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "new-york",
     "rsc": false,
     "tsx": true,
     "tailwind": {
       "config": "tailwind.config.ts",
       "css": "src/app/styles/globals.css",
       "baseColor": "neutral",
       "cssVariables": true
     },
     "aliases": {
       "components": "@/components",
       "utils": "@/shared/utils/cn",
       "ui": "@/components/ui",
       "lib": "@/shared/utils",
       "hooks": "@/shared/hooks"
     }
   }
   ```
3. Add primitives via CLI (fall back to manual copy from ui.shadcn.com if CLI errors — log to `## API Deltas`):
   ```bash
   pnpm dlx shadcn@latest add button dialog drawer sheet input label textarea \
     card badge tooltip skeleton separator scroll-area \
     dropdown-menu tabs avatar alert-dialog sonner \
     context-menu alert carousel spinner marker \
     message-scroller
   ```
   > `spinner`, `marker`, and `message-scroller` may live in `shadcn@canary`. If the CLI reports "not found":
   > - Copy them manually from https://ui.shadcn.com/docs/components/marker, https://ui.shadcn.com/docs/utils/shimmer, https://ui.shadcn.com/docs/components/radix/message-scroller.
   > - Log the actual API signatures under `## API Deltas`.
4. Verify utilities in a throwaway file (delete before commit):
   ```tsx
   <p className="shimmer text-muted-foreground">Test</p>
   <div className="scroll-fade scroll-fade-24 overflow-y-auto h-40">…</div>
   <span className="no-scrollbar overflow-auto">…</span>
   ```
5. `pnpm tsc --noEmit && pnpm build`.
6. Commit: `feat(ui): bootstrap shadcn/ui + shimmer/scroll-fade utilities`.

---

### 🔹 Batch 3 — Migrate SlideDrawer → shadcn `<Sheet>` / `<Drawer>`

**Delete after migration:**
- `shared/components/SlideDrawer.tsx`
- `shared/components/SlideDrawer.css`

**Steps:**
1. `grep -rn "SlideDrawer" src/` → list every consumer in `REFACTOR_TODO.md`.
2. Decide per consumer:
   - Desktop side panel (Documents, Settings) → shadcn `<Sheet>`.
   - Mobile bottom-sheet → shadcn `<Drawer>` (vaul-based).
   - Resizable case (current `SettingsDrawer` uses `resizable=true`): wrap `<Sheet>` with a Framer Motion `useMotionValue` + `onPan` handle; preserve `width` + `onWidthChange` props.
3. Preserve focus-trap, ESC-to-close, scroll-lock — Radix ships them.
4. Delete `SlideDrawer.tsx` + `.css`.
5. Commit: `refactor(ui): migrate SlideDrawer to shadcn Sheet/Drawer`.

---

### 🔹 Batch 4 — Action Buttons → shadcn `<Button>` variants (CVA)

**Rewrite:**
- `features/chat/components/VisualizeButton.tsx` (+ delete `.css`)
- `features/diagrams/components/DiagramButton.tsx` (+ delete `.css`)
- `features/explain/components/ExplainButton.tsx` (+ delete `.css`)
- `features/voice/components/VoiceModeButton.tsx` (+ delete `.css`)
- `shared/components/ToolbarButton.tsx` → thin wrapper over `<Button variant="ghost" size="icon">` with fixed accessibility props (`aria-label` required prop).

**Steps:**
1. Extend `buttonVariants` in `components/ui/button.tsx`:
   ```ts
   const buttonVariants = cva('…existing…', {
     variants: {
       variant: {
         // existing: default, destructive, outline, secondary, ghost, link
         gold:  'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.25)]',
         voice: 'bg-crimson/10 text-crimson-glow border border-crimson/30 hover:bg-crimson/20',
         soft:  'bg-white/5 text-foreground hover:bg-white/10 border border-white/10',
       },
       // existing sizes stay
     },
   });
   ```
2. Rewrite each action button as a thin wrapper around `<Button variant="…">` (no `.tsx` deletion — keep the file, replace the body).
3. Delete the 4 `.css` files.
4. `pnpm tsc --noEmit && pnpm build`.
5. Commit: `refactor(ui): migrate action buttons to shadcn Button variants (CVA)`.

---

### 🔹 Batch 5 — Rebuild the Markdown Renderer as a Design System **[MOST CRITICAL]**

> The existing `MarkdownRenderer` **has no XSS sanitization, no memoization strategy, no code highlighter, no line-break handling**. Streaming long messages currently re-parses the full AST on every delta. All three issues must be fixed in this batch.

**Delete:**
- `shared/components/MarkdownRenderer.tsx` (rewrite in new location)
- `features/chat/components/StreamingMessageRenderer.tsx` + `.css`

**Create:**
```
shared/markdown/
├── MarkdownRenderer.tsx
├── StreamingMarkdownRenderer.tsx
├── components/
│   ├── CodeBlock.tsx
│   ├── InlineCode.tsx
│   ├── Table.tsx
│   ├── BlockQuote.tsx
│   ├── Link.tsx
│   ├── Heading.tsx
│   ├── ListItem.tsx
│   ├── Image.tsx
│   ├── Math.tsx
│   └── Mermaid.tsx        (only if the feature exists)
├── plugins/
│   ├── remarkPlugins.ts
│   ├── rehypePlugins.ts
│   └── sanitizeSchema.ts
├── utils/
│   ├── normalizeMarkdown.ts
│   ├── splitForStreaming.ts
│   └── streamingCursor.tsx
├── theme.ts               (prose class constants)
├── theme.css              (KaTeX overrides only — ≤60 lines)
└── index.ts               (barrel export)
```

**Install:**
```bash
pnpm add remark-gfm remark-math remark-breaks \
         rehype-katex rehype-sanitize \
         katex shiki
```

#### 5.a — Sanitization (SECURITY, non-optional)

`plugins/sanitizeSchema.ts`:
```ts
import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';

const codeAttrs = defaultSchema.attributes?.code ?? [];
const spanAttrs = defaultSchema.attributes?.span ?? [];

/**
 * Sanitize schema for RAG output.
 * - Preserves code language classes (`language-*`) for Shiki.
 * - Preserves KaTeX-generated inline styles + math roles on span nodes.
 * - Explicitly blocks iframe/object/embed/script even though rehype-sanitize
 *   defaults already do; making it explicit protects us if defaults change.
 */
export const virtaiSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) => !['iframe', 'object', 'embed', 'script'].includes(t),
  ),
  attributes: {
    ...defaultSchema.attributes,
    code: [...codeAttrs, ['className', /^language-./]],
    span: [...spanAttrs, ['className', /^katex/], 'style', 'aria-hidden'],
    // KaTeX renders MathML — allow-list its needed tags via defaults; do not extend.
  },
};
```

#### 5.b — Plugins

`plugins/remarkPlugins.ts`:
```ts
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';

export const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkBreaks];
```

`plugins/rehypePlugins.ts` (**order matters — sanitize LAST**):
```ts
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { virtaiSanitizeSchema } from './sanitizeSchema';

export const REHYPE_PLUGINS = [
  rehypeKatex,
  [rehypeSanitize, virtaiSanitizeSchema] as const,
];
```

#### 5.c — Normalizer

`utils/normalizeMarkdown.ts`:
```ts
export function normalizeMarkdown(input: string): string {
  let out = input;
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  out = out.replace(
    /^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]\s*)+)\n+(?=#+\s)/gmu,
    '$1 ',
  );
  return out;
}
```

#### 5.d — Prose theme

`theme.ts`:
```ts
export const PROSE = {
  base:    'prose prose-invert max-w-none text-foreground/90',
  chat:    'prose-sm prose-p:leading-[1.7]  prose-p:my-3 prose-headings:mt-6  prose-headings:mb-3',
  explain: 'prose-base prose-p:leading-[1.8] prose-p:my-4 prose-headings:mt-10 prose-headings:mb-4',
  summary: 'prose-sm prose-p:leading-relaxed',
} as const;

export type MarkdownVariant = keyof typeof PROSE;
```

#### 5.e — Renderer (memoized + streaming-safe)

`MarkdownRenderer.tsx`:
```tsx
import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import { REMARK_PLUGINS } from './plugins/remarkPlugins';
import { REHYPE_PLUGINS } from './plugins/rehypePlugins';
import { normalizeMarkdown } from './utils/normalizeMarkdown';
import { PROSE, type MarkdownVariant } from './theme';
import { cn } from '@/shared/utils/cn';
import { markdownComponents } from './components';

export interface MarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
}

const MarkdownRendererImpl: React.FC<MarkdownRendererProps> = ({
  content,
  variant = 'chat',
  className,
  dir = 'auto',
}) => {
  const normalized = useMemo(() => normalizeMarkdown(content), [content]);
  return (
    <div dir={dir} className={cn(PROSE.base, PROSE[variant], className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS as any}
        components={markdownComponents}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

/**
 * Memoized on `content` + `variant`. Re-renders on every streamed delta,
 * but child MDX elements are shallow-equal-stable, so React reconciles cheaply.
 * For per-delta amortization we split the string in StreamingMarkdownRenderer.
 */
export const MarkdownRenderer = memo(MarkdownRendererImpl, (a, b) =>
  a.content === b.content && a.variant === b.variant && a.className === b.className,
);
```

#### 5.f — Streaming renderer (prefix/tail split — required for perf)

`utils/splitForStreaming.ts`:
```ts
/**
 * Split the streamed string into a "frozen" prefix (everything up to and
 * including the last complete paragraph / code fence / list item) and a "hot"
 * tail (the currently-growing chunk). Only the tail re-parses every delta —
 * the prefix is memoized once and only invalidated when a new boundary is
 * crossed.
 */
export function splitForStreaming(input: string): { prefix: string; tail: string } {
  // last blank line = safest paragraph boundary
  const lastBoundary = input.lastIndexOf('\n\n');
  if (lastBoundary === -1) return { prefix: '', tail: input };
  return {
    prefix: input.slice(0, lastBoundary + 2),
    tail:   input.slice(lastBoundary + 2),
  };
}
```

`StreamingMarkdownRenderer.tsx`:
```tsx
import React, { memo, useMemo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { splitForStreaming } from './utils/splitForStreaming';
import { StreamingCursor } from './utils/streamingCursor';
import type { MarkdownVariant } from './theme';

export interface StreamingMarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
  streaming?: boolean;
}

const Impl: React.FC<StreamingMarkdownRendererProps> = ({
  content, variant = 'chat', className, streaming = false,
}) => {
  const { prefix, tail } = useMemo(() => splitForStreaming(content), [content]);
  return (
    <div className={className}>
      {prefix && <MarkdownRenderer content={prefix} variant={variant} />}
      <MarkdownRenderer content={tail}   variant={variant} />
      {streaming && <StreamingCursor />}
    </div>
  );
};

export const StreamingMarkdownRenderer = memo(Impl);
```

`utils/streamingCursor.tsx`:
```tsx
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Framer-driven cursor. Avoids CSS keyframes so `prefers-reduced-motion`
 * is honoured automatically.
 */
export function StreamingCursor() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="inline-block w-[2px] h-[1em] translate-y-[2px] bg-primary ms-1 align-middle"
      animate={reduce ? undefined : { opacity: [1, 0.3] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
```

#### 5.g — CodeBlock (Shiki lazy)

`components/CodeBlock.tsx`:
```tsx
import { lazy, Suspense, useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { notify } from '@/shared/utils/notify';

const ShikiHighlighter = lazy(() => import('./ShikiHighlighter'));

interface Props { code: string; lang?: string; }

export function CodeBlock({ code, lang }: Props) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    notify.success('Copied');
    setTimeout(() => setCopied(false), 1400);
  }, [code]);

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0d1117]" dir="ltr">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/10">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {lang || 'text'}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy code"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]',
            'text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors',
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Suspense fallback={<pre className="overflow-x-auto p-4 text-sm m-0 bg-transparent"><code>{code}</code></pre>}>
        <ShikiHighlighter code={code} lang={lang} />
      </Suspense>
    </div>
  );
}
```

`components/ShikiHighlighter.tsx`:
```tsx
import { useEffect, useState } from 'react';

const LANGS = ['ts', 'tsx', 'js', 'jsx', 'python', 'bash', 'json', 'sql', 'markdown'] as const;

export default function ShikiHighlighter({ code, lang }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shiki = await import('shiki/bundle/web');
      const highlighter = await shiki.createHighlighter({
        themes: ['github-dark-dimmed'],
        langs: LANGS as unknown as string[],
      });
      if (cancelled) return;
      const safeLang = (LANGS as readonly string[]).includes(lang ?? '') ? lang! : 'text';
      const out = highlighter.codeToHtml(code, { lang: safeLang, theme: 'github-dark-dimmed' });
      setHtml(out);
    })();
    return () => { cancelled = true; };
  }, [code, lang]);

  return (
    <div
      className="shiki-container [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0 [&_pre]:overflow-x-auto text-sm"
      dangerouslySetInnerHTML={html ? { __html: html } : { __html: `<pre><code>${escapeHtml(code)}</code></pre>` }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
```

> `dangerouslySetInnerHTML` here is safe: Shiki produces static syntax markup, and the raw markdown was already run through `rehype-sanitize` upstream (fenced code text is preserved as text). Do NOT bypass sanitization elsewhere.

#### 5.h — Remaining components (Inline code, Table, Link, etc.)

- `InlineCode.tsx` → `<code className="bg-white/5 text-primary/90 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-white/10">`.
- `Table.tsx` → wrap `<table>` in `<div className="overflow-x-auto my-6">` + shadcn-style striping.
- `Link.tsx` → `<a target="_blank" rel="noreferrer noopener" className="text-gold-soft no-underline hover:text-primary hover:underline">`.
- `Heading.tsx` → drop-in for h1..h6 with `anchor-id` (deterministic from text) and `scroll-mt-24`.
- `ListItem.tsx` → merges `<li><p>` bug fix (`[&>p]:my-0`).
- `Image.tsx` → `<img loading="lazy" decoding="async" className="rounded-md border border-white/10" />` with alt fallback.
- `Math.tsx` → passthrough (KaTeX handles).
- `Mermaid.tsx` → lazy dynamic import of `mermaid`, initialize once on mount with `theme: 'dark'`.

`components/index.ts`:
```ts
import type { Components } from 'react-markdown';
import { CodeBlock }   from './CodeBlock';
import { InlineCode }  from './InlineCode';
import { Table }       from './Table';
import { BlockQuote }  from './BlockQuote';
import { Link }        from './Link';
import { Heading }     from './Heading';
import { ListItem }    from './ListItem';
import { Image }       from './Image';

export const markdownComponents: Components = {
  code: ({ inline, className, children }) => {
    const text = String(children).replace(/\n$/, '');
    if (inline) return <InlineCode>{text}</InlineCode>;
    const lang = (className ?? '').replace('language-', '') || undefined;
    return <CodeBlock code={text} lang={lang} />;
  },
  a: Link,
  table: Table,
  blockquote: BlockQuote,
  img: Image,
  li: ListItem,
  h1: Heading('h1'), h2: Heading('h2'), h3: Heading('h3'),
  h4: Heading('h4'), h5: Heading('h5'), h6: Heading('h6'),
};
```

#### 5.i — `theme.css` (≤60 lines)

```css
/* KaTeX overrides */
.katex          { font-size: 1.02em; color: hsl(var(--foreground)); }
.katex-display  {
  overflow-x: auto; overflow-y: hidden;
  padding: 0.75rem 1rem; margin: 1.25rem 0;
  background: hsl(var(--foreground) / 0.03);
  border: 1px solid hsl(var(--border) / 0.1);
  border-radius: var(--radius);
}

/* Streaming cursor is Framer-driven — no CSS keyframe here. */
```

#### 5.j — Consumers

Replace imports across:
- `MessageList.tsx`, `MessageBubble.tsx`, `ChatBubble.tsx` → `<StreamingMarkdownRenderer variant="chat" streaming={isStreaming}>` for the streaming layer; `<MarkdownRenderer variant="chat">` for finalized messages.
- `ExplainSession.tsx` → `<MarkdownRenderer variant="explain">`.
- `SummaryViewer.tsx` → `<MarkdownRenderer variant="summary">`.
- `StreamingMessageRenderer.tsx` file itself: delete (its wrapper role is now the new `StreamingMarkdownRenderer`).

Commit (split into 3 sub-commits — one per major concern):
1. `feat(markdown): scaffold shared/markdown design system (types, plugins, sanitize schema)`
2. `feat(markdown): renderer + streaming split + Shiki lazy code block`
3. `refactor(markdown): migrate consumers (chat, explain, summary) + delete legacy renderers`

---

### 🔹 Batch 6 — Message Scroller (chat transcript) **[TARGET-CORRECTED]**

> Correction vs v2: the imperative scroll orchestration lives in **`widgets/Classroom/ClassroomShell.tsx`** (`useLayoutEffect` with `endEl.scrollIntoView({ block: 'end' })` around lines 18546–18592 in the audit snapshot), **not** in `useClassroomChat.ts`. `useClassroomChat.ts` has no `scrollTo` at all. `MessageList.tsx` owns the transcript container + a small per-message `onScrollToBottom` prop passed to `MessageBubble` (line 4029 in the snapshot).

**Replace:**
- The `useLayoutEffect(() => { endEl.scrollIntoView(...) })` block in `ClassroomShell.tsx`.
- The `handleChatScroll` + `shouldStickToBottom` ref logic in `ClassroomShell.tsx`.
- The `scrollPositionsRef` restore-on-session-switch logic in `ClassroomShell.tsx` → replace with `MessageScrollerProvider`'s `defaultScrollPosition="last-anchor"`.
- The `chatScrollRef` / `messagesEndRef` prop passing between `ClassroomShell` and `MessageList` — the provider owns the viewport now.
- The `onScrollToBottom` prop on `MessageBubble` + `VisualizeButton onExpand={onScrollToBottom}` → the provider auto-scrolls when content grows in the last item.

**Import from `@/components/ui/message-scroller`:**
```tsx
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScrollerVisibility,
  useMessageScrollerScrollable,
} from '@/components/ui/message-scroller';
import { motion } from 'framer-motion';
```

**Five docs behaviors — all must be wired:**

1. **Following the Live Edge** — `autoScroll` on the provider; streamed deltas stay pinned.
2. **Opening Saved Threads** — `defaultScrollPosition="last-anchor"` — restored threads open at the last user turn (matches ChatGPT).
3. **Animating New Messages (slide-side)** — wrap `MessageScrollerItem` with Framer Motion:
   ```tsx
   const MotionMessageScrollerItem = motion.create(MessageScrollerItem);
   // requires framer-motion >= 11 (checked in Batch 0)

   <MotionMessageScrollerItem
     initial={{ opacity: 0, x: role === 'user' ? 24 : -24 }}
     animate={{ opacity: 1, x: 0 }}
     transition={{ duration: 0.28, ease: 'easeOut' }}
     messageId={m.id}
     scrollAnchor={m.role === 'user'}
   >
     …
   </MotionMessageScrollerItem>
   ```
4. **Transcript Outline** — `useMessageScrollerVisibility()` powers a right-rail outline. Create `shared/components/chat/ChatOutlineBadge.tsx` that reads `{ currentAnchorId, visibleMessageIds }` and shows the position; wire it in `ClassroomShell` right-rail (existing right-rail slot).
5. **Reading Scroll State** — `useMessageScrollerScrollable()` gates the `MessageScrollerButton` (hide when `end`). Wrap in `AnimatePresence` with a `slide up + fade` transition.

**Skip:** the "Group Chat" example from the docs — not applicable.

**Delete (grep-verified — every match must be gone):**
```bash
grep -rnE "scrollTo|scrollIntoView|onScrollToBottom|shouldStickToBottom|scrollPositionsRef" \
  frontend/src/features/chat/ frontend/src/widgets/Classroom/
# Expected: 0 matches (or documented with an inline comment justifying the exception).
```

Also remove:
- `chatScrollRef`, `messagesEndRef` prop plumbing from `MessageList.tsx` (no longer needed — the provider owns them).
- Any leftover `.chat-messages`, `.chat-stream`, `.welcome-*` legacy classes **inside the transcript container** (input container untouched here).

**Accessibility:**
- `MessageScrollerButton`: `aria-label="Scroll to latest"`.
- Live-region defaults come from `MessageScrollerContent` — do NOT override.

**Verification grep (must be empty after this batch):**
```bash
grep -rnE "scrollTo|scrollIntoView|onScrollToBottom" src/features/chat/ src/widgets/Classroom/
```
If anything remains, either delete it or add an inline `// intentional: <reason>` comment.

Commit (split into 3 sub-commits):
1. `feat(chat): wire MessageScrollerProvider in ClassroomShell + swap transcript viewport`
2. `feat(chat): animate MessageScrollerItem with framer-motion + right-rail outline`
3. `refactor(chat): remove legacy scroll refs + onScrollToBottom prop chain`

---

### 🔹 Batch 7 — Shimmer for "Thinking…" states

**Replace** current `typing-dot` / `typing-indicator` / `MessageStatus` (three-dot spinner) in `shared/components/ChatPrimitives.tsx` and any other "assistant is thinking" placeholder.

**New pattern:**
```tsx
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker';
import { Spinner } from '@/components/ui/spinner';

export function ThinkingMarker({ label = 'Thinking…' }: { label?: string }) {
  return (
    <Marker role="status" aria-live="polite">
      <MarkerIcon><Spinner /></MarkerIcon>
      <MarkerContent className="shimmer shimmer-duration-1800">{label}</MarkerContent>
    </Marker>
  );
}
```

**Additional shimmer uses (mandatory — keeps the app cohesive):**
- Streaming banner while WebSocket is connecting (in `ConnectionBadge.tsx`):
  ```tsx
  <span className="shimmer shimmer-color-muted-foreground text-sm">Connecting…</span>
  ```
- RAG upload processing stage indicator in `UploadTab.tsx`:
  ```tsx
  <span className="shimmer shimmer-once shimmer-duration-1100">Indexing document…</span>
  ```
- Voice-mode listening prompt in `VoiceMode` UI:
  ```tsx
  <span className="shimmer shimmer-color-crimson-glow">Listening…</span>
  ```

**Delete:**
- `.typing-dot`, `.typing-indicator`, three-dot span cluster in `ChatPrimitives.tsx`.
- Any `@keyframes typing-blink` etc. in the (soon-deleted) CSS files.

**RTL:** shimmer follows reading direction natively — no extra config.
**Reduced motion:** already handled by shadcn — no-op when `prefers-reduced-motion`.

Commit: `feat(ui): replace typing dots with shimmer Marker across all "thinking" states`.

---

### 🔹 Batch 8 — Scroll-fade on session / documents / history lists

Apply `scroll-fade scroll-fade-24` (with `no-scrollbar` where visually cleaner) to every long vertical list. `24` matches the docs default.

**Concrete replacements:**

1. `features/session/components/SessionList.tsx` — the sessions list container (`.sidebar-sessions-scroll`):
   ```tsx
   <div
     ref={listRef}
     className="scroll-fade scroll-fade-24 overflow-y-auto no-scrollbar h-full"
   >
     {sessions.map(...)}
   </div>
   ```
   Also delete any manual gradient-mask on top/bottom (currently done via a CSS class → remove it).

2. `features/documents/components/DocumentsPanel.tsx` — document list scroll area.
3. `features/quiz/components/Dashboard/QuizDashboard.tsx` — past-quiz history list (if scrollable).
4. `features/setup/components/VoiceTab.tsx` — replace `.voice-tab-scroll` with `scroll-fade scroll-fade-24 overflow-y-auto no-scrollbar`.
5. **Horizontal** overflow-x rails: use `scroll-fade-x scroll-fade-24` (e.g., `ClassroomLeftRail` icon rail if it ever scrolls, featured tags row in `Overview`).

**No-fade escape hatch:** for short lists that "flicker", use `md:scroll-fade-none` responsively — don't remove the base fade.

**Compatibility with `MessageScrollerViewport`:**
```tsx
<MessageScrollerViewport className="scroll-fade scroll-fade-24">
  …
</MessageScrollerViewport>
```

Commit: `feat(ui): apply scroll-fade-24 to all long lists + MessageScroller viewport`.

---

### 🔹 Batch 9 — Context Menu (rename / delete) + Alert Dialog (delete confirm)

**Replace:** the hand-rolled context menu in `SessionList.tsx` (currently built with `createPortal`, `contextMenu` state, manual outside-click, and a bespoke `clear-confirm-*` modal — verified at snapshot lines 8166–8221).

**Delete from `SessionList.tsx`:**
- `contextMenu` state + all `useEffect` handling outside-click + scroll close.
- The `createPortal` menu render block (both — the rename/delete one AND the `isConfirmClearOpen` modal).
- All `.clear-confirm-*` classes (they die with the CSS file in Batch 12).

**New pattern per session row:**
```tsx
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import { notify } from '@/shared/utils/notify';

function SessionRow({ session, isActive, onSelect, onStartRename, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => onSelect(session.id)}
            className={cn(
              'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm',
              'hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary/50',
              isActive && 'bg-white/10 text-foreground',
            )}
          >
            {session.title}
          </button>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => onStartRename(session.id)}>
            <Pencil className="size-4" />
            <span>Rename</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={(e) => { e.preventDefault(); setDialogOpen(true); }}
          >
            <Trash2 className="size-4" />
            <span>Delete chat</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This action can't be undone. The chat "{session.title}" and its history will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { onDelete(session.id); notify.success('Chat deleted'); }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Rename UX:** keep the inline rename input inside the row (existing `editValue` state). The context menu just triggers `startRename(sessionId)` → flips `editingId`.

**"Clear all chats" flow** — replace the `createPortal` modal with a single top-of-drawer `AlertDialog`:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Delete all sessions">
      <Trash2 className="size-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
      <AlertDialogDescription>
        This will remove {sessions.length} chats from your history. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={() => { onClearAllSessions?.(); notify.success('All chats deleted'); }}
      >
        Delete all
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Accessibility & keyboard:**
- ContextMenu supports long-press on touch — built-in.
- AlertDialog auto-focuses Cancel; verify Escape closes and Enter on Delete triggers action.
- RTL: menu positions flip automatically. Pencil + Trash2 are symmetrical — no `rtl:rotate-180` needed.

**Grep sweep after (must be empty):**
```bash
grep -rnE "createPortal|contextMenu|clear-confirm" src/features/session/
```

Commit: `feat(session): shadcn ContextMenu + AlertDialog for rename/delete + clear-all flows`.

---

### 🔹 Batch 10 — Carousel for Help page (with Autoplay plugin)

**Replace:** the entire manual carousel in `pages/Help/index.tsx` (verified snapshot: `useState(step)` + `AnimatePresence` + custom left/right buttons + keyboard listener + `Help.module.css`).

**Also delete:** `pages/Help/Help.module.css` in the same commit. `FeatureCard.tsx` becomes a pure Tailwind component.

**New Help page:**
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Autoplay from 'embla-carousel-autoplay';
import { FiArrowLeft } from 'react-icons/fi';
import {
  Carousel, CarouselApi, CarouselContent, CarouselItem,
  CarouselNext, CarouselPrevious,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { FeatureCard, Feature } from './FeatureCard';

const features: Feature[] = [ /* unchanged data */ ];

export default function HelpPage() {
  const navigate = useNavigate();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const dir = typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/classroom')}
        className="mb-6 gap-2"
      >
        <FiArrowLeft className="rtl:rotate-180" /> Back to classroom
      </Button>

      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          <span className="text-primary">Features</span> Tour
        </h1>
        <span className="text-sm text-muted-foreground">
          {current + 1} / {features.length}
        </span>
      </header>

      <Carousel
        setApi={setApi}
        dir={dir}
        opts={{ align: 'start', loop: true, direction: dir }}
        plugins={[
          Autoplay({ delay: 5500, stopOnInteraction: true, stopOnMouseEnter: true }),
        ]}
        className="w-full"
      >
        <CarouselContent className="-ms-4">
          {features.map((f) => (
            <CarouselItem key={f.id} className="ps-4 md:basis-1/2 lg:basis-1/1">
              <FeatureCard feature={f} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="rtl:rotate-180" />
        <CarouselNext className="rtl:rotate-180" />
      </Carousel>
    </section>
  );
}
```

**FeatureCard rewrite (Tailwind only, no CSS module):**
```tsx
import { useEffect, useRef } from 'react';

export interface Feature { id: string; title: string; videoSrc: string; desc: string; }

export function FeatureCard({ feature }: { feature: Feature }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { videoRef.current?.load(); }, [feature.videoSrc]);

  return (
    <article className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:grid-cols-[1.35fr_1fr]">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <video
          ref={videoRef}
          key={feature.videoSrc}
          src={feature.videoSrc}
          className="aspect-video w-full object-cover"
          controls muted autoPlay loop preload="metadata"
        />
      </div>
      <div className="flex flex-col justify-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{feature.title}</h2>
        <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wider text-primary">When to use it</div>
          <p className="mt-1 text-sm text-foreground/90">Perfect for visual learning and interactive sessions.</p>
        </div>
      </div>
    </article>
  );
}
```

**Delete:**
- `pages/Help/Help.module.css`.
- Manual keyboard listener (Embla handles arrow keys via `opts.watchDrag`; if the version in use does not, keep a tiny `useEffect` that calls `api?.scrollPrev()` / `api?.scrollNext()` on Arrow keys — nothing more).
- The custom `<motion.div>` slide-transition logic (Embla owns it).

Commit: `feat(help): rebuild Help page with shadcn Carousel + Autoplay plugin`.

---

### 🔹 Batch 11 — Alert (custom-colored variants) + Sonner standardization + `notify` wrapper

#### 11.a — Alert variants

Create `components/ui/alert-variants.tsx`:
```tsx
import { CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/shared/utils/cn';
import type { ReactNode } from 'react';

interface Props { title?: string; children: ReactNode; className?: string; }

export function SuccessAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-emerald-500/20 bg-emerald-500/5 text-emerald-200 [&>svg]:text-emerald-400', className)}>
      <CheckCircle2 />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function InfoAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-sky-500/20 bg-sky-500/5 text-sky-100 [&>svg]:text-sky-300', className)}>
      <Info />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function WarningAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-amber-500/25 bg-amber-500/5 text-amber-100 [&>svg]:text-amber-300', className)}>
      <AlertTriangle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function DangerAlert({ title, children, className }: Props) {
  return (
    <Alert
      variant="destructive"
      className={cn('border-crimson/30 bg-crimson/10 text-crimson-glow [&>svg]:text-crimson-glow', className)}
    >
      <AlertCircle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
```

**Wire consumers (verified against the audit):**
- `UploadTab.tsx` `.error-banner` (both occurrences) → `<DangerAlert>`.
- Voice permission missing (in Voice feature) → `<WarningAlert>`.
- RAG indexing complete → `<SuccessAlert>` (short-lived) **or** a Sonner toast — pick one per flow, do not fire both.
- Connection unstable (ConnectionBadge) → `<WarningAlert>` inline.
- "Setup complete" celebration in `AllSetTab.tsx` → `<SuccessAlert>` w/ `<AlertAction>` linking to Classroom.

**Delete** every `.error-banner` / `.warning-banner` / ad-hoc red divs. Grep after (must be 0):
```bash
grep -rnE "error-banner|warning-banner" src/
```

#### 11.b — Sonner canonical config

Update `components/ui/sonner.tsx`:
```tsx
import { Toaster as SonnerPrimitive } from 'sonner';

export function Toaster() {
  return (
    <SonnerPrimitive
      theme="dark"
      richColors
      closeButton
      position="bottom-right"
      expand
      duration={4000}
      toastOptions={{
        classNames: {
          toast:        'border border-white/10 bg-card/90 backdrop-blur-xl text-card-foreground shadow-lg',
          title:        'text-sm font-medium',
          description:  'text-xs text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-white/5 text-foreground',
          success:      'border-emerald-500/30',
          error:        'border-crimson/40',
          warning:      'border-amber-500/30',
          info:         'border-sky-500/30',
        },
      }}
    />
  );
}
```

Mount `<Toaster />` **once** in `AppShell.tsx`. Grep to confirm no duplicate mounts:
```bash
grep -rn "<Toaster" src/
```

#### 11.c — `notify` wrapper

`shared/utils/notify.ts`:
```ts
import { toast } from 'sonner';

export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  error:   (msg: string, description?: string) => toast.error(msg,   { description }),
  warning: (msg: string, description?: string) => toast.warning(msg, { description }),
  info:    (msg: string, description?: string) => toast.info(msg,    { description }),
  loading: (msg: string) => toast.loading(msg),
  promise: <T,>(p: Promise<T>, opts: { loading: string; success: string; error: string }) =>
    toast.promise(p, opts),
};
```

Replace all direct `toast(...)` calls across the codebase with `notify.success/error/…` unless you truly need raw Sonner (e.g. `toast.promise`).

Commit: `feat(ui): custom-colored Alert set + canonical Sonner Toaster + notify wrapper`.

---

### 🔹 Batch 12 — Convert Remaining Feature CSS & CSS Modules → Tailwind

Handle **one file per sub-task, one commit each**. Order (easy → hard):

- 12.1 `SlideQuestionInput.css` → Tailwind
- 12.2 `SessionHoverPreview.css` → Tailwind + Framer Motion
- 12.3 `NotFound.css` → Tailwind
- 12.4 `UploadTab.css` → Tailwind (drag-drop dashed border via Tailwind: `border-2 border-dashed border-white/20 data-[dragging=true]:border-primary/60`). Also removes any remnants of `.error-banner` if still present after Batch 11.
- 12.5 `DocumentsPanel.css` → Tailwind
- 12.6 `Setup.css` → Tailwind
- 12.7 `Quiz.module.css` → Tailwind (delete module, remove `styles.*` refs)
- 12.8 `Classroom.css` (biggest — split into 3 sub-commits: layout, avatar-topbar, left-rail)
- 12.9 `ExplainSession.css` → Trim to ≤30 lines, keep only Markdown overrides that can't be expressed as prose classes.

**Rule:** zero lines left in any `.css` file after conversion. If a `@keyframes` truly can't be inlined, move it into `tailwind.config.ts` under `theme.extend.keyframes` and reference from a Tailwind `animation`.

Commits per sub-task: `refactor(feature/<name>): convert to Tailwind`.

---

### 🔹 Batch 13 — Kill Legacy Chat Primitives + Inline Styles

**Rebuild `shared/components/ChatPrimitives.tsx`** — currently owns 17 kebab-case classes (verified snapshot lines 15189–15277) including a `w-[45px]` spacer hack and hard-coded `#D4B47A`.

- Split into `Avatar.tsx`, `ChatBubble.tsx`, `MessageMeta.tsx` under `shared/components/chat/`.
- Use shadcn `<Avatar>` (Radix) for the avatar.
- Bubble variants via CVA:
   ```ts
   const bubbleVariants = cva('rounded-2xl px-4 py-2.5 max-w-[85%]', {
     variants: {
       role: {
         user:      'bg-primary text-primary-foreground ms-auto',
         assistant: 'bg-transparent text-foreground me-auto w-full',
       },
       state: {
         normal:  '',
         interim: 'opacity-60 italic',
       },
     },
     defaultVariants: { role: 'assistant', state: 'normal' },
   });
   ```
- The "thinking" state now uses `ThinkingMarker` from Batch 7 — remove `.typing-*` code entirely.
- Timestamp: use flex + `text-[10px] text-muted-foreground` via Tailwind. Delete the `<span className="inline-block w-[45px]"></span>` spacer hack.
- Replace hard-coded `#D4B47A` with `text-primary` (Batch 1 tokens make it identical).

**Inline-style cleanup (22 files per audit):**
- KEEP: `CircuitBoardBackground.tsx` (canvas coords), `useVisualViewport.ts` (CSS var), Framer Motion `style={motionValueDerived}`.
- CONVERT: static `style={{ marginTop: 8 }}` → `mt-2` on Tailwind. Do this for every file in the audit list.

Commit split:
1. `refactor(chat): rebuild ChatPrimitives with shadcn Avatar + CVA + shimmer thinking state`.
2. `refactor(ui): remove static inline styles across 20 files`.

---

### 🔹 Batch 14 — Rebuild PageLoader + VoiceIndicator + Splash with Motion

- `shared/components/PageLoader.tsx` → three-dot bouncer via three `<motion.span>` with staggered `y` animation. No CSS.
  ```tsx
  const dot = { animate: { y: [0, -6, 0] }, transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } };

  export default function PageLoader({ label = 'Preparing VirtAI services…' }: { label?: string | null }) {
    return (
      <div role="status" aria-label={label ?? undefined} className="flex flex-col items-center gap-4">
        <div aria-hidden className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-2 rounded-full bg-primary"
              {...dot}
              transition={{ ...dot.transition, delay: i * 0.15 }}
            />
          ))}
        </div>
        {label && <p className="text-sm text-muted-foreground">{label}</p>}
      </div>
    );
  }
  ```
- `shared/components/VoiceIndicator.tsx` → concentric pulsing rings via Framer Motion (`animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}` + stagger).
- `widgets/Overview/SplashScreen.tsx` → verify it uses Motion (per audit it does) and clean any remaining kebab-case classes.

Commit: `refactor(ui): rebuild PageLoader + VoiceIndicator with Framer Motion`.

---

### 🔹 Batch 15 — Virtualization for large lists **[NEW — performance premium]**

Even after `MessageScroller`, 500+ items in `SessionList` or `MessageScrollerContent` will jank on mid-range devices. Add `@tanstack/react-virtual`:

1. `pnpm add @tanstack/react-virtual`.
2. Wrap `SessionList` inner scroll area with `useVirtualizer` — dynamic row heights via `measureElement`.
3. Wrap `MessageScrollerContent` rendering with virtualization **only if** the transcript exceeds 100 messages (feature-flag via `messages.length > 100`).
   - Preserve the `MessageScrollerItem` semantics — pass through `messageId` + `scrollAnchor`.
4. Do NOT virtualize `DocumentsPanel` unless it also crosses 100 items — the perf gain is not worth the complexity.

Commit: `perf(ui): virtualize SessionList + long transcripts with @tanstack/react-virtual`.

---

### 🔹 Batch 16 — Verification, Bundle Analysis, Cleanup **[EXPANDED]**

#### 16.a — Grep sweep — every one of these must return **zero** lines

```bash
# 1. CSS imports (allowed: globals.css, shared/markdown/theme.css, ExplainSession.css, katex.min.css)
grep -rE "import [^;]*\.css['\"]" frontend/src/ \
  | grep -vE "globals\.css|markdown/theme\.css|ExplainSession\.css|katex\.min\.css"

# 2. Legacy classes
grep -rnE "(page-loader|slide-drawer|drawer-body|user-avatar|ai-avatar|chat-message-wrapper|typing-dot|typing-indicator|voice-btn|classroom-shell|classroom-page|error-banner|warning-banner|clear-confirm|sidebar-sessions-scroll|voice-tab-scroll|welcome-state|welcome-icon|welcome-title|welcome-subtitle)" frontend/src/

# 3. CSS Modules
grep -rn "\.module\.css" frontend/src/

# 4. Portals / hand-rolled context menus
grep -rn "createPortal" frontend/src/features/session/

# 5. Manual scroll orchestration in chat/classroom
grep -rnE "scrollTo|scrollIntoView|onScrollToBottom|shouldStickToBottom" frontend/src/features/chat/ frontend/src/widgets/Classroom/
```

Any hit that survives must have an inline `// intentional: <reason>` comment AND a log entry under `## Extras Found` in the TODO.

#### 16.b — Build & type & lint

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
```

All three must be clean.

#### 16.c — Bundle diff (measured, not vibes)

```bash
# Compare against Batch 0 baseline captured in REFACTOR_TODO.md
pnpm build
open dist/stats.html   # Rollup visualizer — screenshot before/after and paste under "## Refactor Complete"
```

**Regression gates** (must pass to merge):
- **CSS bundle**: ≥ 40 % reduction vs baseline (removing 18 CSS files easily crosses this).
- **JS bundle (gzipped)**: **≤ 8 % increase** vs baseline (Shiki + shadcn primitives add weight, but lazy-loading + tree-shaking should keep this small).
- **First-load JS**: must not exceed baseline + 15 KB.

If any gate fails, **do not merge** — file a follow-up sub-batch to trim.

#### 16.d — Manual smoke test on every route

- `/` (Overview), `/auth`, `/setup`, `/classroom`, `/quiz`, `/help`, `/404`.
- Verify:
  - [ ] RTL toggle still works (Arabic ↔ English).
  - [ ] Context menu on session rows opens with right-click + long-press.
  - [ ] Delete AlertDialog fires + auto-focuses Cancel.
  - [ ] Carousel autoplays, pauses on hover, RTL flips arrows correctly.
  - [ ] Shimmer visible while "Thinking…" in chat + "Indexing…" in upload.
  - [ ] `MessageScroller` pins to live edge during streaming; button appears when scrolled up.
  - [ ] Scroll-fade visible on long lists.
  - [ ] Markdown rendering: code blocks have language badge + copy button; LaTeX renders inline + block; tables scroll horizontally on small screens; XSS attempt `![x](javascript:alert(1))` is neutralized.
  - [ ] Sonner toasts stack in bottom-right; close button works.

#### 16.e — Update TODO & PR

Tick every remaining box. Append to `REFACTOR_TODO.md`:

```md
## ✅ Refactor Complete

- CSS files removed: <N> (previously 20)
- CSS Modules removed: 2
- Components migrated to shadcn: <M>
- Bundle size delta (CSS): <before>KB → <after>KB (<-XX%>)
- Bundle size delta (JS gzipped): <before>KB → <after>KB (<±XX%>)
- First-load JS: <before>KB → <after>KB
- Lighthouse (Performance / Accessibility / Best Practices): <before> → <after>
```

Commit: `chore: final verification + refactor summary`.

Open PR: `refactor: migrate to Tailwind + shadcn/ui design system (v3)`. Include the summary block in the description. Attach the two Rollup visualizer screenshots.

---

## 🚦 RULES OF ENGAGEMENT (recap)

1. After every batch: type-check + lint + build + commit + tick TODO.
2. Large batches (5, 6, 9, 10, 12, 13, 15, 16): split into sub-commits.
3. Ambiguity → `## Open Questions` in TODO. Never guess.
4. Context limit approaching:
   - Commit + push all in-flight work.
   - Tick TODO up to the last fully verified sub-task only.
   - Write `## Handoff Log` entry.
   - End reply with `> HANDOFF: next agent resumes at Batch X.Y. Branch: refactor/styling-foundation.`
5. Commit style: Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`).
6. Never introduce new external CSS files. If unavoidable, justify in the commit body + log under `## Extras Found`.

---

## 🎨 DESIGN LANGUAGE (keep in mind at all times)

- **Palette:** dark base + gold primary + crimson destructive. Sky / emerald / amber only for `Info` / `Success` / `Warning` alerts.
- **Radii:** `rounded-lg` (8px) default, `rounded-xl` (12px) for cards, `rounded-2xl` (16px) for chat bubbles.
- **Borders:** `border-white/10` subtle, `border-white/20` stronger.
- **Elevation:** prefer glass (`bg-white/[0.03] backdrop-blur-xl border border-white/10`) over hard shadows.
- **Typography rhythm:**
  - Body: 15–16px, `leading-[1.7]`.
  - Prose paragraphs: `my-3` chat, `my-4` explain.
  - Headings: bold, `tracking-tight`, generous top margin.
- **Motion:** default `duration-200 ease-out`. Springs for enter/exit on cards.
- **Focus rings:** `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
- **Icons:** `lucide-react`, `size-4` default, `size-5` in headers. Migrate `react-icons` uses to `lucide-react` opportunistically (not in scope unless trivial).
- **Logical properties over physical:** `ms-*` / `me-*` / `ps-*` / `pe-*` / `text-start` / `text-end` — RTL-safe by default.

---

## 🧪 QUALITY GATES (never cross without them)

Before advancing from batch N to N+1:
- [ ] `pnpm tsc --noEmit` — zero errors.
- [ ] `pnpm lint` — zero errors (including `eslint-plugin-tailwindcss`).
- [ ] Existing passing tests still pass.
- [ ] TODO is up-to-date.
- [ ] Commit exists on branch.

Additional gates at Batch 16:
- [ ] Grep sweep A–E returns zero unauthorized matches.
- [ ] CSS bundle drop ≥ 40 %.
- [ ] JS gzipped increase ≤ 8 %.
- [ ] First-load JS delta ≤ +15 KB.

---

## 🏁 END OF PROMPT

Start at **Batch 0**. Do not think about Batch 1 until Batch 0 is 100% ✅ and the environment gates pass. Do not invent new batches — log findings under `## Extras Found`.

**Remember: you are Senior. Act like it.**
