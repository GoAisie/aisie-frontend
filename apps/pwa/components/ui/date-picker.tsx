'use client';

import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { tr } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Single-date picker. Display label is Turkish dd.MM.yyyy ("26.05.2026") via
// date-fns format; the wire value stays YYYY-MM-DD so backend Pydantic
// schemas and report.data dict keys never see the localised string. This is
// the same split that <input type="date"> uses internally — value vs
// presentation — but with a Türkçe label that's invariant across browsers.
//
// Why not <input type="date" lang="tr">: Chrome ignores `lang` for native
// date inputs, so iPhone Safari + Android Chrome still show the OS-locale
// format. A custom picker gives identical visuals on every device.

type Props = {
  // Stored value — `''` means "no date selected" (matches existing
  // dateFilter contract).
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  className?: string;
  // Allow clearing via an inline ✕ button. Off by default so date-required
  // template fields don't accidentally render the clear control.
  clearable?: boolean;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : undefined;
}

function toIso(d: Date): string {
  // date-fns `format(d, 'yyyy-MM-dd')` uses local calendar fields — this
  // matches the existing `<input type="date">` behaviour (value reflects the
  // clicked day in the user's TZ, not UTC).
  return format(d, 'yyyy-MM-dd');
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Tarih seç',
  ariaLabel,
  required,
  className,
  clearable = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);

  const label = selected ? format(selected, 'dd.MM.yyyy', { locale: tr }) : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          aria-required={required ? 'true' : undefined}
          className={cn(
            'h-9 justify-between gap-2 px-3 font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span>{label || placeholder}</span>
          </span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Tarihi temizle"
              onPointerDown={(e) => {
                // PointerDown beats Popover's click-to-open — we want clear
                // without surfacing the calendar.
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toIso(d));
              setOpen(false);
            }
          }}
          defaultMonth={selected}
          // captionLayout=dropdown swaps the month label for two <select>
          // dropdowns (month + year). Bounding with startMonth/endMonth keeps
          // the year list focused on pilot-relevant range — without bounds
          // react-day-picker emits 100 years, painful to scroll on mobile.
          captionLayout="dropdown"
          startMonth={new Date(2024, 0)}
          endMonth={new Date(2030, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}
