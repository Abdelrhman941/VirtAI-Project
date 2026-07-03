import { Toaster as SonnerPrimitive } from 'sonner';

/**
 * Canonical Sonner Toaster — mounted once in AppShell.
 * All styling tokens reference globals.css CSS variables so they adapt
 * automatically if the design-token map changes.
 */
export function Toaster() {
  return (
    <SonnerPrimitive
      theme="dark"
      richColors
      closeButton
      position="bottom-right"
      expand
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'border border-white/10 bg-card/90 backdrop-blur-xl text-card-foreground shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-white/5 text-foreground',
          success: 'border-emerald-500/30',
          error: 'border-crimson/40',
          warning: 'border-amber-500/30',
          info: 'border-sky-500/30',
        },
      }}
    />
  );
}
