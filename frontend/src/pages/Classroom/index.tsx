import { lazy, Suspense } from 'react';

const ClassroomShell = lazy(() => import('@/widgets/Classroom/components/ClassroomShell'));

function ShellFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center" role="status">
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
      </div>
    </div>
  );
}

export default function Classroom() {
  return (
    <div className="h-full w-full">
      <Suspense fallback={<ShellFallback />}>
        <ClassroomShell />
      </Suspense>
    </div>
  );
}
