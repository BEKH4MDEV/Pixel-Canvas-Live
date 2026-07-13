import { cn } from '@/lib/cn';

/** Fondo compartido por la carga global, la cuenta atras y la ventana de resultados. */
export function LoadingBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 bg-canvas/95 backdrop-blur-md', className)}>
      <div className="bg-pixel-grid bg-pixel-grid-fade absolute inset-0 opacity-60" />
    </div>
  );
}
