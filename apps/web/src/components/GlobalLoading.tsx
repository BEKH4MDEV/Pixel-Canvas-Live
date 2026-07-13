import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedDots } from './AnimatedDots';
import { LoadingBackdrop } from './LoadingBackdrop';
import { PixelSpinner } from './PixelSpinner';

/**
 * Pantalla de carga / espera global, compartida por lienzo y panel
 * (documento 05, §2 y 06, §2). Cubre el viewport, entra y sale con fade de 200 ms.
 */
export function GlobalLoading({
  show,
  message,
  spinner = true,
  sub,
}: {
  show: boolean;
  message?: string;
  spinner?: boolean;
  sub?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] grid place-items-center"
        >
          <LoadingBackdrop />
          <div className="relative flex flex-col items-center gap-5 px-6 text-center">
            {spinner && <PixelSpinner size="lg" />}
            {message && (
              <p className="max-w-sm text-md font-medium text-fg">
                {message.replace(/[.…]+$/, '')}
                {/[.…]$/.test(message) && <AnimatedDots />}
              </p>
            )}
            {sub && <p className="-mt-2 text-sm text-fg-subtle">{sub}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
