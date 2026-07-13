import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/data/api';
import { AudioUnlockBanner } from './AudioUnlockBanner';
import { CanvasScreen } from './CanvasScreen';
import { CountdownOverlay } from './CountdownOverlay';
import { NotificationOverlay } from './NotificationOverlay';
import { ResultsWindow } from './ResultsWindow';
import { useCanvasController } from './useCanvasController';
import type { UrlFlags } from './types';

/**
 * `/canvas`. El stack de superposiciones se apila por prioridad (de abajo hacia arriba):
 * lienzo → pantalla base (espera/conexión/reconexión/resultados) → pausa → cuenta atrás →
 * pantalla de SSE (cargando/reconectando/fallo), que va por encima de todo.
 */
export function CanvasView({ flags }: { flags: UrlFlags }) {
  const c = useCanvasController({ flags });
  // El lienzo es publico: usa el endpoint de colores sin sesion (no el del panel).
  const { data: colors } = useQuery({ queryKey: ['public-colors'], queryFn: api.publicColors });

  const resolveColorName = useCallback(
    (hex: string) => colors?.find((x) => x.hex.toUpperCase() === hex.toUpperCase())?.name ?? hex.toUpperCase(),
    [colors],
  );

  useEffect(() => {
    if (!c.audioBlocked) return;
    const handler = (): void => c.unlockAudio();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, [c.audioBlocked, c.unlockAudio]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas ref={c.setCanvas} className="block" />
      </div>

      {c.overlayVisible && <NotificationOverlay notifications={c.notifications} resolveColorName={resolveColorName} />}

      {c.baseScreen && <CanvasScreen screen={c.baseScreen} zIndex={30} />}
      {c.results && <ResultsWindow data={c.results} adminName={c.adminName} />}
      {c.pauseActive && <CanvasScreen screen={{ kind: 'paused', message: 'Partida en pausa', spinner: false }} zIndex={45} />}
      {c.countdownNum != null && <CountdownOverlay value={c.countdownNum} />}
      {c.topScreen && <CanvasScreen screen={c.topScreen} zIndex={80} />}

      <AudioUnlockBanner show={c.audioBlocked} onUnlock={c.unlockAudio} />
    </div>
  );
}
