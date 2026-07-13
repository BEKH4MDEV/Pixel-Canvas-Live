import { AnimatePresence, motion } from 'framer-motion';
import { FiVolume2 } from 'react-icons/fi';

/** Banner inferior discreto cuando el navegador bloquea el autoplay (documento 04, §8). */
export function AudioUnlockBanner({ show, onUnlock }: { show: boolean; onUnlock: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3 }}
          onClick={onUnlock}
          className="pointer-events-auto absolute inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-sm text-white/90 backdrop-blur-md hover:bg-black/70"
        >
          <FiVolume2 className="h-4 w-4" />
          Haz clic en cualquier parte para activar el audio
        </motion.button>
      )}
    </AnimatePresence>
  );
}
