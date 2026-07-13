import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

/** Spinner de marca: una rejilla de pixeles que se ensambla en oleadas. */

type PixelSpinnerSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

const sizeStyles: Record<
  PixelSpinnerSize,
  { cell: string; gap: string }
> = {
  xs: {
    cell: 'h-1 w-1',
    gap: 'gap-0.5',
  },
  sm: {
    cell: 'h-1.5 w-1.5',
    gap: 'gap-1',
  },
  md: {
    cell: 'h-2.5 w-2.5',
    gap: 'gap-1',
  },
  lg: {
    cell: 'h-3.5 w-3.5',
    gap: 'gap-1.5',
  },
  xl: {
    cell: 'h-5 w-5',
    gap: 'gap-2',
  },
  '2xl': {
    cell: 'h-6.5 w-6.5',
    gap: 'gap-2.5',
  },
  '3xl': {
    cell: 'h-8 w-8',
    gap: 'gap-3',
  },
};

export function PixelSpinner({
  size = 'md',
  className,
}: {
  size?: PixelSpinnerSize;
  className?: string;
}) {
  const { cell, gap } = sizeStyles[size];

  return (
    <div
      className={cn('grid grid-cols-3', gap, className)}
      role="status"
      aria-label="Cargando"
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;

        return (
          <motion.span
            key={i}
            className={cn('rounded-[2px] bg-brand', cell)}
            animate={{
              opacity: [0.18, 1, 0.18],
              scale: [0.85, 1, 0.85],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: (row + col) * 0.13,
            }}
          />
        );
      })}
    </div>
  );
}