import { lazy, Suspense, useEffect } from 'react';
import Lenis from 'lenis';
import { selectIsAuthenticated, useAuthStore } from '@/features/auth/store/authStore';
import HeroSection from '@/widgets/Overview/HeroSection';
import ErrorBoundary from '@/shared/components/ErrorBoundary';
import OverviewSEO from './OverviewSEO';
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';
import useDevicePerformance from '../hooks/useDevicePerformance';
import useSplashSession from '../hooks/useSplashSession';
import useProgressivePhases from '../hooks/useProgressivePhases';

const Navbar = lazy(() => import('@/widgets/Overview/Navbar'));
const SplashScreen = lazy(() => import('@/widgets/Overview/SplashScreen'));
const CircuitBoardBackground = lazy(() => import('@/widgets/Overview/CircuitBoardBackground'));
const FeaturesSection = lazy(() => import('@/widgets/Overview/FeaturesSection'));
const HowItWorksSection = lazy(() => import('@/widgets/Overview/HowItWorks'));
const TechStackSection = lazy(() => import('@/widgets/Overview/TechStackSection'));
const DemoPreview = lazy(() => import('@/widgets/Overview/DemoPreview'));
const FAQSection = lazy(() => import('@/widgets/Overview/FAQSection'));
const Footer = lazy(() => import('@/widgets/Overview/Footer'));

interface DeferredProps {
  shouldRender: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

function DeferredSection({ shouldRender, fallback = null, children }: DeferredProps) {
  if (!shouldRender) return null;
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function OverviewPage() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const prefersReducedMotion = useReducedMotionPreference();
  const { isLowPerformance } = useDevicePerformance();
  const { phase2, isAmbientReady } = useProgressivePhases(prefersReducedMotion, isLowPerformance);
  const { showSplash, handleSplashComplete } = useSplashSession({
    isNavbarReady: phase2.navbar,
    prefersReducedMotion,
  });

  useEffect(() => {
    // Reset scroll position on the TRUE scrollport (the motion.div in AppLayout)
    const scrollRoot = document.getElementById('main-scroll-container');
    if (scrollRoot) scrollRoot.scrollTop = 0;

    if (prefersReducedMotion) return;

    // Lenis wrapper = the constrained scrollport (overflow-y: auto, fixed height)
    // Lenis content = the growing inner content div (drives scroll range)
    const wrapper = document.getElementById('main-scroll-container');
    const content = document.getElementById('overview-content');
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      autoResize: true,
    });
    (window as any).lenis = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      (window as any).lenis = undefined;
    };
  }, [prefersReducedMotion]);

  const primaryCta = isAuthenticated
    ? { label: 'Go to Classroom', to: '/classroom' }
    : { label: 'Log In / Sign Up', to: '/auth' };

  return (
    <>
      <OverviewSEO />
      {showSplash && (
        <Suspense fallback={null}>
          <SplashScreen onComplete={handleSplashComplete} />
        </Suspense>
      )}
      <div id="overview-content" className="relative min-h-screen bg-dark text-offwhite font-sans antialiased">
        <a
          href="#main-content"
          className="absolute -top-[1000px] left-4 z-[100] focus:fixed focus:top-4 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-dark focus:outline-none"
        >
          Skip to content
        </a>
        <DeferredSection shouldRender={isAmbientReady}>
          <CircuitBoardBackground />
        </DeferredSection>
        <DeferredSection shouldRender={phase2.navbar}>
          <Navbar ctaLabel={primaryCta.label} ctaTo={primaryCta.to} />
        </DeferredSection>
        <main id="main-content">
          <HeroSection ctaLabel={primaryCta.label} ctaTo={primaryCta.to} />
          <DeferredSection shouldRender={phase2.features}>
            <FeaturesSection />
          </DeferredSection>
          <DeferredSection shouldRender={phase2.features}>
            <HowItWorksSection />
          </DeferredSection>

          <DeferredSection shouldRender={phase2.techStack}>
            <TechStackSection />
          </DeferredSection>
          <DeferredSection shouldRender={phase2.demo}>
            <DemoPreview />
          </DeferredSection>
          <DeferredSection shouldRender={phase2.demo}>
            <FAQSection />
          </DeferredSection>
        </main>
        <DeferredSection shouldRender={phase2.footer}>
          <Footer />
        </DeferredSection>
      </div>
    </>
  );
}

