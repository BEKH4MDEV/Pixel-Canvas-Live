import type { FigurePattern } from '@pcl/contracts';
import { cn } from '@/lib/cn';

/** Miniatura de un patrón de figura. Celdas activas en acento. */
export function FigurePreview({
  pattern,
  color = 'var(--color-brand-strong)',
  className,
  gap = 0.12,
}: {
  pattern: FigurePattern;
  color?: string;
  className?: string;
  gap?: number;
}) {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={cn('overflow-visible', className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {pattern.map((row, r) =>
        row.map((v, c) =>
          v ? (
            <rect
              key={`${r}-${c}`}
              x={c + gap / 2}
              y={r + gap / 2}
              width={1 - gap}
              height={1 - gap}
              rx={0.18}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
