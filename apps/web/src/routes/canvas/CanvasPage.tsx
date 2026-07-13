import { useSearchParams } from 'react-router-dom';
import { CanvasView } from './CanvasView';
import type { UrlFlags } from './types';

/**
 * `/canvas` — pantalla publica que el creador captura. 100 % del viewport, sin
 * controles ni scroll. Los parametros de URL (documento 05, §8) tienen prioridad
 * local sobre la configuracion del servidor.
 */
export function CanvasPage() {
  const [params] = useSearchParams();
  const flags: UrlFlags = {
    overlay: params.get('overlay') !== 'false',
    grid: params.get('grid') !== 'false',
    coords: params.get('coords') !== 'false',
    sound: params.get('sound') !== 'false',
  };

  return (
    <div className="fixed inset-0">
      <CanvasView flags={flags} />
    </div>
  );
}
