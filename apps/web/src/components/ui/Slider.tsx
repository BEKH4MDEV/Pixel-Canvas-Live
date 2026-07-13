import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from '@/lib/cn';

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadixSlider.Root
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => onValueChange(v[0] ?? value)}
    >
      <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10">
        <RadixSlider.Range className="absolute h-full rounded-full bg-brand" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label="Valor"
        className={cn(
          'block h-4 w-4 rounded-full border-2 border-brand bg-canvas shadow transition-transform',
          'hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          'disabled:pointer-events-none',
        )}
      />
    </RadixSlider.Root>
  );
}
