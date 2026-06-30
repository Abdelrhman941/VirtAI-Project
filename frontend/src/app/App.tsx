import useVisualViewport from '@/shared/hooks/useVisualViewport';
import AppShell from './layouts/AppShell';
import AppProviders from './providers/AppProviders';
import AppRoutes from './router/routes';

import './styles/app.css';

export default function App() {
  useVisualViewport();
  return (
    <AppProviders>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </AppProviders>
  );
}
