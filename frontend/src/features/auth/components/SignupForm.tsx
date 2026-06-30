import { useSignup } from '@/features/auth/hooks/useAuth';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import GoogleAuthButton from './GoogleAuthButton';
import PasswordInput from './PasswordInput';
import PasswordStrength from './PasswordStrength';

const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Please enter your full name (minimum 2 characters)')
      .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
    email: z.string().min(1, 'Please enter your institutional email address').email('Please enter a valid email address (e.g., name@university.edu)'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Include at least one uppercase letter (A-Z)')
      .regex(/[a-z]/, 'Include at least one lowercase letter (a-z)')
      .regex(/[0-9]/, 'Include at least one numerical digit (0-9)')
      .regex(/[^A-Za-z0-9]/, 'Include at least one special character (e.g., !@#$%)'),
    confirmPassword: z.string().min(1, 'Please re-type your password to confirm'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The passwords you entered do not match. Please verify and try again.',
    path: ['confirmPassword'],
  });

interface SignupFormProps {
  onToggleMode: () => void;
}

export default function SignupForm({ onToggleMode }: SignupFormProps) {
  const { signup, isLoading } = useSignup();
  const inputClass =
    'w-full rounded-xl border border-(--border-color)/80 bg-black/[0.22] px-4 py-2.5 text-sm text-(--text-primary) placeholder-(--text-muted) shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] outline-none transition-[border-color,box-shadow,background-color,transform] duration-200 focus:scale-[1.005] focus:border-(--accent-primary) focus:bg-black/30 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.1)] disabled:cursor-not-allowed disabled:border-(--border-color)/55 disabled:bg-black/[0.16] disabled:opacity-60';
  const labelClass =
    'mb-1 block text-xs font-semibold text-(--text-secondary) uppercase tracking-wide';

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const passwordValue = useWatch({ control, name: 'password' });

  const onSubmit = async (data: z.infer<typeof signupSchema>) => {
    try {
      await signup({ fullName: data.fullName, email: data.email, password: data.password });
    } catch (error) {
      console.error('Signup failed:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full space-y-3"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Dr. Sarah Jenkins"
            disabled={isLoading}
            {...register('fullName')}
            className={inputClass}
            dir="auto"
          />
          {errors.fullName && (
            <p className="mt-1.5 text-xs font-medium text-(--error) break-words">{errors.fullName.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" className={labelClass}>
            Institutional email
          </label>
          <input id="signup-email" type="email" autoComplete="email" placeholder="you@institution.edu" disabled={isLoading} {...register('email')} className={inputClass} dir="auto" />
          {errors.email && <p className="mt-1.5 text-xs font-medium text-(--error) break-words">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className={labelClass}>
            Password
          </label>
          <PasswordInput
            id="signup-password"
            placeholder="••••••••"
            disabled={isLoading}
            register={register('password')}
            className={inputClass}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs font-medium text-(--error) break-words">{errors.password.message}</p>
          )}
          <PasswordStrength password={passwordValue} />
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Confirm Password
          </label>
          <PasswordInput
            id="confirmPassword"
            placeholder="••••••••"
            disabled={isLoading}
            register={register('confirmPassword')}
            className={inputClass}
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-xs font-medium text-(--error) break-words">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-(--accent-primary) px-4 py-3 text-sm font-semibold text-[#121212] shadow-md transition-colors transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:bg-(--accent-secondary) hover:shadow-lg active:scale-[0.985] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-(--accent-primary)/55 disabled:text-[#121212]/80 disabled:opacity-100 disabled:shadow-none"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              Registering Account…
            </span>
          ) : (
            'Register Academic Account'
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-(--border-color)/70" />
        <span className="text-xs text-(--text-muted)">or</span>
        <hr className="flex-1 border-(--border-color)/70" />
      </div>

      <GoogleAuthButton label="Sign up with Google" />

      {/* Toggle to Login */}
      <p className="text-center text-xs text-(--text-secondary)">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onToggleMode}
          className="font-semibold text-(--accent-primary) transition-colors hover:text-(--accent-secondary) hover:underline"
        >
          Sign in
        </button>
      </p>
    </motion.div>
  );
}
