import type { Color, Figure } from '@pcl/contracts';
import { SCALE_VALUES } from '@pcl/contracts';
import { patternDims } from '@/lib/figures';
import { FigurePreview } from '@/components/FigurePreview';
import { Field, NumberField } from '@/components/ui/form';
import { Select, type SelectOption } from '@/components/ui/Select';
import { cn } from '@/lib/cn';

export interface ShapeForm {
  figureId: number;
  color: string; // hex | 'random'
  scale: number;
  position: 'random' | 'specific';
  x: number;
  y: number;
}

export interface RainForm {
  color: string; // hex | 'random' | 'multicolor'
  pixelCount: number;
  durationSeconds: number;
}

// ── Validación compartida ──────────────────────────────────────────
export function validateShape(v: ShapeForm, figures: Figure[], cfg: { canvasWidth: number; canvasHeight: number }): string | null {
  const figure = figures.find((f) => f.id === v.figureId);
  if (!figure) return 'Elige una figura';
  const { cols, rows } = patternDims(figure.pattern);
  const sCols = cols * v.scale;
  const sRows = rows * v.scale;
  if (sCols > cfg.canvasWidth || sRows > cfg.canvasHeight) return `No cabe: ${sCols}×${sRows} excede ${cfg.canvasWidth}×${cfg.canvasHeight}`;
  if (v.position === 'specific') {
    if (v.x < 1 || v.y < 1 || v.x + sCols - 1 > cfg.canvasWidth || v.y + sRows - 1 > cfg.canvasHeight) return 'No cabe en la posición indicada';
  }
  return null;
}

// ── Swatches ───────────────────────────────────────────────────────
function Swatch({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return <span className={cn('h-4 w-4 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/20', className)} style={style} />;
}

function colorOptions(colors: Color[], opts: { random?: boolean; multicolor?: boolean }): SelectOption[] {
  const out: SelectOption[] = [];
  if (opts.random)
    out.push({
      value: 'random',
      label: 'Aleatorio',
      leading: <Swatch style={{ background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} />,
    });
  if (opts.multicolor)
    out.push({
      value: 'multicolor',
      label: 'Multicolor',
      leading: <Swatch style={{ background: 'linear-gradient(135deg,#f43,#fd0,#3f6,#3af)' }} />,
    });
  for (const c of colors) out.push({ value: c.hex, label: c.name, leading: <Swatch style={{ backgroundColor: c.hex }} /> });
  return out;
}

export function ColorSelect({
  value,
  onChange,
  colors,
  random,
  multicolor,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: Color[];
  random?: boolean;
  multicolor?: boolean;
  disabled?: boolean;
}) {
  return <Select value={value} onValueChange={onChange} options={colorOptions(colors, { random, multicolor })} disabled={disabled} />;
}

// ── Controles de figura ────────────────────────────────────────────
export function ShapeControls({
  value,
  onChange,
  figures,
  colors,
  config,
  disabled,
}: {
  value: ShapeForm;
  onChange: (v: ShapeForm) => void;
  figures: Figure[];
  colors: Color[];
  config: { canvasWidth: number; canvasHeight: number };
  disabled?: boolean;
}) {
  const figure = figures.find((f) => f.id === value.figureId);
  const error = validateShape(value, figures, config);
  const dims = figure ? patternDims(figure.pattern) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Field label="Figura" className="flex-1">
          <Select
            value={String(value.figureId)}
            onValueChange={(v) => onChange({ ...value, figureId: Number(v) })}
            options={figures.map((f) => ({ value: String(f.id), label: f.name }))}
            placeholder="Elige una figura"
            disabled={disabled}
          />
        </Field>
        {figure && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-input p-1">
            <FigurePreview pattern={figure.pattern} className="h-full w-full" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Color">
          <ColorSelect value={value.color} onChange={(c) => onChange({ ...value, color: c })} colors={colors} random disabled={disabled} />
        </Field>
        <Field label="Escala" error={error && error.startsWith('No cabe') ? error : null} hint={dims ? `Base ${dims.cols}×${dims.rows}` : undefined}>
          <Select
            value={String(value.scale)}
            onValueChange={(v) => onChange({ ...value, scale: Number(v) })}
            options={SCALE_VALUES.map((s) => ({ value: String(s), label: `×${s}` }))}
            disabled={disabled}
          />
        </Field>
      </div>

      <Field label="Posición">
        <div className="flex gap-2">
          {(['random', 'specific'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, position: pos })}
              className={cn(
                'h-9 flex-1 rounded-[var(--radius-sm)] border text-sm font-medium transition-colors',
                'disabled:opacity-50',
                value.position === pos
                  ? 'border-brand bg-brand-soft text-brand-strong'
                  : 'border-border-strong text-fg-muted enabled:hover:bg-white/5',
              )}
            >
              {pos === 'random' ? 'Aleatoria' : 'Específica'}
            </button>
          ))}
        </div>
      </Field>

      {value.position === 'specific' && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="X">
            <NumberField value={value.x} onChange={(x) => onChange({ ...value, x })} min={1} max={config.canvasWidth} disabled={disabled} />
          </Field>
          <Field label="Y">
            <NumberField value={value.y} onChange={(y) => onChange({ ...value, y })} min={1} max={config.canvasHeight} disabled={disabled} />
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Controles de lluvia ────────────────────────────────────────────
export function RainControls({
  value,
  onChange,
  colors,
  disabled,
}: {
  value: RainForm;
  onChange: (v: RainForm) => void;
  colors: Color[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Field label="Color">
        <ColorSelect value={value.color} onChange={(c) => onChange({ ...value, color: c })} colors={colors} random multicolor disabled={disabled} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cantidad">
          <NumberField value={value.pixelCount} onChange={(n) => onChange({ ...value, pixelCount: n })} min={1} max={500} step={10} disabled={disabled} />
        </Field>
        <Field label="Duración">
          <NumberField value={value.durationSeconds} onChange={(n) => onChange({ ...value, durationSeconds: n })} min={1} max={30} suffix="s" disabled={disabled} />
        </Field>
      </div>
    </div>
  );
}
