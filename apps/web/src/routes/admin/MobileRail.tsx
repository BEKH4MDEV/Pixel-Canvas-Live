import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const SPRING = { type: 'spring' as const, stiffness: 340, damping: 36 };

/**
 * Rail lateral derecho para pantallas pequeñas (preview + consola). Cerrado queda
 * completamente fuera de pantalla salvo un tirador semicircular a media altura. Se abre o
 * cierra con un toque en el tirador, o **arrastrándolo**: el panel sigue al dedo en
 * tiempo real y al soltar se ajusta (snap) según la posición. El chevron apunta a la
 * izquierda cuando está cerrado y a la derecha cuando está abierto.
 */
export function MobileRail({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const widthRef = useRef(440);
  const panelRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(9999);
  const drag = useRef<{ startX: number; startVal: number } | null>(null);

  const setOpenAnimated = (next: boolean): void => {
    openRef.current = next;
    setOpen(next);
    animate(x, next ? 0 : widthRef.current, SPRING);
  };

  useLayoutEffect(() => {
    const measure = (): void => {
      const w = panelRef.current?.offsetWidth ?? 440;
      widthRef.current = w;
      if (!openRef.current) x.set(w); // cerrado: completamente fuera de pantalla
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [x]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenAnimated(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onPointerDown = (e: React.PointerEvent): void => {
    drag.current = { startX: e.clientX, startVal: x.get() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drag.current) return;
    const next = drag.current.startVal + (e.clientX - drag.current.startX);
    x.set(Math.max(0, Math.min(widthRef.current, next)));
  };
  const onPointerUp = (e: React.PointerEvent): void => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const moved = Math.abs(e.clientX - d.startX) > 6;
    if (!moved) setOpenAnimated(!openRef.current); // toque
    else setOpenAnimated(x.get() < widthRef.current / 2); // arrastre: snap por posición
  };

  return (
    <div className="xl:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpenAnimated(false)}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.div
        ref={panelRef}
        style={{ x }}
        className="fixed right-0 top-0 z-50 flex h-full w-[min(440px,92vw)] flex-col border-l border-border bg-canvas"
      >
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={open ? 'Cerrar panel' : 'Abrir panel'}
          className="absolute left-0 top-1/2 grid h-16 w-7 -translate-x-full -translate-y-1/2 touch-none cursor-grab place-items-center rounded-l-2xl border border-r-0 border-border bg-surface-raised text-fg-muted shadow-[var(--shadow-pop)] hover:text-fg active:cursor-grabbing"
        >
          {open ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </div>
  );
}
