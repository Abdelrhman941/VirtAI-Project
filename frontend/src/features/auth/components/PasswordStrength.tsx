import { cn } from '@/shared/utils/cn';

const rules = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
  { label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const strengthConfig = [
  { label: 'Very weak', color: 'bg-red-500' },
  { label: 'Weak', color: 'bg-orange-500' },
  { label: 'Fair', color: 'bg-yellow-500' },
  { label: 'Good', color: 'bg-lime-500' },
  { label: 'Strong', color: 'bg-green-500' },
];

interface PasswordStrengthProps {
  password?: string;
}

export default function PasswordStrength({ password = '' }: PasswordStrengthProps) {
  const safePassword = password ?? '';
  const passed = rules.filter((r) => r.test(safePassword)).length;

  if (!safePassword) {
    return null;
  }

  const config = strengthConfig[passed - 1] ?? strengthConfig[0];

  return (
    <div className="mt-1.5 space-y-1">
      {/* Strength bar */}
      <div className="flex gap-1">
        {strengthConfig.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              i < passed ? config.color : 'bg-white/10'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-(--text-secondary)">
        Strength: <span className="font-medium text-(--text-primary)">{config.label}</span>
      </p>
    </div>
  );
}
