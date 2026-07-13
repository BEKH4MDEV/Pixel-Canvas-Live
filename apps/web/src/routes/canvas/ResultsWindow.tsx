import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAward } from 'react-icons/fi';
import { AnimatedDots } from '@/components/AnimatedDots';
import { LoadingBackdrop } from '@/components/LoadingBackdrop';
import type { ResultsData } from './types';
import { formatCountdownLong, truncate, withAt } from '@/lib/format';
import { cn } from '@/lib/cn';

const MEDALS = [
  { bg: 'bg-gold', text: 'text-black', glow: 'shadow-[0_0_28px_-6px_var(--color-gold)]' },
  { bg: 'bg-silver', text: 'text-black', glow: '' },
  { bg: 'bg-bronze', text: 'text-white', glow: '' },
];

type Sub = 'erase' | 'message' | 'table';

function subFor(elapsed: number): Sub {
  return elapsed < 1000 ? 'erase' : elapsed < 3000 ? 'message' : 'table';
}

function endMessage(triggeredBy: string): string {
  if (triggeredBy === 'stream_end') return 'La transmisión finalizó';
  if (!triggeredBy) return 'La partida finalizó';
  return `${triggeredBy} finalizó el juego`;
}

/**
 * Ventana de resultados. La subfase (borrado → mensaje → tabla) se deriva del instante de
 * fin del servidor, así todos los clientes ven la misma fase. La subfase con la que se ENTRA
 * (al abrir/recargar/volver) se muestra al instante; las transiciones en vivo sí se animan.
 * Tamaños generosos: la ventana se comparte en el live.
 */
export function ResultsWindow({ data, adminName }: { data: ResultsData; adminName: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - data.endedAtMs;
  const sub = subFor(elapsed);
  const mountSub = useRef<Sub>(subFor(Date.now() - data.endedAtMs));
  const tableIsTransition = mountSub.current !== 'table';
  const remaining = data.autoRestartSeconds > 0 ? data.autoRestartSeconds - Math.floor(elapsed / 1000) : null;

  return (
    <div className="absolute inset-0 z-[35] grid place-items-center overflow-hidden px-6">
      <LoadingBackdrop />
      <div className="relative z-10 grid w-full place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {sub === 'message' && (
            <motion.div
              key="message"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
                <FiAward className="h-8 w-8" />
              </div>
              <h2 className="font-display text-4xl font-semibold text-fg md:text-5xl">{endMessage(data.triggeredBy)}</h2>
              <p className="text-lg text-fg-subtle md:text-xl">
                Calculando resultados
                <AnimatedDots />
              </p>
            </motion.div>
          )}

          {sub === 'table' && (
            <motion.div
              key="table"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-xl text-center"
            >
              <div className="mb-7 flex flex-col items-center gap-2">
                <span className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.25em] text-fg-subtle">
                  <FiAward className="h-4 w-4 text-gold" /> Clasificación de la ronda
                </span>
              </div>

              {data.leaderboard.length === 0 ? (
                <p className="py-10 text-xl text-fg-muted md:text-2xl">Nadie participó en esta ronda</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {data.leaderboard.map((entry, i) => (
                    <motion.li
                      key={entry.username}
                      initial={tableIsTransition ? { opacity: 0, y: 14 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: tableIsTransition ? 0.15 + i * 0.12 : 0, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                      className={cn(
                        'flex items-center gap-4 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.04] px-5 py-4',
                        i === 0 && 'border-gold/30 bg-gold/[0.06]',
                      )}
                    >
                      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sm)] font-display text-xl font-bold', MEDALS[i]?.bg, MEDALS[i]?.text, MEDALS[i]?.glow)}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-left text-xl font-medium text-fg md:text-2xl">{withAt(truncate(entry.username, 20))}</span>
                      <span className="font-mono text-xl tabular font-semibold text-fg md:text-2xl">{entry.pixels}</span>
                    </motion.li>
                  ))}
                </ol>
              )}

              <p className="mt-8 text-lg text-fg-subtle md:text-xl">
                {remaining !== null && remaining > 0
                  ? `El juego se iniciará en ${formatCountdownLong(remaining)}`
                  : (
                    <>
                      Esperando a que {adminName} inicie el juego
                      <AnimatedDots />
                    </>
                  )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
