import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FiPlay, FiUploadCloud, FiVolume2, FiVolumeX, FiX } from 'react-icons/fi';
import type { AdminConfig } from '@pcl/contracts';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { useConfig, useInvalidate, useUpdateConfig } from '@/data/queries';
import { toast } from '@/stores/toast-store';
import { Slider } from '@/components/ui/Slider';
import { Spinner } from '@/components/ui/Spinner';
import { ToggleRow } from '@/components/ui/Switch';
import { Section, Panel } from '../components/Section';
import { cn } from '@/lib/cn';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function validateAudio(file: File): string | null {
  const okType = /\.(mp3|wav)$/i.test(file.name) || ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave'].includes(file.type);
  if (!okType) return 'Formato no válido (.mp3 o .wav)';
  if (file.size > 5 * 1024 * 1024) return 'El archivo supera 5 MB';
  return null;
}

function SoundSlot({
  label,
  file,
  filename,
  volume,
  uploading,
  onUpload,
  onClear,
  onVolume,
}: {
  label: string;
  file: string | null;
  filename: string | null;
  volume: number;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onVolume: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (f: File | undefined): void => {
    if (!f) return;
    const error = validateAudio(f);
    if (error) {
      toast.error(error);
      return;
    }
    onUpload(f);
  };

  const playPreview = (): void => {
    if (!file) return;
    const a = (audioRef.current ??= new Audio());
    a.src = `${API_BASE}${file}`;
    a.volume = volume / 100;
    a.currentTime = 0;
    a.play().catch(() => toast.error('No se pudo reproducir'));
  };

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3">
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-fg">{label}</div>
        {file ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="max-w-[40%] truncate font-mono text-2xs text-fg-subtle">{filename ?? 'sonido'}</span>
            <Slider value={volume} onValueChange={onVolume} className="max-w-40" />
            <span className="w-9 text-right font-mono text-2xs tabular text-fg-subtle">{volume}%</span>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handle(e.dataTransfer.files[0]);
            }}
            disabled={uploading}
            className={cn(
              'mt-1.5 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-dashed px-3 py-2 text-sm transition-colors',
              dragging ? 'border-brand bg-brand-soft text-brand-strong' : 'border-border-strong text-fg-subtle hover:bg-white/5',
            )}
          >
            {uploading ? <Spinner className="h-4 w-4" /> : <FiUploadCloud />}
            {uploading ? 'Subiendo…' : 'Arrastra o haz clic · .mp3 / .wav ≤ 5 MB'}
          </button>
        )}
      </div>
      {file && (
        <div className="flex shrink-0 gap-1">
          <button onClick={playPreview} className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-fg" aria-label="Previsualizar">
            <FiPlay />
          </button>
          <button onClick={onClear} className="grid h-8 w-8 place-items-center rounded text-fg-subtle hover:text-danger" aria-label="Eliminar">
            <FiX />
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept=".mp3,.wav,audio/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}

export function SoundsSection() {
  const { data: config, isLoading: configLoading } = useConfig();
  const update = useUpdateConfig();
  const invalidate = useInvalidate();
  const [names, setNames] = useState<Record<string, string>>({});

  const upload = useMutation({
    mutationFn: (v: { slot: string; file: File }) => api.uploadSound(v.slot, v.file),
    onSuccess: () => invalidate(queryKeys.config),
    onError: (e: Error) => toast.error(e.message),
  });
  const removeSound = useMutation({
    mutationFn: (slot: string) => api.deleteSound(slot),
    onSuccess: () => invalidate(queryKeys.config),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!config)
    return (
      <Section
        icon={FiVolume2}
        title="Sonidos"
        description="Configura todos los sonidos del lienzo en un solo lugar"
        loading={configLoading}
      >
        {null}
      </Section>
    );
  const c: AdminConfig = config;
  const doUpload = (slot: string, file: File): void => {
    setNames((n) => ({ ...n, [slot]: file.name }));
    upload.mutate({ slot, file });
  };
  const isUploading = (slot: string): boolean => upload.isPending && upload.variables?.slot === slot;

  return (
    <Section icon={FiVolume2} title="Sonidos" description="Configura todos los sonidos que reproduce el lienzo" loading={configLoading} refreshKeys={[queryKeys.config]}>
      <Panel>
        <ToggleRow
          label={
            <span className="flex items-center gap-2">
              <FiVolumeX className="text-fg-muted" /> Silencio global
            </span>
          }
          description="Silencia el audio para todos los espectadores"
          checked={c.soundMuted}
          onCheckedChange={(v) => update.mutate({ soundMuted: v })}
        />
      </Panel>

      <Panel>
        <div className="space-y-3">
          <SoundSlot label="Píxel" file={c.soundPixelFile} filename={names.pixel ?? null} volume={c.soundPixelVolume} uploading={isUploading('pixel')} onUpload={(f) => doUpload('pixel', f)} onClear={() => removeSound.mutate('pixel')} onVolume={(v) => update.mutate({ soundPixelVolume: v })} />
          <SoundSlot label="Figura" file={c.soundFigureFile} filename={names.figure ?? null} volume={c.soundFigureVolume} uploading={isUploading('figure')} onUpload={(f) => doUpload('figure', f)} onClear={() => removeSound.mutate('figure')} onVolume={(v) => update.mutate({ soundFigureVolume: v })} />
          <SoundSlot label="Lluvia" file={c.soundRainFile} filename={names.rain ?? null} volume={c.soundRainVolume} uploading={isUploading('rain')} onUpload={(f) => doUpload('rain', f)} onClear={() => removeSound.mutate('rain')} onVolume={(v) => update.mutate({ soundRainVolume: v })} />
          <SoundSlot label="Reinicio" file={c.soundResetFile} filename={names.reset ?? null} volume={c.soundResetVolume} uploading={isUploading('reset')} onUpload={(f) => doUpload('reset', f)} onClear={() => removeSound.mutate('reset')} onVolume={(v) => update.mutate({ soundResetVolume: v })} />
          <SoundSlot label="Fin de partida" file={c.soundEndFile} filename={names.end ?? null} volume={c.soundEndVolume} uploading={isUploading('end')} onUpload={(f) => doUpload('end', f)} onClear={() => removeSound.mutate('end')} onVolume={(v) => update.mutate({ soundEndVolume: v })} />
        </div>
      </Panel>
    </Section>
  );
}
