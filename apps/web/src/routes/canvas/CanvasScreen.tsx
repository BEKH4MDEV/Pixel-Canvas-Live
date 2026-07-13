import type { IconType } from 'react-icons';
import { FiPause, FiRadio, FiWifi, FiWifiOff } from 'react-icons/fi';
import { LoadingBackdrop } from '@/components/LoadingBackdrop';
import { PixelSpinner } from '@/components/PixelSpinner';
import type { OverlayKind, ScreenSpec } from './types';
import { cn } from '@/lib/cn';

/**
 * Superposición de sólo texto del lienzo. Un ÚNICO componente para todas las pantallas
 * (cargando, conectando, reconectando, pausa, espera, error): sólo cambia icono, mensaje y
 * spinner según `kind`. Tamaños generosos porque el lienzo se comparte en el live.
 */
const ICON: Record<OverlayKind, IconType> = {
  loading: FiRadio,
  'server-reconnect': FiWifi,
  'server-failed': FiWifiOff,
  'connecting-live': FiRadio,
  'live-reconnect': FiWifi,
  'live-failed': FiWifiOff,
  paused: FiPause,
  waiting: FiRadio,
};

const TONE: Partial<Record<OverlayKind, string>> = {
  'server-failed': 'text-danger',
  'live-failed': 'text-danger',
  paused: 'text-warning',
};

export function CanvasScreen({ screen, zIndex }: { screen: ScreenSpec; zIndex: number }) {
  const Icon = ICON[screen.kind];
  const tone = TONE[screen.kind] ?? 'text-brand-strong';

  return (
    <div className="absolute inset-0 grid place-items-center px-8" style={{ zIndex }}>
      <LoadingBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {screen.spinner ? (
          <PixelSpinner size="2xl" />
        ) : (
          <div className={cn('grid h-32 w-32 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/10', tone)}>
            <Icon className="h-19 w-19" />
          </div>
        )}
        <p className="max-w-2xl text-2xl font-semibold leading-snug text-fg">
          {screen.message}
        </p>
      </div>
    </div>
  );
}
