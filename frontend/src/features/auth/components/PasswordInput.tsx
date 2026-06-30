import { useState } from 'react';
import { UseFormRegisterReturn } from 'react-hook-form';

interface PasswordInputProps {
  id: string;
  placeholder?: string;
  disabled?: boolean;
  register: UseFormRegisterReturn;
  className?: string;
}

export default function PasswordInput({
  id,
  placeholder,
  disabled,
  register,
  className
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={id.includes('confirm') ? 'new-password' : 'current-password'}
        placeholder={placeholder || '••••••••'}
        disabled={disabled}
        maxLength={128}
        {...register}
        className={`${className} pr-11 text-ellipsis overflow-hidden`}
      />
      <button
        type="button"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => !disabled && setShowPassword((v) => !v)}
        disabled={disabled}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-(--text-muted) transition-[color,transform] duration-200 hover:text-(--text-secondary) active:scale-95 focus-visible:text-(--text-primary) disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showPassword ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.373 5.157M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.243 4.243L17.657 17.657M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829a3 3 0 01-4.243-4.243"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
