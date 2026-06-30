import { toast as sonnerToast } from 'sonner';

export const toast = {
  success: (title, message, duration = 4000) =>
    sonnerToast.success(title, { description: message, duration }),

  error: (title, message, duration = 5000) =>
    sonnerToast.error(title, { description: message, duration }),

  info: (title, message, duration = 4000) =>
    sonnerToast.info(title, { description: message, duration }),

  warning: (title, message, duration = 4000) =>
    sonnerToast.warning(title, { description: message, duration }),

  promise: (promise, opts) =>
    sonnerToast.promise(promise, opts),

  dismiss: (id) => sonnerToast.dismiss(id),
};
