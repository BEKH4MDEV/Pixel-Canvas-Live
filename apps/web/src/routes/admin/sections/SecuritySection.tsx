import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiLock } from 'react-icons/fi';
import type { AdminConfig } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useUpdateConfig } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { Field, Input, NumberField } from '@/components/ui/form';
import { ToggleRow } from '@/components/ui/Switch';
import { Section, Panel } from '../components/Section';

export function SecuritySection() {
  const { data: config, isLoading } = useConfig();
  if (!config)
    return (
      <Section
        icon={FiLock}
        title="Seguridad"
        description="El PIN de acceso y la duración de la sesión del panel"
        loading={isLoading}
      >
        {null}
      </Section>
    );
  return <SecurityForm config={config} />;
}

function SecurityForm({ config }: { config: AdminConfig }) {
  const update = useUpdateConfig();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [duration, setDuration] = useState(config.sessionDurationMinutes);

  const pinValid =
    /^\d{4}$/.test(current) && /^\d{4}$/.test(next) && next === confirm && next !== current;

  const changePin = useMutation({
    mutationFn: () => api.changePin({ currentPin: current, newPin: next, confirmPin: confirm }),
    onSuccess: () => {
      toast.success('PIN actualizado');
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clean = (v: string) => v.replace(/\D/g, '').slice(0, 4);

  return (
    <Section icon={FiLock} title="Seguridad" description="El PIN de acceso y la duración de la sesión del panel" refreshKeys={[queryKeys.config]}>
      <Panel>
        <ToggleRow
            label="Expirar al cerrar el navegador"
            description="La sesión termina al cerrar el navegador"
            checked={config.sessionExpireOnClose}
            onCheckedChange={(v) => update.mutate({ sessionExpireOnClose: v })}
          />
      </Panel>

      <Panel
        title="Cambiar PIN"
        description="Los cambios se aplicarán cuando termine la sesión actual"
        actions={
          <Button size="sm" disabled={!pinValid} loading={changePin.isPending} onClick={() => changePin.mutate()}>
            Cambiar
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="PIN actual">
            <Input value={current} onChange={(e) => setCurrent(clean(e.target.value))} inputMode="numeric" type="password" className="font-mono" />
          </Field>
          <Field label="Nuevo PIN">
            <Input value={next} onChange={(e) => setNext(clean(e.target.value))} inputMode="numeric" type="password" className="font-mono" />
          </Field>
          <Field
            label="Confirmar"
            error={confirm.length === 4 && confirm !== next ? 'No coincide' : null}
          >
            <Input value={confirm} onChange={(e) => setConfirm(clean(e.target.value))} inputMode="numeric" type="password" className="font-mono" />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Sesión"
        description="Configura la duración de la sesión"
        actions={
          <Button
            size="sm"
            disabled={duration === config.sessionDurationMinutes}
            loading={update.isPending}
            onClick={() => update.mutate({ sessionDurationMinutes: duration }, { onSuccess: () => toast.success('Duración guardada') })}
          >
            Guardar
          </Button>
        }
      >
        <Field label="Duración de la sesión">
          <div className="w-full xl:w-1/2">
            <NumberField value={duration} onChange={setDuration} min={5} max={10080} step={5} suffix="min" />
          </div>
        </Field>
      </Panel>
    </Section>
  );
}
