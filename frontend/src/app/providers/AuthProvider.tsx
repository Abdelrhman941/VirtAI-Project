import useAuthBootstrap from '@/app/bootstrap/useAuthBootstrap';
import { useAuthStore } from '@/features/auth/store/authStore';
import PageLoader from '@/shared/components/PageLoader';

export default function AuthProvider({ children }: React.PropsWithChildren) {
  useAuthBootstrap();

  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Block ALL route rendering until the auth check completes.
  // This prevents the flash: "unauthenticated → redirect to /auth → actually authenticated"
  if (isInitializing || !isInitialized || isLoading) {
    return <PageLoader />;
  }

  return children;
}
