# 🧭 VirtAI Frontend — Migration Guide

هذا الملف يشرح **بالظبط** إيه اللي هتعمله يدوياً بعد ما تنسخ الملفات المعدّلة
من الـZIP ده لمشروعك. الترتيب مهم — اتبعه بالتسلسل.

> Branch: `refactor/styling-foundation`
> يتوافق مع Batches: **12** (CSS removal), **13.2** (inline-style cleanup),
> **15.5 – new** (structure reorg), **16** (verification).

---

## 0️⃣ نسخ الملفات المعدّلة

كل ملف في ZIP موجود على المسار النهائي بتاعه داخل `frontend/src/…`.
انسخهم كلهم فوق الفايلات القديمة بنفس المسار.

```bash
# من داخل مجلد المشروع
unzip -o virtai_refactor.zip -d .
```

الشجرة المعدّلة (اللي جوة الـZIP):

```
frontend/src/
├── app/
│   ├── layouts/AppLayout.tsx                        (تعديل)
│   └── styles/globals.css                           (استبدال كامل)
├── features/
│   ├── avatar/hooks/
│   │   ├── useAvatarAnimations.ts                   (shim موقّت)
│   │   └── useAvatarLipSync.ts                      (shim موقّت)
│   ├── chat/components/ChatInput.tsx                (تعديل)
│   ├── documents/
│   │   ├── api/documentApi.ts                       (shim موقّت)
│   │   ├── hooks/useDocumentList.ts                 (shim موقّت)
│   │   └── types/index.ts                           (shim موقّت)
│   ├── explain/components/ExplainSession.tsx        (تعديل)
│   └── session/components/
│       ├── SettingsDrawer.tsx                       (تعديل)
│       └── SessionList.patch.md                     (تعديل سطر واحد فقط)
├── pages/
│   ├── AvatarPlayground/index.tsx                   (نقل + patch)
│   └── Classroom/index.tsx                          (تعديل)
├── shared/
│   ├── components/
│   │   ├── index.ts                                 (barrel جديد)
│   │   ├── chat/index.ts                            (barrel)
│   │   ├── controls/index.ts                        (barrel)
│   │   ├── feedback/index.ts                        (barrel)
│   │   ├── indicators/index.ts                      (barrel)
│   │   └── layout/{index.ts, SlideDrawer.tsx}
│   └── markdown/
│       ├── MarkdownRenderer.tsx                     (تعديل بسيط)
│       └── theme.css                                (جديد — استبدال theme.css القديم)
└── widgets/
    ├── Classroom/components/AvatarCanvasWrapper.tsx (نقل + تعديل)
    ├── Overview/CircuitBoardBackground.tsx          (patch excerpt)
    └── Overview/Navbar.tsx                          (patch excerpt)
```

---

## 1️⃣ ملفات CSS اللي هتتشال نهائي

```bash
git rm frontend/src/widgets/Classroom/Classroom.css
git rm frontend/src/features/explain/components/ExplainSession.css
```

بعد كده امسح الـimports دي:

| الملف                                              | السطر اللي يتشال                                     |
|----------------------------------------------------|-------------------------------------------------------|
| `frontend/src/pages/Classroom/index.tsx`           | `import '@/widgets/Classroom/Classroom.css';`         |
| `frontend/src/features/explain/components/ExplainSession.tsx` | `import './ExplainSession.css';`                      |

*(الملفين الجديدين في الـZIP فعلاً بدون هذه الـimports.)*

الـoverrides الوحيدة اللي كانت في `ExplainSession.css` مبنية للـMarkdown في
slide-mode. نُقلت لـ `shared/markdown/theme.css` تحت `.slide-mode .prose`.

---

## 2️⃣ نقل الملفات (`git mv`)

نفذ الأوامر دي بالترتيب من جذر الريبو:

