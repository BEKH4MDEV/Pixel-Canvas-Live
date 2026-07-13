import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiEdit2, FiPlus, FiTerminal, FiTrash2 } from 'react-icons/fi';
import type { Command } from '@pcl/contracts';
import { ALLOWED_PREFIX_CHARS } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useCommands, useConfig, useInvalidate, useUpdateConfig } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/form';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/feedback';
import { Section, Panel } from '../components/Section';
import { cn } from '@/lib/cn';

export function CommandsSection() {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: commands, isLoading: commandsLoading } = useCommands();
  const update = useUpdateConfig();
  const invalidate = useInvalidate();
  const [prefix, setPrefix] = useState<string | null>(null);
  const [editing, setEditing] = useState<Command | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Command | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteCommand(id),
    onSuccess: () => {
      invalidate(queryKeys.commands);
      setToDelete(null);
      toast.success('Comando eliminado');
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setToDelete(null);
    },
  });
  const clearAll = useMutation({
    mutationFn: () => api.deleteAllCommands(),
    onSuccess: () => {
      invalidate(queryKeys.commands);
      setConfirmClear(false);
      toast.success('Comandos eliminados');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const effectivePrefix = prefix ?? config?.commandPrefix ?? '!';
  const prefixDirty = config && effectivePrefix !== config.commandPrefix;
  const prefixValid =
    effectivePrefix.length >= 1 &&
    effectivePrefix.length <= 3 &&
    [...effectivePrefix].every((c) => (ALLOWED_PREFIX_CHARS as readonly string[]).includes(c));

  return (
    <Section
      icon={FiTerminal}
      title="Comandos"
      description="El prefijo y las palabras que los espectadores escriben en el chat para pintar"
      loading={configLoading || commandsLoading}
      refreshKeys={[queryKeys.config, queryKeys.commands]}
    >
      <Panel
        title="Prefijo"
        description={`Permitidos: ${ALLOWED_PREFIX_CHARS.join(' ')}`}
        actions={
          <Button
            size="sm"
            disabled={!prefixDirty || !prefixValid}
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { commandPrefix: effectivePrefix },
                { onSuccess: () => { setPrefix(null); toast.success('Prefijo guardado'); } },
              )
            }
          >
            Guardar
          </Button>
        }
      >
        <Input
          className="w-24 text-center font-mono"
          value={effectivePrefix}
          maxLength={3}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </Panel>

      <Panel
        title={`${commands?.length ?? 0} ${(commands?.length ?? 0) === 1 ? 'comando' : 'comandos'}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="danger-soft" disabled={!commands?.length} onClick={() => setConfirmClear(true)}>
              <FiTrash2 /> Eliminar todo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              <FiPlus /> Añadir
            </Button>
          </div>
        }
      >
        {!commands || commands.length === 0 ? (
          <EmptyState icon={<FiTerminal />} title="Sin comandos" />
        ) : (
          <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {commands.map((cmd, i) => {
              const spacingClass =
                commands.length === 1
                  ? ""
                  : i === 0
                    ? "pb-2.5"
                    : i === commands.length - 1
                      ? "pt-2.5"
                      : "py-2.5";

              return (
                <li key={cmd.id} className={`flex items-center gap-3 ${spacingClass}`}>
                  <code className="rounded bg-white/5 px-2 py-1 font-mono text-sm text-brand-strong">
                    {config?.commandPrefix ?? "!"}
                    {cmd.name}
                  </code>
                  <span className="flex-1 text-sm text-fg-subtle">Pinta un píxel</span>
                  <button
                    onClick={() => setEditing(cmd)}
                    className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:bg-white/5 hover:text-fg"
                    aria-label="Editar"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => setToDelete(cmd)}
                    disabled={commands.length <= 1}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded text-fg-subtle hover:bg-danger-soft hover:text-danger",
                      commands.length <= 1 &&
                      "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-fg-subtle"
                    )}
                    aria-label="Eliminar"
                  >
                    <FiTrash2 />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {editing && <CommandModal command={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar comando?"
        description={toDelete ? `Se eliminará "${toDelete.name}".` : ''}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar todos los comandos?"
        description="Se borrarán todos los comandos. Sin comandos, el chat no podrá pintar hasta que añadas alguno."
        confirmLabel="Eliminar todo"
        loading={clearAll.isPending}
        onConfirm={() => clearAll.mutate()}
      />
    </Section>
  );
}

function CommandModal({ command, onClose }: { command: Command | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(command?.name ?? '');
  // Por ahora la única acción posible es pintar un píxel; el selector queda listo para crecer.
  const [action, setAction] = useState<Command['actionType']>(command?.actionType ?? 'draw_pixel');
  const valid = /^[a-z0-9]+$/.test(name);

  const save = useMutation({
    mutationFn: () =>
      command
        ? api.updateCommand(command.id, { name, actionType: action })
        : api.createCommand({ name, actionType: action }),
    onSuccess: () => {
      invalidate(queryKeys.commands);
      toast.success(command ? 'Comando actualizado' : 'Comando creado');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={command ? 'Editar comando' : 'Nuevo comando'}
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
        <Field label="Nombre" hint="Sin prefijo. Solo minúsculas y dígitos.">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="p"
          />
        </Field>
        <Field label="Acción">
          <Select
            value={action}
            onValueChange={(v) => setAction(v as Command['actionType'])}
            options={[{ value: 'draw_pixel', label: 'Pintar un píxel' }]}
          />
        </Field>
      </div>
    </Modal>
  );
}
