import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FiAlertTriangle, FiEdit2, FiPlus, FiTrash2, FiZap } from 'react-icons/fi';
import type { Figure, Gift } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useFigures, useGifts, useInvalidate } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Section, Panel } from '../components/Section';
import { EffectSequenceEditor } from '../components/EffectSequenceEditor';
import { validateShape } from '../components/effect-controls';
import { cn } from '@/lib/cn';

const EFFECT_LABEL: Record<string, string> = {
  rain: 'Lluvia',
  reset: 'Reiniciar',
  end_game: 'Finalizar',
};

export function GiftActionsSection() {
  const { data: gifts, isLoading: giftsLoading } = useGifts();
  const { data: figures, isLoading: figuresLoading } = useFigures();
  const { data: config } = useConfig();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Gift | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Gift | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const allGifts = gifts ?? [];
  const configured = allGifts.filter((g) => (g.effectCount ?? 0) > 0);
  const noEffectsGifts = allGifts.filter((g) => (g.effectCount ?? 0) === 0);
  const hasGifts = allGifts.length > 0;
  const cfg = config ?? { canvasWidth: 160, canvasHeight: 90 };

  const removeSeq = useMutation({
    mutationFn: (id: number) => api.deleteGiftEffects(id),
    onSuccess: (_d, id) => {
      invalidate(queryKeys.gifts, queryKeys.giftEffects(id));
      setToDelete(null);
      toast.success('Efectos eliminados');
    },
    onError: (e: Error) => toast.error(e.message)
  });
  const clearAll = useMutation({
    mutationFn: () => api.deleteAllGiftEffects(),
    onSuccess: () => {
      invalidate(queryKeys.gifts);
      setConfirmClear(false);
      toast.success('Efectos eliminados');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      icon={FiZap}
      title="Efectos de regalos"
      description="Decide qué efectos lanza cada regalo y en qué orden"
      loading={giftsLoading || figuresLoading}
      refreshKeys={[queryKeys.gifts, queryKeys.figures]}
    >
      {!hasGifts && (
        <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          Agrega regalos para configurar sus efectos
        </div>
      )}

      <Panel
        title={`${configured.length} ${configured.length === 1 ? 'regalo con efecto' : 'regalos con efectos'}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!configured.length} onClick={() => setConfirmClear(true)}>
              <FiTrash2 /> Eliminar todo
            </Button>
            <Button size="sm" disabled={!hasGifts} onClick={() => setEditing('new')}>
              <FiPlus /> Configurar efectos
            </Button>
          </div>
        }
      >
        {configured.length === 0 ? (
          <EmptyState icon={<FiZap />} title="Sin efectos configurados" />
        ) : (
          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {configured.map((gift, i) => (
              <GiftRow
                key={gift.id}
                gift={gift}
                figures={figures ?? []}
                config={cfg}
                onEdit={() => setEditing(gift)}
                onDelete={() => setToDelete(gift)}
                index={i}
                length={configured.length}
              />
            ))}
          </ul>
        )}
      </Panel>

      {editing && (
        <EffectSequenceEditor
          gift={editing === 'new' ? null : editing}
          gifts={editing === 'new' ? noEffectsGifts : [editing]}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Borrar los efectos?"
        description={toDelete ? `Se borrarán los efectos de "${toDelete.name}". El regalo permanece en el catálogo` : ''}
        loading={removeSeq.isPending}
        onConfirm={() => toDelete && removeSeq.mutate(toDelete.id)}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todos los efectos?"
        description="Se borrarán los efectos de todos los regalos. Los regalos permanecen en el catálogo"
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}

function GiftRow({
  gift,
  figures,
  config,
  onEdit,
  onDelete,
  index,
  length,
}: {
  gift: Gift;
  figures: Figure[];
  config: { canvasWidth: number; canvasHeight: number };
  onEdit: () => void;
  onDelete: () => void;
  index: number;
  length: number;
}) {
  const { data: effects } = useQuery({ queryKey: queryKeys.giftEffects(gift.id), queryFn: () => api.getGiftEffects(gift.id) });

  // Una acción es inválida si una figura/posición ya no cabe en el área de juego actual.
  const invalidReason =
    (effects ?? [])
      .map((e) =>
        e.effectType === 'shape'
          ? validateShape(
            { figureId: e.params.figureId, color: e.params.color, scale: e.params.scale, position: e.params.position, x: e.params.x ?? 1, y: e.params.y ?? 1 },
            figures,
            config,
          )
          : null,
      )
      .find(Boolean) ?? null;

  const label = (effectType: string, figureId?: number): string => {
    if (effectType === 'shape') return figures.find((f) => f.id === figureId)?.name ?? 'Figura';
    return EFFECT_LABEL[effectType] ?? effectType;
  };

  const spacingClass =
    length === 1
      ? ""
      : index === 0
        ? "pb-2.5"
        : index === length - 1
          ? "pt-2.5"
          : "py-2.5";

  return (
    <li className={`group flex items-start gap-3 ${spacingClass}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium text-fg">{gift.name}</span>
          <span className="font-mono text-2xs text-fg-subtle">{gift.giftId}</span>
          {invalidReason && (
            <span className="inline-flex items-center text-warning" aria-label="Efecto inválido">
              <FiAlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-1.5 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
          {(effects ?? []).map((e, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-2xs text-fg-muted',
                e.effectType === 'shape' &&
                validateShape({ figureId: e.params.figureId, color: e.params.color, scale: e.params.scale, position: e.params.position, x: e.params.x ?? 1, y: e.params.y ?? 1 }, figures, config) &&
                'bg-warning-soft text-warning',
              )}
            >
              <span className="font-mono text-fg-subtle">{i + 1}</span>
              {label(e.effectType, e.effectType === 'shape' ? e.params.figureId : undefined)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-fg" aria-label="Editar efectos">
          <FiEdit2 />
        </button>
        <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-danger" aria-label="Borrar efectos">
          <FiTrash2 />
        </button>
      </div>
    </li>
  );
}
