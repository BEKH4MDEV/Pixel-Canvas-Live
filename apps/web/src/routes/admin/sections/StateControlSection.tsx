import { useState } from 'react';
import type { IconType } from 'react-icons';
import { useMutation } from '@tanstack/react-query';
import { FiActivity, FiPause, FiPlay, FiPower, FiRadio, FiSquare, FiWifi, FiWifiOff } from 'react-icons/fi';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useUpdateConfig } from '@/data/queries';
import { useLiveStore } from '@/stores/live-store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { ToggleRow } from '@/components/ui/Switch';
import { Section, Panel } from '../components/Section';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

export function StateControlSection() {
  const status = useLiveStore((s) => s.status);
  const connectionState = useLiveStore((s) => s.connectionState);
  const starting = useLiveStore((s) => s.starting);
  // El canal NO viene por el SSE: se carga por HTTP (config). El botón de refrescar recarga el canal.
  const { data: config, isLoading: configLoading } = useConfig();
  const channel = config?.liveChannel ?? '';
  const updateConfig = useUpdateConfig();

  const [confirmEnd, setConfirmEnd] = useState(false);

  const start = useMutation({ mutationFn: api.startGame, onError: (e: Error) => toast.error(e.message) });
  const end = useMutation({ mutationFn: api.endGame, onSettled: () => setConfirmEnd(false), onError: (e: Error) => toast.error(e.message) });
  const pause = useMutation({ mutationFn: api.pauseGame, onError: (e: Error) => toast.error(e.message) });
  const resume = useMutation({ mutationFn: api.resumeGame, onError: (e: Error) => toast.error(e.message) });
  const reconnect = useMutation({ mutationFn: api.reconnect, onError: (e: Error) => toast.error(e.message) });

  const live = status === 'ACTIVE' && connectionState === 'connected';
  const reconnecting = connectionState === 'reconnecting';
  const failed = connectionState === 'failed';

  const heroLabel = status === 'INACTIVE' ? 'Partida inactiva' : live ? 'En directo' : 'En pausa';
  const heroCls = status === 'INACTIVE' ? 'text-fg-muted' : live ? 'text-success' : 'text-warning';
  const heroRing = status === 'INACTIVE' ? 'bg-white/5 text-fg-subtle' : live ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning';
  const HeroIcon: IconType = status === 'INACTIVE' ? FiPower : live ? FiRadio : FiPause;

  let ConnIcon: IconType = FiWifiOff;
  let connText = 'Desconectado';
  if (!channel) connText = 'Sin canal configurado';
  else if (connectionState === 'connecting') {
    ConnIcon = FiWifi;
    connText = `Conectando a ${channel}…`;
  } else if (connectionState === 'connected') {
    ConnIcon = FiWifi;
    connText = `Conectado a ${channel}`;
  } else if (reconnecting) connText = `Reconectando a ${channel}`;
  else if (failed) connText = `No se pudo conectar a ${channel}`;
  else connText = 'Desactivado';

  return (
    <Section icon={FiActivity} title="Estado y control" description="El centro de mando de la partida" loading={configLoading} refreshKeys={[queryKeys.config]}>
      {/* Hero: el estado es el punto focal */}
      <Panel>
        <div className="flex items-center gap-4">
          <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full', heroRing)}>
            {reconnecting ? <Spinner className="h-5 w-5" /> : <HeroIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className={cn('font-display text-xl font-semibold', heroCls)}>{heroLabel}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-subtle">
              <ConnIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{connText}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Controles de partida */}
      <Panel title="Controles de partida">
        <div className="flex flex-wrap items-center gap-2">
          {status === 'INACTIVE' && (
            <Button variant="success" size="lg" loading={start.isPending || starting} disabled={starting} onClick={() => start.mutate()}>
              <FiPlay /> Iniciar partida
            </Button>
          )}
          {status === 'PAUSED' && (
            <Button variant="success" loading={resume.isPending} onClick={() => resume.mutate()}>
              <FiPlay /> Reanudar partida
            </Button>
          )}
          {status !== 'INACTIVE' && failed && (
            <Button variant="warning" loading={reconnect.isPending} onClick={() => reconnect.mutate()}>
              <FiWifi /> Reconectar
            </Button>
          )}
          {status === 'ACTIVE' && connectionState === 'connected' && (
            <Button variant="secondary" loading={pause.isPending} onClick={() => pause.mutate()}>
              <FiPause /> Pausar partida
            </Button>
          )}
          {status !== 'INACTIVE' && (
            <Button variant="danger" className="ml-auto" onClick={() => setConfirmEnd(true)}>
              <FiSquare /> Finalizar partida
            </Button>
          )}
          {status === 'INACTIVE' && (
            <>
              {
                start.isPending || starting ? (
                  <span className="ml-auto text-sm text-fg-subtle">Iniciando partida…</span>
                ) : (
                  <span className="ml-auto text-sm text-fg-subtle">Pulsa iniciar para arrancar la partida</span>
                )
              }
            </>
          )
          }
        </div>
      </Panel>

      <Panel>
        <ToggleRow
          label="Activar simulación"
          description="Inyecta espectadores y regalos simulados junto al live real"
          checked={config?.platformSimulation ?? false}
          onCheckedChange={(v) => updateConfig.mutate({ platformSimulation: v })}
          disabled={configLoading}
        />
      </Panel>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="¿Finalizar la partida?"
        description="Se calculará la clasificación, se limpiará el lienzo y la partida pasará a inactiva"
        confirmLabel="Finalizar"
        loading={end.isPending}
        onConfirm={() => end.mutate()}
      />
    </Section>
  );
}
