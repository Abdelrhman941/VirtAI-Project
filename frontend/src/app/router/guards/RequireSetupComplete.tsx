import { useAuthStore } from '@/features/auth/store/authStore';
import PageLoader from '@/shared/components/PageLoader';
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

export default function RequireSetupComplete({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
    }))
  );
  const location = useLocation();

  if (!user) {
    return <PageLoader />;
  }

  const setupDone = !!user.setupComplete;

  if (!setupDone && !location.pathname.startsWith('/setup')) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
