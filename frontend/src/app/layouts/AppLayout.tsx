import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';
import PageLoader from '@/shared/components/feedback/PageLoader';
import { ClassroomLeftRail } from '@/widgets/Classroom/components/ClassroomLeftRail';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotionPreference();

  // App-chrome routes need a fixed viewport (no scroll) — the page manages its own layout.
  // Document-style routes (Overview, Auth) need vertical scroll for long content.
  const isAppRoute =
    location.pathname.startsWith('/classroom') ||
    location.pathname.startsWith('/help') ||
    location.pathname.startsWith('/setup') ||
    location.pathname.startsWith('/quiz');

  return (
    <div className="flex w-full h-screen bg-dark text-white font-sans">
      {isAppRoute && <ClassroomLeftRail />}
      <main className="flex-1 min-w-0 flex flex-col relative h-full bg-dark">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={location.pathname}
            id={isAppRoute ? undefined : 'main-scroll-container'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
            className={
              isAppRoute
                ? 'absolute inset-0 flex flex-col overflow-hidden bg-dark'
                : 'absolute inset-0 block overflow-y-auto bg-dark'
            }
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
