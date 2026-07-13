import { useState } from 'react';
import { FiLink } from 'react-icons/fi';
import type { AdminConfig } from '@pcl/contracts';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useUpdateConfig } from '@/data/queries';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { Section, Panel } from '../components/Section';

function normalizeChannel(value: string): string {
  const trimmed = value.trim().replace(/^@+/, '');
  return trimmed ? `@${trimmed}` : '';
}

export function ConnectionSection() {
  const { data: config, isLoading } = useConfig();
  if (!config)
    return (
      <Section
        icon={FiLink}
        title="Conexión"
        description="El canal del directo cuyo chat y regalos controlan el lienzo"
        loading={isLoading}
      >
        {null}
      </Section>
    );
  return <ConnectionForm config={config} />;
}

function ConnectionForm({ config }: { config: AdminConfig }) {
  const status = useLiveStore((s) => s.status);
  const channelConfig = useUpdateConfig();
  const [channel, setChannel] = useState(config.liveChannel);
  const normalized = normalizeChannel(channel);
  const dirty = normalized !== config.liveChannel;
  // El canal solo puede cambiarse con la partida detenida.
  const locked = status !== 'INACTIVE';

  return (
    <Section
      icon={FiLink}
      title="Conexión"
      description="El canal del directo cuyo chat y regalos controlan el lienzo"
      refreshKeys={[queryKeys.config]}
    >
      {locked && (
        <div className="rounded-[var(--radius-md)] border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          La conexión no puede cambiarse con una partida en curso. Finaliza la partida para editarla
        </div>
      )}

      <fieldset disabled={locked} className="space-y-5">
        <Panel
          title="Canal de live"
          description="Configura la cuenta con la que quieres conectar el juego"
          actions={
            <Button
              size="sm"
              disabled={!dirty || !normalized || locked}
              loading={channelConfig.isPending}
              onClick={() => channelConfig.mutate({ liveChannel: normalized }, { onSuccess: () => toast.success('Canal guardado') })}
            >
              Guardar
            </Button>
          }
        >
          <Field
            label="Nombre del canal"
          >
            <Input
              placeholder="@canal"
              value={channel}
              onChange={(e) => {
                const value = e.target.value;
                setChannel(value === "" ? "" : value.startsWith("@") ? value : `@${value}`);
              }}
              disabled={locked}
            />
          </Field>
        </Panel>
      </fieldset>
    </Section>
  );
}
