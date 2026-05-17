'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ListCard } from '@/components/ui/list-card';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@aisie/shared';

const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// `kind` and `status` were removed from CalendarEvent in May 2026. Every
// event renders with the same neutral marker — no longer color-coded by
// type. Cancelled events flow through `to_be_deleted` so they're filtered
// at the backend list endpoint and never reach the UI.

// JS getDay() returns 0=Sun…6=Sat; convert to ISO weekday (0=Mon…6=Sun).
function jsToIso(jsDay: number) {
  return (jsDay + 6) % 7;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLocal() {
  return localDateStr(new Date());
}

export default function CalendarPage() {
  const today = useMemo(() => todayLocal(), []);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showPicker, setShowPicker] = useState(false);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth(); // 0-indexed

  const fromISO = new Date(Date.UTC(year, month, 1)).toISOString();
  const toISO = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  const {
    data: events = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: () =>
      apiFetch<CalendarEvent[]>(
        `/api/v1/calendar/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&limit=200`,
      ),
  });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const d = localDateStr(new Date(e.start_at));
      (map[d] = map[d] ?? []).push(e);
    }
    return map;
  }, [events]);

  // Build 6×7 grid (42 cells): null for padding, day number for real days.
  const cells = useMemo<(number | null)[]>(() => {
    const firstDay = new Date(year, month, 1);
    const offset = jsToIso(firstDay.getDay()); // 0-6, Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    while (grid.length < 42) grid.push(null);
    return grid;
  }, [year, month]);

  const goMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setViewMonth(next);
    const nextMonthStr = localDateStr(next).slice(0, 7);
    const todayMonthStr = today.slice(0, 7);
    setSelectedDate(
      nextMonthStr === todayMonthStr ? today : localDateStr(next),
    );
  };

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  return (
    <section className="px-4 pt-15 pb-2">
      <PageHeader title="Ajanda" />

      {/* Month navigation — click title to open year/month picker */}
      <div className="mb-2.5 flex items-center justify-between">
        <button
          onClick={() => goMonth(-1)}
          aria-label="Önceki ay"
          className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted active:scale-95"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          onClick={() => setShowPicker(true)}
          aria-label={`${MONTH_NAMES[month]} ${year} — yıl ve ay seçici aç`}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[16px] font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.97]"
        >
          {MONTH_NAMES[month]} {year}
          <ChevronDown
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
        </button>
        <button
          onClick={() => goMonth(1)}
          aria-label="Sonraki ay"
          className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted active:scale-95"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      {isError && (
        <p className="mb-2 text-[13px] text-destructive">
          Ajanda yüklenemedi.
        </p>
      )}

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_LABELS.map((l) => (
          <div
            key={l}
            className="pb-1 text-center text-[11px] font-semibold text-muted-foreground"
          >
            {l}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="mb-5 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`pad-${idx}`}
                  className="aspect-square border-b border-r border-border/40 bg-surface-subtle [&:nth-child(7n)]:border-r-0"
                />
              );
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayEvents = eventsByDate[dateStr] ?? [];

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center border-b border-r border-border/40 px-1 py-1 transition-colors active:scale-[0.95] [&:nth-child(7n)]:border-r-0',
                  isSelected
                    ? 'bg-brand-600 text-white'
                    : 'bg-card text-foreground hover:bg-muted',
                  !isSelected &&
                    isToday &&
                    'ring-2 ring-inset ring-brand-600',
                )}
              >
                <span
                  className={cn(
                    'text-[13px]',
                    isToday || isSelected ? 'font-bold' : 'font-normal',
                  )}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex justify-center gap-0.5">
                    {dayEvents.slice(0, 3).map((_e, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className={cn(
                          'size-1 shrink-0 rounded-full',
                          isSelected ? 'bg-white/85' : 'bg-brand-600',
                        )}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span
                        aria-hidden
                        className={cn(
                          'text-[8px] leading-[5px]',
                          isSelected ? 'text-brand-100' : 'text-muted-foreground',
                        )}
                      >
                        +
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day event list */}
      <div>
        <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            weekday: 'long',
          })}
        </p>

        {isLoading ? (
          <p className="m-0 text-[14px] text-muted-foreground">Yükleniyor…</p>
        ) : selectedEvents.length === 0 ? (
          <p className="m-0 text-[14px] text-muted-foreground/70">
            Bu gün için etkinlik yok.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {selectedEvents.map((e) => {
              const time = new Date(e.start_at).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li key={e.event_id} className="list-none">
                  <ListCard>
                    <strong className="block text-[15px] font-semibold leading-tight text-foreground">
                      {e.title}
                    </strong>
                    <p className="m-0 mt-1 text-[13px] font-medium text-brand-600">
                      {time}
                    </p>
                    {e.description && (
                      <p className="m-0 mt-1.5 text-[13px] leading-snug text-muted-foreground">
                        {e.description}
                      </p>
                    )}
                  </ListCard>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog
        open={showPicker}
        onOpenChange={(open) => {
          if (!open) setShowPicker(false);
        }}
      >
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="sr-only">Yıl ve ay seçimi</DialogTitle>
          </DialogHeader>
          <YearMonthBody
            currentYear={year}
            currentMonth={month}
            onPick={(y, m) => {
              setViewMonth(new Date(y, m, 1));
              const newMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
              const todayMonthStr = today.slice(0, 7);
              setSelectedDate(
                newMonthStr === todayMonthStr ? today : `${newMonthStr}-01`,
              );
              setShowPicker(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

// Two-stage commit: tapping a year row updates the pending year but keeps
// the modal open so the user can pick a month in the same gesture. Tapping
// a month fires onPick(year, month) and closes — single confirm action.
function YearMonthBody({
  currentYear,
  currentMonth,
  onPick,
}: {
  currentYear: number;
  currentMonth: number;
  onPick: (year: number, month: number) => void;
}) {
  const [pendingYear, setPendingYear] = useState(currentYear);
  const thisYear = new Date().getFullYear();
  // ±5 around the current "today" year — covers retrospective viewing and a
  // little forward planning without overwhelming the year strip.
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = thisYear - 5; y <= thisYear + 5; y++) arr.push(y);
    return arr;
  }, [thisYear]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Yıl
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5">
          {years.map((y) => {
            const active = y === pendingYear;
            return (
              <button
                key={y}
                onClick={() => setPendingYear(y)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors active:scale-95',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ay
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_NAMES.map((name, idx) => {
            const isCurrent =
              pendingYear === currentYear && idx === currentMonth;
            return (
              <button
                key={idx}
                onClick={() => onPick(pendingYear, idx)}
                className={cn(
                  'rounded-md border px-1 py-2.5 text-[13px] font-medium transition-colors active:scale-95',
                  isCurrent
                    ? 'border-brand-600 bg-brand-100 text-brand-800'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                )}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
