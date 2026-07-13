import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

/*
  Intent: el operador acciona la sala de control; el boton confirma con tacto.
  Jerarquia por tono solido (accion dominante) vs suave (secundaria).
  Press 0.97, transicion solo de transform/opacity/color.
*/
const button = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-medium ' +
    'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-[var(--ease-out-quint)] ' +
    'active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-45 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-contrast hover:bg-brand-strong focus-visible:outline-brand',
        secondary:
          'bg-surface-raised text-fg border border-border-strong hover:bg-surface-overlay hover:border-white/20',
        ghost: 'text-fg-muted hover:bg-white/5 hover:text-fg',
        outline: 'border border-border-strong text-fg hover:bg-white/5',
        success: 'bg-success text-black hover:brightness-110 focus-visible:outline-success',
        danger: 'bg-danger text-white hover:brightness-110 focus-visible:outline-danger',
        info: 'bg-info text-white hover:brightness-110 focus-visible:outline-info',
        warning: 'bg-warning text-black hover:brightness-110 focus-visible:outline-warning',
        'danger-soft': 'bg-danger-soft text-danger border border-danger/25 hover:bg-danger/20',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-base',
        lg: 'h-11 px-5 text-md',
        icon: 'h-9 w-9',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});
