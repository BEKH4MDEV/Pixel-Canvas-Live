import * as RadixSwitch from '@radix-ui/react-switch';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
        'bg-white/10 transition-colors duration-200 ease-[var(--ease-out-quint)]',
        'data-[state=checked]:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow',
          'transition-transform duration-200 ease-[var(--ease-out-quint)] data-[state=checked]:translate-x-[18px]',
        )}
      />
    </RadixSwitch.Root>
  );
}

/** Fila de ajuste: etiqueta + descripcion a la izquierda, switch a la derecha. */
export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  danger,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-sm)] px-3 py-2.5',
        `transition-colors ${!disabled && "hover:bg-white/[0.03]"}`,
        danger && checked && 'bg-danger-soft',
      )}
    >
      <div className="min-w-0">
        <div className="text-base font-medium text-fg">{label}</div>
        {description && <div className="text-xs text-fg-subtle">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}