```bash
# --- shared/components sub-folders ---
mkdir -p frontend/src/shared/components/{feedback,indicators,layout,controls,chat}

git mv frontend/src/shared/components/ErrorBoundary.tsx      frontend/src/shared/components/feedback/
git mv frontend/src/shared/components/PageLoader.tsx         frontend/src/shared/components/feedback/
git mv frontend/src/shared/components/UIStates.tsx           frontend/src/shared/components/feedback/
git mv frontend/src/shared/components/ConnectionBadge.tsx    frontend/src/shared/components/feedback/

git mv frontend/src/shared/components/VoiceIndicator.tsx     frontend/src/shared/components/indicators/
git mv frontend/src/shared/components/SelectionCheckmark.tsx frontend/src/shared/components/indicators/

git mv frontend/src/shared/components/SectionHeader.tsx      frontend/src/shared/components/layout/
git mv frontend/src/shared/components/SlideDrawer.tsx        frontend/src/shared/components/layout/

git mv frontend/src/shared/components/CopyButton.tsx         frontend/src/shared/components/controls/
git mv frontend/src/shared/components/ToolbarButton.tsx      frontend/src/shared/components/controls/

git mv frontend/src/shared/components/ChatPrimitives.tsx     frontend/src/shared/components/chat/

# --- services/ → core & features ---
git mv frontend/src/services/wsManager.ts       frontend/src/core/realtime/wsManager.ts
mkdir -p frontend/src/features/documents/services
git mv frontend/src/services/uploadService.ts   frontend/src/features/documents/services/uploadService.ts
rmdir frontend/src/services 2>/dev/null || true

# --- features/avatar hooks in the wrong folder ---
mkdir -p frontend/src/features/avatar/hooks
git mv frontend/src/features/avatar/components/useAvatarAnimations.ts frontend/src/features/avatar/hooks/
git mv frontend/src/features/avatar/components/useAvatarLipSync.ts    frontend/src/features/avatar/hooks/

# --- move Avatar docs out of components/ ---
mkdir -p frontend/src/features/avatar/docs
git mv frontend/src/features/avatar/components/AvatarAudit.md frontend/src/features/avatar/docs/

# --- features/documents root files → subfolders ---
mkdir -p frontend/src/features/documents/{api,hooks,types}
git mv frontend/src/features/documents/documentApi.ts     frontend/src/features/documents/api/documentApi.ts
git mv frontend/src/features/documents/useDocumentList.ts frontend/src/features/documents/hooks/useDocumentList.ts
git mv frontend/src/features/documents/types.ts           frontend/src/features/documents/types/index.ts

# --- pages: AvatarPlayground.tsx → folder ---
mkdir -p frontend/src/pages/AvatarPlayground
git mv frontend/src/pages/AvatarPlayground.tsx frontend/src/pages/AvatarPlayground/index.tsx

# --- widgets/Classroom: promote tsx into components/ ---
mkdir -p frontend/src/widgets/Classroom/components
git mv frontend/src/widgets/Classroom/AssistantPanel.tsx        frontend/src/widgets/Classroom/components/
git mv frontend/src/widgets/Classroom/AvatarCanvasWrapper.tsx   frontend/src/widgets/Classroom/components/
git mv frontend/src/widgets/Classroom/AvatarTopBar.tsx          frontend/src/widgets/Classroom/components/
git mv frontend/src/widgets/Classroom/ClassroomLeftRail.tsx     frontend/src/widgets/Classroom/components/
git mv frontend/src/widgets/Classroom/ClassroomShell.tsx        frontend/src/widgets/Classroom/components/

# avatarLifecycle is a utility, not a component → utils/
mkdir -p frontend/src/widgets/Classroom/utils
git mv frontend/src/widgets/Classroom/avatarLifecycle.ts frontend/src/widgets/Classroom/utils/

# --- widgets/Overview: move sections ---
mkdir -p frontend/src/widgets/Overview/sections
git mv frontend/src/widgets/Overview/HeroSection.tsx         frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/FeaturesSection.tsx     frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/TechStackSection.tsx    frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/FAQSection.tsx          frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/StatsSection.tsx        frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/TestimonialsSection.tsx frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/DemoPreview.tsx         frontend/src/widgets/Overview/sections/
git mv frontend/src/widgets/Overview/Footer.tsx              frontend/src/widgets/Overview/sections/
# ⚠️ لو ملف `widgets/Overview/RightPipeline.tsx` فارغ في مشروعك، اتركه — النسخة
#    الحقيقية موجودة في `widgets/Overview/HowItWorks/RightPipeline.tsx`.
```

---

## 3️⃣ تحديث الـImports بالجملة

نفذ الـsed replacements دي من جذر الريبو (macOS استخدم `sed -i ''`):

