import PageLoader from '@/shared/components/PageLoader';
import { Toaster } from '@/shared/components/ui/sonner';
import { Component, Suspense, ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // TODO: Send error to Sentry or another monitoring service in production
    // Sentry.captureException(error, { extra: errorInfo });
    console.error('Error caught by boundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground">Please refresh the page or try again later.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Refresh
          </button>
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
        <Toaster />
        <Suspense fallback={<PageLoader />}>
          {children || null}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
