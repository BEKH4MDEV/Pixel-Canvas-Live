import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={250} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}

type TooltipProps =
  | {
      enabled?: true;
      content: ReactNode;
      children: ReactNode;
      side?: 'top' | 'right' | 'bottom' | 'left';
    }
  | {
      enabled: false;
      content?: ReactNode;
      children: ReactNode;
      side?: 'top' | 'right' | 'bottom' | 'left';
    };

export function Tooltip({
  content,
  children,
  side = 'top',
  enabled = true
}: TooltipProps) {
  return enabled ? (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-[var(--radius-sm)] border border-border-strong bg-surface-overlay px-2.5 py-1.5',
            'text-xs text-fg shadow-[var(--shadow-pop)] data-[state=delayed-open]:animate-[var(--animate-pop-in)]',
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-surface-overlay" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  ) : children ;
}
