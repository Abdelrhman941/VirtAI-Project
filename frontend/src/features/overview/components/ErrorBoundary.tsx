import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in OverviewPage boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-crimson/20 bg-crimson/5 p-8 text-center backdrop-blur-sm">
          <div className="mb-4 rounded-full bg-crimson/10 p-4 text-crimson-glow">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="font-display text-2xl font-bold text-offwhite">Section Load Failure</h3>
          <p className="mt-2 max-w-md text-sm text-offwhite/60">
            There was an issue loading this section of the page. This can happen due to network disruption or temporary server issues.
          </p>
          {this.state.error && (
            <pre className="mt-4 max-w-lg overflow-x-auto rounded bg-dark/60 p-3 text-left font-mono text-xs text-crimson-soft">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="mt-6 cursor-pointer rounded-full bg-offwhite px-6 py-2 text-sm font-semibold text-dark transition-all duration-200 hover:scale-105 hover:bg-gold/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
          >
            Retry Loading Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
