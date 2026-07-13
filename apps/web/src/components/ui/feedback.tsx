import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// ── Badge ──────────────────────────────────────────────────────────
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium leading-none',
  {
    variants: {
      tone: {
        neutral: 'bg-white/6 text-fg-muted',
        brand: 'bg-brand-soft text-brand-strong',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  children,
}: { className?: string; children: ReactNode } & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

// ── StatusDot ──────────────────────────────────────────────────────
const dotTone: Record<string, string> = {
  neutral: 'bg-fg-subtle',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  brand: 'bg-brand',
};

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  className,
}: {
  tone?: keyof typeof dotTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-flex h-1.5 w-1.5', className)}>
      {pulse && (
        <span
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dotTone[tone])}
        />
      )}
      <span className={cn('relative inline-flex h-1.5 w-2 rounded-full', dotTone[tone])} />
    </span>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="mb-1 text-fg-subtle [&>svg]:h-6 [&>svg]:w-6">{icon}</div>}
      <p className="text-base font-medium text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-fg-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
