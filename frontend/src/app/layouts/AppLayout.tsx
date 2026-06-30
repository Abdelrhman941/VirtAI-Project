import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ClassroomLeftRail } from '@/widgets/Classroom/ClassroomLeftRail';
import { motion, AnimatePresence } from 'framer-motion';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';
import PageLoader from '@/shared/components/PageLoader';

export default function AppLayout() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotionPreference();

  // App-chrome routes need a fixed viewport (no scroll) — the page manages its own layout.
  // Document-style routes (Overview, Auth) need overflow-y: auto so content can scroll.
  const isAppRoute =
    location.pathname.startsWith('/classroom') ||
    location.pathname.startsWith('/help') ||
    location.pathname.startsWith('/setup') ||
    location.pathname.startsWith('/quiz');

  const showSidebar = isAppRoute;

  return (
    <div className="flex w-full h-screen bg-dark text-white font-sans">
      {showSidebar && <ClassroomLeftRail />}
      <main className="flex-1 min-w-0 flex flex-col relative h-full bg-dark">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={location.pathname}
            id={isAppRoute ? undefined : 'main-scroll-container'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              display: isAppRoute ? 'flex' : 'block',
              flexDirection: isAppRoute ? 'column' : undefined,
              backgroundColor: '#0A0908',
              overflowY: isAppRoute ? 'hidden' : 'auto',
            }}
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


