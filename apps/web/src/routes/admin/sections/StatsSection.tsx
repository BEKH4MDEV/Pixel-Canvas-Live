import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBarChart2, FiClock } from 'react-icons/fi';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useInvalidate } from '@/data/queries';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Section, Panel } from '../components/Section';
import { truncate, withAt } from '@/lib/format';
import { cn } from '@/lib/cn';

const MEDAL_BG = ['bg-gold text-black', 'bg-silver text-black', 'bg-bronze text-white'];

export function StatsSection() {
  const status = useLiveStore((s) => s.status);
  const connectionState = useLiveStore((s) => s.connectionState);
  const endedAt = useLiveStore((s) => s.endedAt);
  // La ronda actual llega en tiempo real por el SSE del panel (no hay polling).
  const round = useLiveStore((s) => s.leaderboard);
  const invalidate = useInvalidate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // El histórico es HTTP puro (sólo de esta sección).
  const stats = useQuery({ queryKey: queryKeys.stats, queryFn: api.getStats });

  const reset = useMutation({
    mutationFn: api.resetGlobalStats,
    onSuccess: () => {
      invalidate(queryKeys.stats);
      setConfirmReset(false);
      toast.success('Histórico global reiniciado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clearAll = useMutation({
    mutationFn: api.deleteAllHistorical,
    onSuccess: () => {
      invalidate(queryKeys.stats);
      setConfirmClear(false);
      toast.success('Histórico eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const live = status === 'ACTIVE' && connectionState === 'connected';
  const indicator = live
    ? { text: 'En vivo', cls: 'text-success' }
    : status !== 'INACTIVE'
      ? { text: 'En pausa', cls: 'text-warning' }
      : endedAt
        ? { text: 'Partida finalizada', cls: 'text-fg-muted' }
        : null;
  const historical = stats.data?.historical ?? [];
  const inactive = status === 'INACTIVE';

  return (
    <Section
      icon={FiBarChart2}
      title="Estadísticas"
      description="Clasificación de la ronda actual e histórico acumulado de los participantes"
      loading={stats.isLoading}
      refreshKeys={[queryKeys.stats]}
    >
      <Panel
        title="Ronda actual"
        actions={
          indicator ? (
            <span className={cn('flex items-center gap-1.5 text-2xs', indicator.cls)}>
              <FiClock className="h-3 w-3" />
              {indicator.text}
            </span>
          ) : null
        }
      >
        {round.length === 0 ? (
          <EmptyState icon={<FiBarChart2 />} title="Nadie ha participado todavía" />
        ) : (
          <ol className="space-y-1.5">
            <AnimatePresence initial={false}>
              {round.map((entry, i) => (
                <motion.li
                  key={entry.username}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-white/[0.03] px-3 py-2"
                >
                  <span className={cn('grid h-7 w-7 place-items-center rounded-[5px] font-mono text-xs font-bold', MEDAL_BG[i])}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-base text-fg">{withAt(truncate(entry.username, 20))}</span>
                  <FlashNumber value={entry.pixels} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </Panel>

      <Panel
        title="Histórico"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!historical.length || !inactive} onClick={() => setConfirmClear(true)}>
              Eliminar todo
            </Button>
            <Button size="sm" variant="secondary" disabled={!inactive} onClick={() => setConfirmReset(true)}>
              Reiniciar todo
            </Button>
          </div>
        }
      >
        {historical.length === 0 ? (
          <EmptyState icon={<FiBarChart2 />} title="Sin histórico" />
        ) : (
          <ol className="max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
            {historical.map((p, i) => (
              <li
                key={p.username}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-white/[0.03] px-3 py-2"
              >
                <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-subtle">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base text-fg">{withAt(truncate(p.username, 24))}</div>
                  <div className="font-mono text-2xs text-fg-subtle">
                    {new Date(p.lastSeenAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-base tabular font-semibold text-fg">{p.pixelsTotal.toLocaleString('es-ES')}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="¿Reiniciar el histórico global?"
        description="El total de píxeles de todos los participantes se pondrá a 0"
        confirmLabel="Reiniciar"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todo el histórico?"
        description="Se borrarán todos los participantes del histórico"
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}

function FlashNumber({ value }: { value: number }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setFlash(true);
      prev.current = value;
      const id = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(id);
    }
  }, [value]);
  return (
    <span
      className={cn(
        'rounded px-1.5 font-mono text-md tabular font-semibold transition-colors duration-500',
        flash ? 'bg-brand-soft text-brand-strong' : 'text-fg',
      )}
    >
      {value}
    </span>
  );
}
