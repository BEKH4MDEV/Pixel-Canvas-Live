import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiDroplet, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { Color } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useColors, useInvalidate } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { normalizeHex } from '@/lib/colors';
import { ColorPicker } from '@/components/ColorPicker';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { Section, Panel } from '../components/Section';

export function ColorsSection() {
  const { data: colors, isLoading } = useColors();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Color | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Color | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteColor(id),
    onSuccess: () => {
      invalidate(queryKeys.colors);
      setToDelete(null);
      toast.success('Color eliminado');
    },
    onError: (e: Error) => toast.error(e.message)
  });
  const clearAll = useMutation({
    mutationFn: () => api.deleteAllColors(),
    onSuccess: () => {
      invalidate(queryKeys.colors);
      setConfirmClear(false);
      toast.success('Colores eliminados');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      icon={FiDroplet}
      title="Colores"
      description="Los colores que los espectadores pueden usar por su nombre al pintar"
      loading={isLoading}
      refreshKeys={[queryKeys.colors]}
    >
      <Panel
        title={`${colors?.length ?? 0} colores`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!colors?.length} onClick={() => setConfirmClear(true)}>
              <FiTrash2 /> Eliminar todo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              <FiPlus /> Añadir
            </Button>
          </div>
        }
      >
        {!colors || colors.length === 0 ? (
          <EmptyState icon={<FiDroplet />} title="Sin colores" />
        ) : (
          <ul className="grid max-h-[480px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {colors.map((color) => (
              <li key={color.id} className="group flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 hover:bg-white/[0.03]">
                <span
                  className="h-7 w-7 shrink-0 rounded-[var(--radius-sm)] ring-1 ring-inset ring-black/20"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="flex-1 text-base text-fg">{color.name}</span>
                <span className="font-mono text-xs text-fg-subtle">{color.hex}</span>
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setEditing(color)} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:text-fg" aria-label="Editar">
                    <FiEdit2 />
                  </button>
                  <button onClick={() => setToDelete(color)} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:text-danger" aria-label="Eliminar">
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && <ColorModal color={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar color?"
        description={toDelete ? `Se eliminará "${toDelete.name}"` : ''}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todos los colores?"
        description="Se borrarán todos los colores. El chat no podrá pintar por nombre de color hasta que añadas alguno"
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}

function ColorModal({ color, onClose }: { color: Color | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(color?.name ?? '');
  const [hex, setHex] = useState(color?.hex ?? '#7C6CFF');
  const normalized = normalizeHex(hex);
  const valid = /^[a-z0-9]+$/.test(name) && normalized !== null;

  const save = useMutation({
    mutationFn: () =>
      color
        ? api.updateColor(color.id, { name, hex: normalized! })
        : api.createColor({ name, hex: normalized! }),
    onSuccess: () => {
      invalidate(queryKeys.colors);
      toast.success(color ? 'Color actualizado' : 'Color creado');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={color ? 'Editar color' : 'Nuevo color'}
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
        <Field label="Nombre">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="turquesa"
          />
        </Field>
        <Field label="Color">
          <div className="flex items-center gap-2">
            <ColorPicker value={normalized ?? '#000000'} onChange={setHex} />
            <Input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="font-mono uppercase"
              placeholder="#40E0D0"
            />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
