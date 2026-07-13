import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiEdit2, FiLayers, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { Figure } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useFigures, useInvalidate } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { FigurePreview } from '@/components/FigurePreview';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Section, Panel } from '../components/Section';
import { FigureEditor } from '../components/FigureEditor';

export function FiguresSection() {
  const { data: figures, isLoading } = useFigures();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Figure | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Figure | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteFigure(id),
    onSuccess: () => {
      invalidate(queryKeys.figures);
      setToDelete(null);
      toast.success('Figura eliminada');
    },
    onError: (e: Error) => toast.error(e.message)
  });
  const clearAll = useMutation({
    mutationFn: () => api.deleteAllFigures(),
    onSuccess: () => {
      invalidate(queryKeys.figures);
      setConfirmClear(false);
      toast.success('Figuras eliminadas');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      icon={FiLayers}
      title="Figuras"
      description="Dibujos que los regalos pintan en el lienzo. Sus sonidos se ajustan en «Sonidos»"
      loading={isLoading}
      refreshKeys={[queryKeys.figures]}
    >
      <Panel
        title={`${figures?.length ?? 0} figuras`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!figures?.length} onClick={() => setConfirmClear(true)}>
              <FiTrash2 /> Eliminar todo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              <FiPlus /> Añadir
            </Button>
          </div>
        }
      >
        {!figures || figures.length === 0 ? (
          <EmptyState icon={<FiLayers />} title="Sin figuras" />
        ) : (
          <ul className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {figures.map((fig) => (
              <li
                key={fig.id}
                className="group relative flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-4"
              >
                <div className="grid h-20 w-20 place-items-center">
                  <FigurePreview pattern={fig.pattern} className="h-full w-full" />
                </div>
                <div className="text-center">
                  <div className="text-base font-medium text-fg">{fig.name}</div>
                  <div className="font-mono text-2xs text-fg-subtle">
                    {fig.pattern[0]?.length ?? 0}×{fig.pattern.length}
                  </div>
                </div>
                <div className="absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setEditing(fig)} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:bg-white/10 hover:text-fg" aria-label="Editar">
                    <FiEdit2 />
                  </button>
                  <button onClick={() => setToDelete(fig)} className="grid h-7 w-7 place-items-center rounded text-fg-subtle hover:bg-danger-soft hover:text-danger" aria-label="Eliminar">
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && <FigureEditor figure={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar figura?"
        description={toDelete ? `Se eliminará "${toDelete.name}"` : ''}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todas las figuras?"
        description="Se borrarán todas las figuras y sus sonidos. Los regalos que las usaban quedarán sin esa figura"
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}
