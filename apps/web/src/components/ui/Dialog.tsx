import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import { Button } from './Button';

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  closable = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
  closable?: boolean;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[var(--animate-fade-in)]" />
        <RadixDialog.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (!closable) {
              e.preventDefault();
              return;
            }
            // Si hay un desplegable (Select/Combobox) abierto, la interacción es para
            // cerrarlo a ÉL (vive portalizado fuera del diálogo), no al modal: lo mantenemos
            // abierto. El desplegable se cierra solo.
            const target = e.detail.originalEvent.target as HTMLElement | null;
            if (target?.closest('[data-radix-popper-content-wrapper]') || document.querySelector('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => !closable && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            sizes[size],
            'rounded-[var(--radius-lg)] border border-border-strong bg-surface p-5 shadow-[var(--shadow-modal)]',
            'data-[state=open]:animate-[var(--animate-pop-in)] focus:outline-none',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-lg font-semibold text-fg">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-fg-subtle">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            {closable && (
              <RadixDialog.Close
                aria-label="Cerrar"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-fg-subtle hover:bg-white/5 hover:text-fg"
              >
                <FiX />
              </RadixDialog.Close>
            )}
          </div>
          {children}
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
