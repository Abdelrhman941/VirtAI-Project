import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router } from 'react-router-dom';
import AuthProvider from './AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          {/* @ts-expect-error React Router types may not include future yet - this is a known temporary workaround until v7 types are fully adopted */}
          <Router future={ROUTER_FUTURE}>
            {children}
          </Router>
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}
