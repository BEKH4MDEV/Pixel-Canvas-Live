import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiCornerUpLeft, FiCornerUpRight, FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import type { Figure, FigurePattern } from '@pcl/contracts';
import { FIGURE_MAX, FIGURE_MIN } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useInvalidate } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/form';
import { cn } from '@/lib/cn';

type Grid = number[][];

const emptyGrid = (cols: number, rows: number): Grid =>
  Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

const resizeGrid = (old: Grid, cols: number, rows: number): Grid =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => old[r]?.[c] ?? 0));

export function FigureEditor({ figure, onClose }: { figure: Figure | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(figure?.name ?? '');
  const [grid, setGrid] = useState<Grid>(figure?.pattern ?? emptyGrid(8, 8));
  const [confirmClear, setConfirmClear] = useState(false);
  const history = useRef<Grid[]>([]);
  const redo = useRef<Grid[]>([]);
  const drag = useRef<{ active: boolean; value: number }>({ active: false, value: 1 });

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const pushHistory = useCallback((snapshot: Grid) => {
    history.current.push(snapshot.map((r) => [...r]));
    if (history.current.length > 30) history.current.shift();
    redo.current = [];
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setGrid((cur) => {
      redo.current.push(cur.map((r) => [...r]));
      return prev;
    });
  }, []);

  const doRedo = useCallback(() => {
    const next = redo.current.pop();
    if (!next) return;
    setGrid((cur) => {
      history.current.push(cur.map((r) => [...r]));
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, doRedo]);

  const setCell = (r: number, c: number, value: number) => {
    setGrid((cur) => {
      if (cur[r]?.[c] === value) return cur;
      const next = cur.map((row) => [...row]);
      next[r]![c] = value;
      return next;
    });
  };

  const onCellDown = (r: number, c: number) => {
    pushHistory(grid);
    const value = grid[r]?.[c] ? 0 : 1;
    drag.current = { active: true, value };
    setCell(r, c, value);
  };
  const onCellEnter = (r: number, c: number) => {
    if (drag.current.active) setCell(r, c, drag.current.value);
  };

  useEffect(() => {
    const stop = () => (drag.current.active = false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const resize = (nextCols: number, nextRows: number) => {
    const c = Math.min(FIGURE_MAX, Math.max(FIGURE_MIN, nextCols));
    const r = Math.min(FIGURE_MAX, Math.max(FIGURE_MIN, nextRows));
    pushHistory(grid);
    setGrid((cur) => resizeGrid(cur, c, r));
  };

  const save = useMutation({
    mutationFn: () => {
      const pattern = grid as FigurePattern;
      return figure ? api.updateFigure(figure.id, { name, pattern }) : api.createFigure({ name, pattern });
    },
    onSuccess: () => {
      invalidate(queryKeys.figures);
      toast.success(figure ? 'Figura actualizada' : 'Figura creada');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasCells = grid.some((row) => row.some((v) => v === 1));

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={figure ? 'Editar figura' : 'Nueva figura'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!name.trim() || !hasCells} loading={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Estrella" />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <SizeStepper label="Columnas" value={cols} onChange={(c) => resize(c, rows)} />
            <SizeStepper label="Filas" value={rows} onChange={(r) => resize(cols, r)} />
          </div>
          <div className="flex items-center gap-1">
            <IconBtn label="Deshacer" onClick={undo} disabled={history.current.length === 0}>
              <FiCornerUpLeft />
            </IconBtn>
            <IconBtn label="Rehacer" onClick={doRedo} disabled={redo.current.length === 0}>
              <FiCornerUpRight />
            </IconBtn>
            <IconBtn label="Limpiar" onClick={() => setConfirmClear(true)} disabled={!hasCells}>
              <FiTrash2 />
            </IconBtn>
          </div>
        </div>

        <div className="grid place-items-center rounded-[var(--radius-md)] border border-border bg-input/40 p-4">
          <div
            className="grid touch-none gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: `min(100%, ${cols * 22}px)` }}
          >
            {grid.map((row, r) =>
              row.map((v, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onPointerDown={() => onCellDown(r, c)}
                  onPointerEnter={() => onCellEnter(r, c)}
                  className={cn(
                    'aspect-square rounded-[3px] transition-colors',
                    v ? 'bg-brand' : 'border border-border-strong bg-transparent hover:bg-white/5',
                  )}
                  aria-label={`Celda ${c}, ${r}`}
                />
              )),
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Limpiar el patrón?"
        description="Se desactivarán todas las celdas."
        confirmLabel="Limpiar"
        onConfirm={() => {
          pushHistory(grid);
          setGrid(emptyGrid(cols, rows));
          setConfirmClear(false);
        }}
      />
    </Modal>
  );
}

function SizeStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-subtle">{label}</span>
      <div className="flex items-center gap-1">
        <IconBtn label={`Menos ${label}`} onClick={() => onChange(value - 1)} disabled={value <= FIGURE_MIN}>
          <FiMinus />
        </IconBtn>
        <span className="w-6 text-center font-mono text-sm tabular text-fg">{value}</span>
        <IconBtn label={`Más ${label}`} onClick={() => onChange(value + 1)} disabled={value >= FIGURE_MAX}>
          <FiPlus />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-border-strong text-fg-subtle hover:bg-white/5 hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}
