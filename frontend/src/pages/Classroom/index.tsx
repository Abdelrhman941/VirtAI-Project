import '@/widgets/Classroom/Classroom.css';
import { lazy, Suspense } from 'react';

const ClassroomShell = lazy(() => import('@/widgets/Classroom/ClassroomShell'));

function ShellFallback() {
  return (
    <div className="shell-fallback" role="status">
      <div className="loader">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default function Classroom() {
  return (
    <div className="classroom-page">
      <Suspense fallback={<ShellFallback />}>
        <ClassroomShell />
      </Suspense>
    </div>
  );
}
