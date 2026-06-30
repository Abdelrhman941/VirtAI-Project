import { selectIsAuthenticated, useAuthStore } from '@/features/auth/store/authStore';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore(
    useShallow((s) => ({
      isAuthenticated: selectIsAuthenticated(s),
    }))
  );

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
