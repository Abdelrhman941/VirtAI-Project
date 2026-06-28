import { Component, lazy, ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireAuth from './guards/RequireAuth';
import RequireSetupComplete from './guards/RequireSetupComplete';
import AppLayout from '../layouts/AppLayout';

const Overview = lazy(() => import('@/pages/Overview'));
const Classroom = lazy(() => import('@/pages/Classroom'));
const Setup = lazy(() => import('@/pages/Setup'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthPage = lazy(() => import('@/pages/Auth'));
const AuthCallbackHandler = lazy(() => import('@/pages/AuthCallback'));

const Help = lazy(() => import('@/pages/Help'));

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Failed to load section</h2>
          <p className="text-sm text-gray-400 mb-4">{this.state.error?.message || 'A loading error occurred.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<RouteErrorBoundary><AuthPage /></RouteErrorBoundary>} />
      <Route path="/auth/callback" element={<RouteErrorBoundary><AuthCallbackHandler /></RouteErrorBoundary>} />

      {/* Protected routes wrapped in AppLayout */}
      <Route element={
        <RequireAuth>
          <RequireSetupComplete>
            <AppLayout />
          </RequireSetupComplete>
        </RequireAuth>
      }>
        <Route path="/" element={
          <RouteErrorBoundary><Overview /></RouteErrorBoundary>
        } />
        <Route path="/setup" element={
          <RouteErrorBoundary><Setup /></RouteErrorBoundary>
        } />
        <Route path="/classroom/:sessionId?" element={
          <RouteErrorBoundary><Classroom /></RouteErrorBoundary>
        } />

        <Route path="/help" element={
          <RouteErrorBoundary><Help /></RouteErrorBoundary>
        } />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<RouteErrorBoundary><NotFound /></RouteErrorBoundary>} />
    </Routes>
  );
}
