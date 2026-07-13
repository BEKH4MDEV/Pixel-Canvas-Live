import { AnimatePresence, motion } from 'framer-motion';
import { LoadingBackdrop } from '@/components/LoadingBackdrop';

/** Cuenta atras 3-2-1 a pantalla completa sobre el lienzo. El 0 no se muestra. */
export function CountdownOverlay({ value }: { value: number }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center">
      <LoadingBackdrop />
      <AnimatePresence mode="popLayout">
        <motion.div
          key={value}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10 font-display font-bold leading-none text-fg"
          style={{ fontSize: 'clamp(7rem, 24vw, 18rem)' }}
        >
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand/20 blur-2xl"
            aria-hidden
          />
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
