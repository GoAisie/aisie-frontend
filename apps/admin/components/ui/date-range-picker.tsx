'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDateRange, isoDay, type Preset } from '@/lib/format';

// Self-contained date range picker for the admin dashboard. Combines a
// preset rail (Bugün / Son 7 gün / Son 30 gün / Bu ay / Geçen ay / Özel)
// with a single-month range-mode Calendar. Emits start+end as Date objects;
// the host serialises to YYYY-MM-DD via `isoDay()` when sending to the API.
//
// Why presets matter: 95% of admin queries are "last 7/30 days". Forcing the
// user to click two calendar cells for every refresh adds friction. Presets
// are one click. Custom range is the escape hatch.

export const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'today', label: 'Bugün' },
  { key: 'last7', label: 'Son 7 gün' },
  { key: 'last30', label: 'Son 30 gün' },
  { key: 'thisMonth', label: 'Bu ay' },
  { key: 'lastMonth', label: 'Geçen ay' },
];

export function presetToRange(p: Preset): { from: Date; to: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (p) {
    case 'today':
      return { from: today, to: today };
    case 'last7': {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return { from, to: today };
    }
    case 'last30': {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from, to: today };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: today };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to };
    }
    case 'custom':
      return { from: today, to: today };
  }
}

type Props = {
  value: { from: Date; to: Date };
  onChange: (next: { from: Date; to: Date }, preset: Preset) => void;
  preset: Preset;
  className?: string;
};

export function DateRangePicker({ value, onChange, preset, className }: Props) {
  const [open, setOpen] = React.useState(false);
  // Local range state inside the popover — committed to parent only on close
  // or preset click. Keeps the parent from refetching on every calendar tap.
  const [draft, setDraft] = React.useState<DateRange | undefined>({
    from: value.from,
    to: value.to,
  });

  React.useEffect(() => {
    setDraft({ from: value.from, to: value.to });
  }, [value.from, value.to]);

  const label = formatDateRange(value.from, value.to);

  const commitPreset = (p: Preset) => {
    const range = presetToRange(p);
    onChange(range, p);
    setOpen(false);
  };

  const commitDraft = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from && next?.to) {
      // Both ends selected → commit + close. Single-end selections stay
      // open so the user can pick the second date.
      const from = new Date(next.from);
      const to = new Date(next.to);
      from.setHours(0, 0, 0, 0);
      to.setHours(0, 0, 0, 0);
      onChange({ from, to }, 'custom');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 justify-start gap-2 font-medium',
            preset === 'custom' && 'border-brand-500',
            className,
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-foreground">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto p-0" align="end">
        <div className="flex flex-col gap-0.5 border-r border-border/60 p-2">
          {PRESETS.map(({ key, label: presetLabel }) => (
            <button
              key={key}
              type="button"
              onClick={() => commitPreset(key)}
              className={cn(
                'w-full rounded-md px-3 py-1.5 text-left text-[13px] font-medium transition-colors',
                preset === key
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-foreground/75 hover:bg-muted hover:text-foreground',
              )}
            >
              {presetLabel}
            </button>
          ))}
          <div className="my-1 h-px bg-border/60" aria-hidden />
          <span className="px-3 text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Özel aralık
          </span>
          <span className="px-3 pb-1 text-[11px] text-muted-foreground/80">
            Takvimden iki gün seç
          </span>
        </div>
        <Calendar
          mode="range"
          selected={draft}
          onSelect={commitDraft}
          numberOfMonths={1}
          defaultMonth={value.from}
        />
      </PopoverContent>
    </Popover>
  );
}

// Re-export the isoDay helper so callers can keep imports tidy.
export { isoDay };
