import * as RadixSelect from '@radix-ui/react-select';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  leading?: ReactNode;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona…',
  disabled,
  className,
  id,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-input px-3',
          'text-base text-fg data-[placeholder]:text-fg-faint',
          'transition-[border-color,box-shadow] hover:border-white/20 focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand/30',
          'disabled:opacity-50',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="text-fg-subtle">
          <FiChevronDown />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-sm)]',
            'border border-border-strong bg-surface-overlay shadow-[var(--shadow-pop)]',
            'data-[state=open]:animate-[var(--animate-pop-in)]',
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={cn(
                  'relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-[5px] pl-2 pr-7 text-base text-fg',
                  'data-[highlighted]:bg-white/[0.06] data-[highlighted]:outline-none',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                )}
              >
                {opt.leading}
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2 text-brand">
                  <FiCheck />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
