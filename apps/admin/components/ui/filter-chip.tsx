'use client';

import { cn } from '@/lib/utils';

type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
};

// Pill-style toggle for list filters (status, role, scope, etc.). Active
// state uses brand-600 fill + white; inactive is card bg + muted text.
export function FilterChip({ label, active, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all active:scale-95',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-border bg-card text-foreground/80 hover:bg-muted',
        className,
      )}
    >
      {label}
    </button>
  );
}
