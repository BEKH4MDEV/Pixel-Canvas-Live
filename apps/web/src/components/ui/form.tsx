import { forwardRef, type ReactNode } from 'react';
import { FiMinus, FiPlus } from 'react-icons/fi';
import { cn } from '@/lib/cn';

const controlBase =
  'w-full rounded-[var(--radius-sm)] bg-input text-fg placeholder:text-fg-faint ' +
  'border border-border-strong transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand/30 ' +
  'disabled:opacity-50';

// ── Field wrapper ──────────────────────────────────────────────────
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-fg-subtle">{hint}</p>
      )}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlBase, 'h-9 px-3 text-base', className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, 'min-h-20 px-3 py-2 text-base', className)} {...props} />;
  },
);

// ── NumberField (con steppers) ─────────────────────────────────────
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  suffix,
  className,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  className?: string;
  id?: string;
}) {
  const clamp = (n: number): number => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };
  const set = (n: number): void => {
    if (Number.isNaN(n)) return;
    onChange(clamp(n));
  };

  return (
    <div
      className={cn(
        'flex h-9 items-center rounded-[var(--radius-sm)] border border-border-strong bg-input',
        'focus-within:border-border-focus focus-within:ring-2 focus-within:ring-brand/30',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Disminuir"
        disabled={disabled || (min !== undefined && value <= min)}
        onClick={() => set(value - step)}
        className="grid h-full w-9 place-items-center text-fg-subtle hover:text-fg disabled:opacity-30 disabled:hover:text-fg-subtle"
      >
        <FiMinus />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value + (suffix ? suffix : '')}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d-]/g, ''));
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={(e) => set(Number(e.target.value))}
        className="h-full w-full min-w-0 border-x border-border bg-transparent text-center font-mono text-base text-fg tabular focus:outline-none"
      />
      
      <div className="relative flex h-full items-center">
        <button
          type="button"
          aria-label="Aumentar"
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => set(value + step)}
          className="grid h-full w-9 place-items-center text-fg-subtle hover:text-fg disabled:opacity-30 disabled:hover:text-fg-subtle"
        >
          <FiPlus />
        </button>
      </div>
    </div>
  );
}