```bash
# services/ → core/realtime + features/documents
grep -rl "@/services/wsManager\|from '\.\./services/wsManager\|from '\.\./\.\./services/wsManager" frontend/src \
  | xargs sed -i 's|@/services/wsManager|@/core/realtime/wsManager|g'

grep -rl "@/services/uploadService" frontend/src \
  | xargs sed -i 's|@/services/uploadService|@/features/documents/services/uploadService|g'

# shared/components/* → new sub-folders
declare -A MAP=(
  [ErrorBoundary]=feedback
  [PageLoader]=feedback
  [UIStates]=feedback
  [ConnectionBadge]=feedback
  [VoiceIndicator]=indicators
  [SelectionCheckmark]=indicators
  [SectionHeader]=layout
  [SlideDrawer]=layout
  [CopyButton]=controls
  [ToolbarButton]=controls
  [ChatPrimitives]=chat
)
for name in "${!MAP[@]}"; do
  bucket="${MAP[$name]}"
  grep -rl "@/shared/components/${name}" frontend/src \
    | xargs sed -i "s|@/shared/components/${name}|@/shared/components/${bucket}/${name}|g"
done

# features/avatar hooks
grep -rl "@/features/avatar/components/useAvatarAnimations\|@/features/avatar/components/useAvatarLipSync" frontend/src \
  | xargs sed -i \
    -e 's|@/features/avatar/components/useAvatarAnimations|@/features/avatar/hooks/useAvatarAnimations|g' \
    -e 's|@/features/avatar/components/useAvatarLipSync|@/features/avatar/hooks/useAvatarLipSync|g'

# features/documents root files
grep -rl "@/features/documents/documentApi\|@/features/documents/useDocumentList\|@/features/documents/types'" frontend/src \
  | xargs sed -i \
    -e 's|@/features/documents/documentApi|@/features/documents/api/documentApi|g' \
    -e 's|@/features/documents/useDocumentList|@/features/documents/hooks/useDocumentList|g' \
    -e "s|@/features/documents/types'|@/features/documents/types'|g"

# widgets/Classroom internals now live under components/
for name in AssistantPanel AvatarCanvasWrapper AvatarTopBar ClassroomLeftRail ClassroomShell; do
  grep -rl "@/widgets/Classroom/${name}" frontend/src \
    | xargs sed -i "s|@/widgets/Classroom/${name}|@/widgets/Classroom/components/${name}|g"
done
grep -rl "@/widgets/Classroom/avatarLifecycle" frontend/src \
  | xargs sed -i "s|@/widgets/Classroom/avatarLifecycle|@/widgets/Classroom/utils/avatarLifecycle|g"

# widgets/Overview sections
for name in HeroSection FeaturesSection TechStackSection FAQSection StatsSection TestimonialsSection DemoPreview Footer; do
  grep -rl "@/widgets/Overview/${name}\|from '\./${name}'" frontend/src \
    | xargs sed -i "s|@/widgets/Overview/${name}|@/widgets/Overview/sections/${name}|g"
done
```

بعد الـsed sweep، شغّل:

```bash
pnpm tsc --noEmit
```

لو TypeScript لسه بيشتكي من imports قديمة، دور عليها يدوياً وصلحها.

---

## 4️⃣ الـInline-style Patches اللي محتاجة يد بشرية

الملفات دي كبيرة جداً عشان نبعتها كاملة في الـZIP، فبنبعتلك excerpt patch.
افتح كل ملف من مشروعك وطبّق التغيير:

### `frontend/src/features/session/components/SessionList.tsx` (السطر 250)

```diff
- <div className="sidebar-inner" style={{ width: '100%', position: 'relative' }}>
+ <div className="sidebar-inner w-full relative">
```

### `frontend/src/widgets/Overview/CircuitBoardBackground.tsx` (السطور 606-622)

استبدل بلوك الـ`return` بالكامل:

```diff
  return (
    <canvas
      ref={canvasRef}
-     className={className}
-     style={{
-       position: 'fixed',
-       top: 0,
-       left: 0,
-       width: '100vw',
-       height: '100vh',
-       zIndex: 0,
-       pointerEvents: 'none',
-       opacity,
-     }}
+     className={`fixed top-0 left-0 w-screen h-screen z-0 pointer-events-none ${className ?? ''}`}
+     style={{ opacity }}
      aria-hidden="true"
    />
  );
```

### `frontend/src/widgets/Overview/Navbar.tsx` (السطور 220-232)

استبدل بلوك الـlink `<a>`:

```diff
+ import { cn } from '@/shared/utils/cn';
  …
  <a
    href={`#${target}`}
    onClick={(e) => { e.preventDefault(); scrollTo(target); }}
-   className="relative block cursor-pointer px-1 py-2 …"
-   style={{
-     color: activeId === target ? '#B4AB8B' : '#f5f1ec',
-   }}
+   className={cn(
+     'relative block cursor-pointer px-1 py-2 text-sm font-medium tracking-wide transition-colors duration-200 font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark rounded-md',
+     activeId === target ? 'text-gold-soft' : 'text-offwhite',
+   )}
  >
