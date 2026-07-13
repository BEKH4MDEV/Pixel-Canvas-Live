import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { useToastStore, type ToastType } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const config: Record<ToastType, { icon: typeof FiInfo; tone: string }> = {
  success: { icon: FiCheckCircle, tone: 'text-success' },
  error: { icon: FiAlertCircle, tone: 'text-danger' },
  info: { icon: FiInfo, tone: 'text-info' },
};

/** Renderiza el toast unico del panel. Auto-cierre a los 4 s, cierre manual. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border border-border-strong',
              'bg-surface-overlay px-4 py-3 shadow-[var(--shadow-modal)]',
            )}
          >
            {(() => {
              const Icon = config[toast.type].icon;
              return <Icon className={cn('h-5 w-5 shrink-0', config[toast.type].tone)} />;
            })()}
            <p className="text-base text-fg">{toast.message}</p>
            <button
              onClick={dismiss}
              aria-label="Cerrar"
              className="ml-2 grid h-6 w-6 place-items-center rounded text-fg-subtle hover:bg-white/5 hover:text-fg"
            >
              <FiX />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
