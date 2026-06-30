import { useLogin } from '@/features/auth/hooks/useAuth';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import GoogleAuthButton from './GoogleAuthButton';
import PasswordInput from './PasswordInput';

const loginSchema = z.object({
  email: z.string().min(1, 'Please enter your institutional email address').email('Please enter a valid email address (e.g., name@university.edu)'),
  password: z.string().min(1, 'Please enter your password'),
});

interface LoginFormProps {
  onToggleMode: () => void;
}

export default function LoginForm({ onToggleMode }: LoginFormProps) {
  const { login, isLoading } = useLogin();
  const inputClass =
    'w-full rounded-xl border border-(--border-color)/80 bg-black/[0.22] px-4 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 focus:scale-[1.005] focus:border-(--accent-primary) focus:bg-black/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:border-(--border-color)/55 disabled:bg-black/[0.16] disabled:opacity-60';
  const labelClass =
    'mb-1 block text-xs font-semibold text-(--text-secondary) uppercase tracking-wide';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await login(data.email, data.password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="w-full space-y-3"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Email */}
        <div>
          <label htmlFor="login-email" className={labelClass}>
            Institutional email
          </label>
          <input id="login-email" type="email" autoComplete="email" placeholder="you@institution.edu" disabled={isLoading} {...register('email')} className={inputClass} dir="auto" />
          {errors.email && <p className="mt-1.5 text-xs font-medium text-(--error) break-words">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className={labelClass}>
            Password
          </label>
          <PasswordInput
            id="login-password"
            placeholder="••••••••"
            disabled={isLoading}
            register={register('password')}
            className={inputClass}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs font-medium text-(--error) break-words">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-xl bg-(--accent-primary) px-4 py-3 text-sm font-semibold text-[#121212] shadow-md transition-colors transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:bg-(--accent-secondary) hover:shadow-lg active:scale-[0.985] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-(--accent-primary)/55 disabled:text-[#121212]/80 disabled:opacity-100 disabled:shadow-none"
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          ) : (
            'Access Classroom Workspace'
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 !mt-3">
        <div className="h-px flex-1 bg-(--border-color)/70" />
        <span className="text-xs text-(--text-muted)">or</span>
        <div className="h-px flex-1 bg-(--border-color)/70" />
      </div>

      <GoogleAuthButton />

      {/* Toggle to signup */}
      <p className="text-center text-xs text-(--text-secondary) !mt-2">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onToggleMode}
          className="font-semibold text-(--accent-primary) transition-colors hover:text-(--accent-secondary) hover:underline"
        >
          Create one
        </button>
      </p>
    </motion.div>
  );
}
