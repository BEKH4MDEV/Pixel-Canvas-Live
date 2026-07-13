import { useEffect, useRef, useState } from 'react';
import { FiGrid } from 'react-icons/fi';
import type { AdminConfig } from '@pcl/contracts';
import { CANVAS_MIN, PIXEL_SIZE_MAX, PIXEL_SIZE_MIN } from '@pcl/contracts';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useUpdateConfig } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Button } from '@/components/ui/Button';
import { Field, Input, NumberField } from '@/components/ui/form';
import { Slider } from '@/components/ui/Slider';
import { ToggleRow } from '@/components/ui/Switch';
import { Section, Panel } from '../components/Section';

export function CanvasSection() {
  const { data: config, isLoading } = useConfig();
  if (!config)
    return (
      <Section
        icon={FiGrid}
        title="Lienzo"
        description="Configura el lienzo y otros apartados del juego"
        loading={isLoading}
      >
        {null}
      </Section>
    );
  return <CanvasForm config={config} />;
}

function CanvasForm({ config }: { config: AdminConfig }) {
  // Una mutacion por grupo: el spinner aparece solo en el boton correspondiente.
  const area = useUpdateConfig();
  const rules = useUpdateConfig();
  const name = useUpdateConfig();
  const toggles = useUpdateConfig();
  const pixel = useUpdateConfig();

  const [width, setWidth] = useState(config.canvasWidth);
  const [height, setHeight] = useState(config.canvasHeight);
  const [pixelSize, setPixelSize] = useState(config.pixelSize);
  const [cooldown, setCooldown] = useState(config.cooldownSeconds);
  const [autoRestart, setAutoRestart] = useState(config.autoRestartSeconds);
  const [duration, setDuration] = useState(config.gameDurationMinutes);
  const [adminName, setAdminName] = useState(config.adminName);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (pixelSize === config.pixelSize) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => pixel.mutate({ pixelSize }), 800);
    return () => clearTimeout(debounce.current);
  }, [pixelSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const areaDirty = width !== config.canvasWidth || height !== config.canvasHeight;
  const rulesDirty =
    cooldown !== config.cooldownSeconds || autoRestart !== config.autoRestartSeconds || duration !== config.gameDurationMinutes;
  const nameDirty = adminName.trim() !== config.adminName && adminName.trim().length > 0;

  return (
    <Section icon={FiGrid} title="Lienzo" description="Configura el lienzo y otros apartados del juego" refreshKeys={[queryKeys.config]}>
      <Panel
        title="Área de juego"
        description="Abre el lienzo en otra pestaña y coloca aquí cuantas filas y columnas tiene"
        actions={
          <Button
            size="sm"
            disabled={!areaDirty}
            loading={area.isPending}
            onClick={() =>
              area.mutate({ canvasWidth: width, canvasHeight: height }, { onSuccess: () => toast.success('Área de juego actualizada') })
            }
          >
            Guardar
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ancho (columnas)">
            <NumberField value={width} onChange={setWidth} min={CANVAS_MIN} max={1000} />
          </Field>
          <Field label="Alto (filas)">
            <NumberField value={height} onChange={setHeight} min={CANVAS_MIN} max={1000} />
          </Field>
        </div>
      </Panel>

      <Panel title="Render" description="Personaliza la apariencia del lienzo">
        <Field label="Tamaño de los píxeles del lienzo">
          <div className="flex items-center gap-4">
            <Slider value={pixelSize} onValueChange={setPixelSize} min={PIXEL_SIZE_MIN} max={PIXEL_SIZE_MAX} />
            <span className="w-12 shrink-0 text-right font-mono text-base tabular text-fg">{pixelSize}px</span>
          </div>
        </Field>
        <div className="mt-2 divide-y divide-border">
          <ToggleRow label="Mostrar cuadrícula" checked={config.showGrid} onCheckedChange={(v) => toggles.mutate({ showGrid: v })} />
          <ToggleRow label="Mostrar coordenadas" checked={config.showCoords} onCheckedChange={(v) => toggles.mutate({ showCoords: v })} />
          <ToggleRow
            label="Mostrar notificaciones"
            checked={config.overlayVisible}
            onCheckedChange={(v) => toggles.mutate({ overlayVisible: v })}
          />
        </div>
      </Panel>

      <Panel
        title="Reglas del juego"
        description="Algunos cambios se aplicarán al iniciar una nueva partida. Establece 0 para desactivarlos"
        actions={
          <Button
            size="sm"
            disabled={!rulesDirty}
            loading={rules.isPending}
            onClick={() => rules.mutate({ cooldownSeconds: cooldown, autoRestartSeconds: autoRestart, gameDurationMinutes: duration })}
          >
            Guardar
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Auto reinicio">
            <NumberField
              value={autoRestart}
              onChange={setAutoRestart}
              min={0}
              max={3600}
              suffix="s"
            />
          </Field>

          <Field label="Duración de la partida">
            <NumberField
              value={duration}
              onChange={setDuration}
              min={0}
              max={600}
              suffix="min"
            />
          </Field>

          <Field label="Cooldown" className="sm:col-span-2 xl:col-span-1">
            <NumberField
              value={cooldown}
              onChange={setCooldown}
              min={0}
              max={600}
              suffix="s"
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Identidad"
        description="Aparece en notificaciones y eventos manuales"
        actions={
          <Button size="sm" disabled={!nameDirty} loading={name.isPending} onClick={() => name.mutate({ adminName: adminName.trim() })}>
            Guardar
          </Button>
        }
      >
        <Field label="Nombre del creador">
          <Input value={adminName} maxLength={30} onChange={(e) => setAdminName(e.target.value)} />
        </Field>
      </Panel>
    </Section>
  );
}
