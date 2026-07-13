import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiEdit2, FiGift, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { Gift } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useGifts, useInvalidate, useUpdateConfig } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Dialog';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { ToggleRow } from '@/components/ui/Switch';
import { Section, Panel } from '../components/Section';

export function GiftsCatalogSection() {
  const { data: gifts, isLoading: giftsLoading } = useGifts();
  const { data: config, isLoading: configLoading } = useConfig();
  const update = useUpdateConfig();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Gift | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Gift | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteGift(id),
    onSuccess: () => {
      invalidate(queryKeys.gifts);
      setToDelete(null);
      toast.success('Regalo eliminado');
    },
    onError: (e: Error) => toast.error(e.message)
  });
  const clearAll = useMutation({
    mutationFn: () => api.deleteAllGifts(),
    onSuccess: () => {
      invalidate(queryKeys.gifts);
      setConfirmClear(false);
      toast.success('Regalos eliminados');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      icon={FiGift}
      title="Catálogo de regalos"
      description="Los regalos que el sistema reconoce. Sus efectos se configuran en «Efectos de regalos»"
      loading={giftsLoading || configLoading}
      refreshKeys={[queryKeys.gifts, queryKeys.config]}
    >
      <Panel>
        <ToggleRow
          label="Añadir regalos nuevos automáticamente"
          description="Si llega un regalo que no está en la lista, se añade solo"
          checked={config?.autoRegisterGifts ?? false}
          onCheckedChange={(v) => update.mutate({ autoRegisterGifts: v })}
        />
      </Panel>

      <Panel
        title={`${gifts?.length ?? 0} regalos`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!gifts?.length} onClick={() => setConfirmClear(true)}>
              <FiTrash2 /> Eliminar todo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              <FiPlus /> Añadir
            </Button>
          </div>
        }
      >
        {!gifts || gifts.length === 0 ? (
          <EmptyState icon={<FiGift />} title="Sin regalos" description="Añade los regalos de tu plataforma" />
        ) : (
          <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {gifts.map((gift, i) => {
              const spacingClass =
                gifts.length === 1
                  ? ""
                  : i === 0
                    ? "pb-2.5"
                    : i === gifts.length - 1
                      ? "pt-2.5"
                      : "py-2.5";

              return (
                <li key={gift.id} className={`group flex items-center gap-3 ${spacingClass}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-fg">{gift.name}</div>
                    <div className="font-mono text-2xs text-fg-subtle">{gift.giftId}</div>
                  </div>
                  <Badge tone={gift.effectCount ? "brand" : "neutral"}>
                    {gift.effectCount ?? 0} {gift.effectCount === 1 ? "efecto" : "efectos"}
                  </Badge>
                  <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(gift)}
                      className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-fg"
                      aria-label="Editar"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => setToDelete(gift)}
                      className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-danger"
                      aria-label="Eliminar"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {editing && <GiftModal gift={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar regalo?"
        description={
          toDelete?.effectCount
            ? `Se eliminará "${toDelete.name}" y sus ${toDelete.effectCount} efectos`
            : `Se eliminará "${toDelete?.name}"`
        }
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todos los regalos?"
        description="Se borrarán todos los regalos del catálogo y sus efectos configurados"
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}

function GiftModal({ gift, onClose }: { gift: Gift | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [giftId, setGiftId] = useState(gift?.giftId ?? '');
  const [name, setName] = useState(gift?.name ?? '');
  const valid = giftId.trim().length > 0 && name.trim().length > 0;

  const save = useMutation({
    mutationFn: () =>
      gift ? api.updateGift(gift.id, { giftId, name }) : api.createGift({ giftId, name }),
    onSuccess: () => {
      invalidate(queryKeys.gifts);
      toast.success(gift ? 'Regalo actualizado' : 'Regalo creado');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={gift ? 'Editar regalo' : 'Nuevo regalo'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Gift ID" hint="Identificador único del regalo en la plataforma">
          <Input autoFocus value={giftId} onChange={(e) => setGiftId(e.target.value)} placeholder="rose" className="font-mono" />
        </Field>
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rosa" />
        </Field>
      </div>
    </Modal>
  );
}
