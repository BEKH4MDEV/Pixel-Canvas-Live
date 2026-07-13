import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiRefreshCw, FiRotateCcw, FiSend, FiTool } from 'react-icons/fi';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useColors, useConfig, useFigures } from '@/data/queries';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/form';
import { Section, Panel } from '../components/Section';
import { RainControls, ShapeControls, validateShape, type RainForm, type ShapeForm } from '../components/effect-controls';

export function ToolsSection() {
  const status = useLiveStore((s) => s.status);
  const connectionState = useLiveStore((s) => s.connectionState);
  const starting = useLiveStore((s) => s.starting);
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: figures, isLoading: figuresLoading } = useFigures();
  const { data: colors, isLoading: colorsLoading } = useColors();

  const [command, setCommand] = useState('');
  const [shape, setShape] = useState<ShapeForm | null>(null);
  const [rain, setRain] = useState<RainForm>({ color: 'multicolor', pixelCount: 80, durationSeconds: 3 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);

  const sendCommand = useMutation({
    mutationFn: () => api.toolCommand(command),
    onSuccess: () => setCommand(''),
    onError: (e: Error) => toast.error(e.message),
  });
  const sendShape = useMutation({ mutationFn: () => api.toolShape(shapeValue), onError: (e: Error) => toast.error(e.message) });
  const sendRain = useMutation({ mutationFn: () => api.toolRain(rain), onError: (e: Error) => toast.error(e.message) });
  const reset = useMutation({
    mutationFn: () => api.resetCanvas(),
    onSuccess: () => { setConfirmReset(false); toast.success('Lienzo reiniciado'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reload = useMutation({
    mutationFn: () => api.reloadCanvas(),
    onSuccess: () => { setConfirmReload(false); toast.success('Todos los canvas abiertos se están recargando'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Las acciones solo se permiten con la partida en directo y el lienzo totalmente visible.
  const active = status === 'ACTIVE' && connectionState === 'connected' && !starting;
  const cfg = config ?? { canvasWidth: 160, canvasHeight: 90 };
  const placeholder = `${config?.commandPrefix ?? '!'}p 10 20 rojo`;
  const shapeValue = shape ?? { figureId: figures?.[0]?.id ?? 0, color: 'random', scale: 2, position: 'random', x: 1, y: 1 };
  const shapeError = figures ? validateShape(shapeValue, figures, cfg) : null;

  return (
    <Section
      icon={FiTool}
      title="Herramientas"
      description="Envía comandos, figuras, lluvia o cualquier otra acción al lienzo"
      loading={configLoading || figuresLoading || colorsLoading}
      refreshKeys={[queryKeys.config, queryKeys.figures, queryKeys.colors]}
    >
      {!active && (
        <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          Algunas acciónes solo están disponibles con la partida activa y el lienzo visible
        </div>
      )}

      <Panel
        title="Enviar comando"
        actions={
          <Button size="sm" disabled={!active || !command.trim()} loading={sendCommand.isPending} onClick={() => sendCommand.mutate()}>
            <FiSend /> Enviar
          </Button>
        }
      >
        <Field label="Comando">
          <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder={placeholder} className="font-mono" disabled={!active} />
        </Field>
      </Panel>

      <Panel
        title="Lanzar figura"
        actions={
          <Button size="sm" disabled={!active || !!shapeError} loading={sendShape.isPending} onClick={() => sendShape.mutate()}>
            Lanzar
          </Button>
        }
      >
        <fieldset disabled={!active} className="space-y-4">
          {figures && colors && <ShapeControls value={shapeValue} onChange={setShape} figures={figures} colors={colors} config={cfg} disabled={!active} />}
        </fieldset>
      </Panel>

      <Panel
        title="Lanzar lluvia"
        actions={
          <Button size="sm" disabled={!active} loading={sendRain.isPending} onClick={() => sendRain.mutate()}>
            Lanzar lluvia
          </Button>
        }
      >
        <fieldset disabled={!active} className="space-y-4">
          {colors && <RainControls value={rain} onChange={setRain} colors={colors} disabled={!active} />}
        </fieldset>
      </Panel>

      <Panel
        title="Reiniciar el lienzo"
        description="Borra todos los píxeles del lienzo. La partida sigue en curso"
        actions={
          <Button size="sm" disabled={!active} onClick={() => setConfirmReset(true)}>
            <FiRotateCcw /> Reiniciar
          </Button>
        }
      />

      <Panel
        title="Recargar los canvas"
        description="Recarga todos los canvas abiertos"
        actions={
          <Button size="sm" variant="warning" onClick={() => setConfirmReload(true)}>
            <FiRefreshCw /> Recargar
          </Button>
        }
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="¿Reiniciar el lienzo?"
        description="Se borrarán todos los píxeles. La partida sigue activa y las estadísticas no cambian"
        confirmLabel="Reiniciar"
        tone="primary"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
      <ConfirmDialog
        open={confirmReload}
        onOpenChange={setConfirmReload}
        title="¿Recargar todos los canvas?"
        description="Todas los canvas abiertos se recargarán"
        confirmLabel="Recargar"
        tone="primary"
        loading={reload.isPending}
        onConfirm={() => reload.mutate()}
      />
    </Section>
  );
}
