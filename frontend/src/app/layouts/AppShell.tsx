import PageLoader from '@/shared/components/PageLoader';
import { Component, Suspense, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Toaster } from 'sonner';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // TODO: Send error to Sentry or another monitoring service in production
    // Sentry.captureException(error, { extra: errorInfo });
    console.error('Error caught by boundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback" role="alert" aria-live="assertive">
          <h2 className="display-h2">Something went wrong</h2>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Helmet>
        <title>Classroom App</title>
        <meta name="description" content="Interactive learning platform" />
      </Helmet>
      <div className="app min-w-0 w-full overflow-x-hidden relative">
        <Toaster
          richColors
          position="top-right"
          theme="dark"
          closeButton
          duration={5000}
          toastOptions={{
            style: {
              transition: 'transform 0.3s ease-out, opacity 0.3s ease-out, box-shadow 0.3s ease-out'
            },
            classNames: {
              closeButton: 'bg-white/20 hover:bg-white/40 border-white/30 text-white !opacity-100 !flex !visible !right-2 !top-2 w-6 h-6 items-center justify-center rounded-full',
            }
          }}
        />
        <Suspense fallback={<PageLoader />}>
          {children || null}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
