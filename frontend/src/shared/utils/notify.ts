import { toast as sonnerToast } from 'sonner';

type ToastFn = (
  title: string,
  description?: string,
  duration?: number,
) => string | number;

const wrap =
  (impl: (t: string, opts?: Record<string, unknown>) => string | number): ToastFn =>
    (title, description, duration) =>
      impl(title, {
        ...(description !== undefined ? { description } : {}),
        ...(duration !== undefined ? { duration } : {}),
      });

export const notify = Object.assign(
  wrap(sonnerToast),
  {
    success: wrap(sonnerToast.success),
    error: wrap(sonnerToast.error),
    warning: wrap(sonnerToast.warning),
    info: wrap(sonnerToast.info),
    loading: (msg: string) => sonnerToast.loading(msg),
    promise: <T>(
      p: Promise<T>,
      opts: { loading: string; success: string; error: string },
    ) => sonnerToast.promise(p, opts),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  }
);

export const toast = notify;
