import { cn } from '@/lib/cn';
import { StatusDot } from '@/components/ui/feedback';

/** Glifo de marca: un grupo de celdas encendidas. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-6 w-6', className)} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="var(--color-brand)" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="var(--color-fg)" opacity="0.25" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="var(--color-fg)" opacity="0.25" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--color-brand)" />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
  status,
}: {
  className?: string;
  compact?: boolean;
  status?: { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; pulse?: boolean };
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-md font-semibold tracking-tight text-fg">Pixel Canvas</div>
          <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.2em] text-fg-subtle">
            Live
            {status && <StatusDot tone={status.tone} pulse={status.pulse} className="h-1.5 w-1.5" />}
          </div>
        </div>
      )}
    </div>
  );
}
