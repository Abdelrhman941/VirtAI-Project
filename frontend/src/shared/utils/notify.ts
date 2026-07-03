import { toast } from 'sonner';

export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  error:   (msg: string, description?: string) => toast.error(msg,   { description }),
  warning: (msg: string, description?: string) => toast.warning(msg, { description }),
  info:    (msg: string, description?: string) => toast.info(msg,    { description }),
  loading: (msg: string) => toast.loading(msg),
  promise: <T,>(p: Promise<T>, opts: { loading: string; success: string; error: string }) =>
    toast.promise(p, opts),
};
