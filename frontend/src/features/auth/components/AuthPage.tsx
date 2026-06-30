import PageLoader from '@/shared/components/PageLoader';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { selectIsAuthenticated, useAuthStore } from '../store/authStore';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const navigate = useNavigate();
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setupComplete = user?.setupComplete;

  const toggleMode = () => setMode((m) => (m === 'login' ? 'signup' : 'login'));

  useEffect(() => {
    if (isInitializing || !isAuthenticated) {
      return;
    }

    navigate(setupComplete ? '/classroom' : '/setup', { replace: true });
  }, [isAuthenticated, isInitializing, navigate, setupComplete]);

  if (isInitializing || isAuthenticated) {
    return <PageLoader />;
  }

  return (
    <>
      <Helmet>
        <title>{mode === 'login' ? 'Sign In' : 'Create Account'} — VirtAI</title>
      </Helmet>

      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-black/60 bg-blend-overlay bg-[url('/assets/images/background.webp')] bg-cover bg-center bg-no-repeat p-4 sm:p-6">
        {/* VirtAI Logo */}
        <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
          <Link
            to="/"
            className="text-2xl font-bold tracking-wide text-gold font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 rounded-md"
          >
            VirtAI
          </Link>
        </div>

        {/* Auth Card */}
        <motion.main
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative z-20 w-full max-w-[420px] rounded-2xl border border-white/10 bg-dark/90 backdrop-blur-md p-8 shadow-lg sm:p-10"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-offwhite font-display">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-offwhite/60">
              {mode === 'login'
                ? 'Enter your details to access your dashboard.'
                : 'Join VirtAI to deploy your AI teaching assistant.'}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {mode === 'login' ? (
                <LoginForm onToggleMode={toggleMode} />
              ) : (
                <SignupForm onToggleMode={toggleMode} />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
    </>
  );
}
