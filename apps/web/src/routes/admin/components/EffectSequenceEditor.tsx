import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { EffectType, Gift, GiftEffectSequence } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useColors, useConfig, useFigures, useInvalidate } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Modal } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/form';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { RainControls, ShapeControls, validateShape, type RainForm, type ShapeForm } from './effect-controls';
import { cn } from '@/lib/cn';

interface Item {
  id: number;
  type: EffectType;
  shape?: ShapeForm;
  rain?: RainForm;
}

const TYPE_OPTIONS = [
  { value: 'shape', label: 'Dibujar figura' },
  { value: 'rain', label: 'Lluvia' },
  { value: 'reset', label: 'Reiniciar' },
  { value: 'end_game', label: 'Finalizar' },
];

let seq = 0;

/**
 * Modal unificado para configurar los efectos de un regalo: arriba un selector con
 * buscador para elegir el regalo (deshabilitado al editar uno existente) y debajo la
 * secuencia de efectos. `gift` = editar uno concreto; `null` = elegir de la lista.
 */
export function EffectSequenceEditor({ gift, gifts, onClose }: { gift: Gift | null; gifts: Gift[]; onClose: () => void }) {
  const { data: figures } = useFigures();
  const { data: colors } = useColors();
  const { data: config } = useConfig();
  const invalidate = useInvalidate();

  const [selectedId, setSelectedId] = useState<number | null>(gift?.id ?? null);
  const lockGift = gift != null; // al editar, el regalo no se puede cambiar

  const existing = useQuery({
    queryKey: queryKeys.giftEffects(selectedId ?? -1),
    queryFn: () => api.getGiftEffects(selectedId!),
    enabled: selectedId != null,
  });

  const [items, setItems] = useState<Item[]>([]);
  const initedFor = useRef<number | null>(null);

  const defaultShape = (): ShapeForm => ({
    figureId: figures?.[0]?.id ?? 0,
    color: 'random',
    scale: 2,
    position: 'random',
    x: 1,
    y: 1,
  });
  const defaultRain = (): RainForm => ({ color: 'multicolor', pixelCount: 80, durationSeconds: 3 });

  // (Re)inicializa los efectos cuando cambia el regalo elegido y ya tenemos sus datos.
  useEffect(() => {
    if (selectedId == null || !figures) return;
    if (initedFor.current === selectedId) return;
    if (existing.isLoading || !existing.data) return;
    initedFor.current = selectedId;
    setItems(
      existing.data.map((e) => {
        if (e.effectType === 'shape')
          return { id: ++seq, type: 'shape', shape: { figureId: e.params.figureId, color: e.params.color, scale: e.params.scale, position: e.params.position, x: e.params.x ?? 1, y: e.params.y ?? 1 } };
        if (e.effectType === 'rain') return { id: ++seq, type: 'rain', rain: { ...e.params } };
        return { id: ++seq, type: e.effectType };
      }),
    );
  }, [selectedId, existing.data, existing.isLoading, figures]);

  const setType = (id: number, type: EffectType): void =>
    setItems((list) =>
      list.map((it) =>
        it.id === id
          ? { id, type, shape: type === 'shape' ? defaultShape() : undefined, rain: type === 'rain' ? defaultRain() : undefined }
          : it,
      ),
    );

  const move = (index: number, dir: -1 | 1): void =>
    setItems((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const cfg = config ?? { canvasWidth: 160, canvasHeight: 90 };
  const invalid = items.some((it) => it.type === 'shape' && it.shape && validateShape(it.shape, figures ?? [], cfg) !== null);

  const save = useMutation({
    mutationFn: () => {
      const sequence: GiftEffectSequence = items.map((it) => {
        if (it.type === 'shape') {
          const s = it.shape!;
          return {
            effectType: 'shape',
            params: { figureId: s.figureId, color: s.color, scale: s.scale, position: s.position, ...(s.position === 'specific' ? { x: s.x, y: s.y } : {}) },
          };
        }
        if (it.type === 'rain') return { effectType: 'rain', params: it.rain! };
        if (it.type === 'reset') return { effectType: 'reset', params: {} };
        return { effectType: 'end_game', params: {} };
      });
      return api.setGiftEffects(selectedId!, sequence);
    },
    onSuccess: () => {
      invalidate(queryKeys.gifts, queryKeys.giftEffects(selectedId!));
      toast.success('Efectos guardados');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadingEffects = selectedId != null && (existing.isLoading || !figures || !colors);

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Configurar efectos"
      description="Elige el regalo y define qué efectos lanza, en orden"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={selectedId == null || invalid} loading={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Regalo">
          <Combobox
            value={selectedId != null ? String(selectedId) : null}
            onValueChange={(v) => setSelectedId(Number(v))}
            options={gifts.map((g) => ({ value: String(g.id), label: g.name, hint: g.giftId }))}
            placeholder="Elige un regalo…"
            emptyMessage="Todos los regalos ya tienen efectos"
            disabled={lockGift}
          />
        </Field>

        {selectedId == null ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
            Elige un regalo para configurar sus efectos
          </p>
        ) : loadingEffects ? (
          <div className="grid h-40 place-items-center">
            <Spinner className="h-6 w-6 text-fg-subtle" />
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {items.length === 0 && (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-fg-subtle">
                Sin efectos todavía. Añade el primero
              </p>
            )}
            {items.map((it, index) => (
              <div key={it.id} className="rounded-[var(--radius-md)] border border-border bg-surface-raised p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] bg-brand-soft font-mono text-xs font-semibold text-brand-strong">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <Select value={it.type} onValueChange={(v) => setType(it.id, v as EffectType)} options={TYPE_OPTIONS} />
                  </div>
                  <ReorderBtn dir="up" disabled={index === 0} onClick={() => move(index, -1)} />
                  <ReorderBtn dir="down" disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                  <button
                    onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}
                    className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:bg-danger-soft hover:text-danger"
                    aria-label="Eliminar acción"
                  >
                    <FiTrash2 />
                  </button>
                </div>
                {it.type === 'shape' && it.shape && figures && colors && (
                  <ShapeControls value={it.shape} onChange={(s) => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, shape: s } : x)))} figures={figures} colors={colors} config={cfg} />
                )}
                {it.type === 'rain' && it.rain && colors && (
                  <RainControls value={it.rain} onChange={(r) => setItems((l) => l.map((x) => (x.id === it.id ? { ...x, rain: r } : x)))} colors={colors} />
                )}
                {(it.type === 'reset' || it.type === 'end_game') && <p className="text-sm text-fg-subtle">Sin parámetros.</p>}
              </div>
            ))}

            <Button variant="secondary" block onClick={() => setItems((l) => [...l, { id: ++seq, type: 'shape', shape: defaultShape() }])}>
              <FiPlus /> Añadir otro efecto
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReorderBtn({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'up' ? 'Subir' : 'Bajar'}
      className={cn(
        'grid h-8 w-8 place-items-center rounded text-fg-subtle hover:bg-white/5 hover:text-fg',
        disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-fg-subtle',
      )}
    >
      {dir === 'up' ? <FiArrowUp /> : <FiArrowDown />}
    </button>
  );
}