```

### `frontend/src/pages/AvatarPlayground/index.tsx` (السطر 330)

```diff
- <div ref={timelineCursorRef} className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: '0%' }} />
+ <div ref={timelineCursorRef} className="absolute top-0 bottom-0 left-0 w-0.5 bg-red-500 z-10" />
```

> ⚠️ **لا تلمس** الـinline styles اللي `left` أو `width` بتاعتها ديناميك من
> percentages محسوبة (viseme timeline, progress bars, etc.). دي معايير ديناميك
> صحيحة تفضل inline.

---

## 5️⃣ الملفات الديناميكية اللي تفضل بstyle inline

طبق هذي القاعدة الذهبية:

| النوع | القرار |
|------|--------|
| قيمة ثابتة (`position: 'absolute'`, `inset: 0`) | ✅ Tailwind class |
| قيمة ديناميكية (`width: ${pct}%`, CSS variable من JS) | ⚠️ سيبها inline |
| قيمة معتمدة على state في run-time | ⚠️ سيبها inline |

الأمثلة اللي تفضل زي ما هي:

- `ExplainSession.tsx` → `transform: scaleX(${progress})` — progress ديناميك.
- `DocumentsPanel.tsx` → `width: ${doc.progress_pct}%` — ديناميك.
- `SuccessAnimation.tsx` → `--tx / --ty` CSS vars — ديناميك.
- `VoiceTab.tsx` → equalizer heights من array — ديناميك.
- `SessionHoverPreview.tsx` → position from bounding rect — ديناميك.
- `SlideDrawer.tsx` → `zIndex` + `width` من props — ديناميك.
- `AvatarPlayground.tsx` → viseme timeline `left/width` % — ديناميك.
- `ClassroomShell.tsx` → `marginRight` sidebar dynamic — ديناميك.
- `LaunchOverlay.tsx` → glow opacity + filter — ديناميك.

---

## 6️⃣ تنظيف التعليقات

نفذ الـgrep sweeps دي علشان تشوف قايمة المرشحين للحذف يدوياً:

```bash
# 1) التعليقات اللي بتقول "ماذا" بدل "لماذا" (dead-weight)
grep -rnE "^\s*//\s*(component|function|import|export|render|constructor)?\s*$" frontend/src

# 2) الكود المعلق (سطور تبدأ بـ // متبوعة بـcode)
grep -rn "^\s*//" frontend/src --include="*.tsx" --include="*.ts" \
  | grep -vE "//\s*(TODO|FIXME|@ts-|eslint-|prettier-|https?://)"
```

سيب التعليقات دي:
- التعليقات اللي بتشرح **الـwhy** (سبب workaround أو defensive code)
- JSDoc على الـpublic API
- سطور `// eslint-disable-next-line …`
- روابط اشتقاق (`// see https://…`)

امسح كل الباقي.

---

## 7️⃣ الـsanity check قبل الـmerge

```bash
pnpm tsc --noEmit
pnpm lint
pnpm build
pnpm test -- --run
```

بعد ما كله يعدي:

```bash
git add -A
git commit -m "refactor(structure): reorganize shared/components + move misplaced hooks
- ExplainSession.css & Classroom.css removed
- static inline styles → Tailwind classes
- services/ moved into core/realtime + features/documents/services
- shared/components split into feedback | indicators | layout | controls | chat
- features/avatar hooks moved out of components/
- features/documents root files distributed into api/hooks/types"
```

---

## 8️⃣ خلاصة الأربعة "لماذا"

**ليه التقسيمة الجديدة أحسن؟**
1. **Discoverability** — لما فيه 11 ملف في نفس المجلد، مش قادر تلاقي حاجة. لما يبقى `feedback/`, `indicators/`, `layout/`, `controls/`, `chat/`، أي مطور جديد يمسك مسار الملف اللي محتاجه في ثانيتين.
2. **Colocation** — hooks تحت `hooks/`, api تحت `api/`, types تحت `types/`. ده معناه كل feature بقت self-descriptive وممكن تتنقل لمشروع تاني كوحدة.
3. **Layered Boundaries** — `core/` (framework infra) < `features/` (domain) < `widgets/` (composition) < `pages/` (routes). القاعدة: طبقة أعلى بس تعرف عن طبقة أقل. مفيش circular deps.
4. **Zero-CSS Overhead** — من 4 CSS files (globals + theme + Classroom + ExplainSession = 221 KB) لـ 3 (globals + theme + katex third-party). المتوقع ~40% cut من الـCSS bundle.

Happy shipping 🚀
