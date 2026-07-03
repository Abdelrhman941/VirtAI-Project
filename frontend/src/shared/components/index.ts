/**
 * Aggregate barrel for shared components.
 *
 * Feature code SHOULD import from the specific sub-barrel (e.g.
 * `@/shared/components/feedback`) — but this file re-exports everything
 * so legacy `@/shared/components/*` deep imports keep resolving during the
 * migration window.
 */
export * from './feedback';
export * from './indicators';
export * from './layout';
export * from './controls';
export * from './chat';
export * from './ui/button';
export * from './ui/alert';
export * from './ui/alert-dialog';
export * from './ui/sheet';
export * from './ui/drawer';
export * from './ui/carousel';
export * from './ui/context-menu';
export * from './ui/sonner';
