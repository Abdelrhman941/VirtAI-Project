# 📦 VirtAI Frontend Refactor — Delivery Bundle

هذا الأرشيف يحتوي على **الملفات المعدّلة فقط** حسب طلبك. اللي مالوش تعديل
مش موجود في الأرشيف — سيبه في مشروعك زي ما هو.

## 🎯 المحتويات

| القسم | إيه فيه |
|-------|---------|
| `frontend/src/…` | نسخة نهائية من الملفات اللي فيها تعديل فعلي |
| `MIGRATION.md`   | **دليل يدوي** بالخطوات اللي محتاج تعملها بنفسك (git mv, grep-replace, patches جزئية) |
| `README.md`      | الملف ده |

## 📋 اقرأ أولاً

1. **`MIGRATION.md`** ← ابدأ منه. فيه كل الأوامر بالتفصيل.
2. **الملفات في `frontend/src/`** ← انسخها فوق مشروعك.
3. **الـpatch files** (`*.patch.md`) ← الملفات دي فيها diff صغير عشان
   ما تنسخش ملفات كبيرة كاملة لتغيير سطر واحد.

## ⚠️ ما مش هيتعمل تلقائياً

الحاجات دي محتاجة إيدك أنت:
- **git mv** لكل عمليات النقل (السكريبت جاهز في MIGRATION.md §2).
- **grep-replace** بالجملة لتحديث الـimports (سكريبت في §3).
- الـinline-style patches للملفات الكبيرة (تفاصيل في §4).
- تنظيف التعليقات (grep queries في §6).

## 🧪 sanity check قبل الـcommit

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build && pnpm test -- --run
```

لو الأربعة عدّوا → آمن تعمل commit + PR.

## 🌳 شجرة الـgit

**زي ما طلبت — سيبها زي ما هي.** كل التغييرات دي تدخل تحت الـbatches الموجودة
في `REFACTOR_TODO.md`:

- Batch **12.8, 12.9** → إزالة `Classroom.css` + `ExplainSession.css`
- Batch **13.2** → تحويل الـstatic inline styles
- Batch **15.5 (جديد)** → إعادة تنظيم `shared/components/` والـmoves
- Batch **16** → verification نهائي

ما تعملش rebase ولا squash قبل الـmerge — احتفظ بالـhistory.
