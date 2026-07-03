import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { cn } from '@/shared/utils/cn';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props { title?: string; children: ReactNode; className?: string; }

export function SuccessAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-emerald-500/20 bg-emerald-500/5 text-emerald-200 [&>svg]:text-emerald-400', className)}>
      <CheckCircle2 />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function InfoAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-sky-500/20 bg-sky-500/5 text-sky-100 [&>svg]:text-sky-300', className)}>
      <Info />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function WarningAlert({ title, children, className }: Props) {
  return (
    <Alert className={cn('border-amber-500/25 bg-amber-500/5 text-amber-100 [&>svg]:text-amber-300', className)}>
      <AlertTriangle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function DangerAlert({ title, children, className }: Props) {
  return (
    <Alert
      variant="destructive"
      className={cn('border-crimson/30 bg-crimson/10 text-crimson-glow [&>svg]:text-crimson-glow', className)}
    >
      <AlertCircle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
