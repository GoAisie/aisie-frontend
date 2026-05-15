'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { CalendarEvent } from '@aisie/shared';

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// `kind` and `status` were removed from CalendarEvent in May 2026. Every
// event renders with the same neutral marker — no longer color-coded by
// type. Cancelled events flow through `to_be_deleted` so they're filtered
// at the backend list endpoint and never reach the UI.
const EVENT_DOT_COLOR = '#7c3aed';

// JS getDay() returns 0=Sun…6=Sat; convert to ISO weekday (0=Mon…6=Sun).
function jsToIso(jsDay: number) { return (jsDay + 6) % 7; }

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLocal() { return localDateStr(new Date()); }

export default function CalendarPage() {
  const today = useMemo(() => todayLocal(), []);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showPicker, setShowPicker] = useState(false);

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth(); // 0-indexed

  const fromISO = new Date(Date.UTC(year, month, 1)).toISOString();
  const toISO   = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  const { data: events = [], isLoading, isError } = useQuery({
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
    const firstDay   = new Date(year, month, 1);
    const offset     = jsToIso(firstDay.getDay()); // 0-6, Mon=0
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
    setSelectedDate(nextMonthStr === todayMonthStr ? today : localDateStr(next));
  };

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ajanda</h1>
      </header>

      {/* Month navigation — click title to open year/month picker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => goMonth(-1)} style={navBtnStyle} aria-label="Önceki ay">‹</button>
        <button
          onClick={() => setShowPicker(true)}
          style={titleBtnStyle}
          aria-label={`${MONTH_NAMES[month]} ${year} — yıl ve ay seçici aç`}
        >
          {MONTH_NAMES[month]} {year}
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>▾</span>
        </button>
        <button onClick={() => goMonth(1)} style={navBtnStyle} aria-label="Sonraki ay">›</button>
      </div>

      {showPicker && (
        <MonthYearPicker
          currentYear={year}
          currentMonth={month}
          onPick={(y, m) => {
            setViewMonth(new Date(y, m, 1));
            const newMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
            const todayMonthStr = today.slice(0, 7);
            setSelectedDate(newMonthStr === todayMonthStr ? today : `${newMonthStr}-01`);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>Ajanda yüklenemedi.</p>
      )}

      {/* Day-of-week headers */}
      <div style={weekHeaderGrid}>
        {DAY_LABELS.map((l) => (
          <div key={l} style={dayHeaderStyle}>{l}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <div style={calGridStyle}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`pad-${idx}`} style={emptyCellStyle} />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday    = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayEvents  = eventsByDate[dateStr] ?? [];

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                style={{
                  ...dayCellStyle,
                  background: isSelected ? '#7c3aed' : '#fff',
                  color: isSelected ? '#fff' : '#0b0b0f',
                  boxShadow: isToday && !isSelected ? 'inset 0 0 0 2px #7c3aed' : 'none',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isToday || isSelected ? 700 : 400 }}>
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
                    {dayEvents.slice(0, 3).map((_e, i) => (
                      <span
                        key={i}
                        style={{
                          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                          background: isSelected ? 'rgba(255,255,255,0.85)' : EVENT_DOT_COLOR,
                        }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: 7, lineHeight: '5px', color: isSelected ? '#e9d5ff' : '#6b6b74' }}>
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
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6b6b74', marginBottom: 8, marginTop: 0 }}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'long', weekday: 'long',
          })}
        </p>

        {isLoading ? (
          <p style={{ color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
        ) : selectedEvents.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Bu gün için etkinlik yok.</p>
        ) : (
          <ul style={{ padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEvents.map((e) => {
              const time = new Date(e.start_at).toLocaleTimeString('tr-TR', {
                hour: '2-digit', minute: '2-digit',
              });
              return (
                <li key={e.event_id} style={cardStyle}>
                  <strong style={{ fontSize: 15, color: '#0b0b0f', lineHeight: 1.3, display: 'block' }}>{e.title}</strong>
                  <p style={{ margin: '4px 0 0', color: '#7c3aed', fontSize: 13, fontWeight: 500 }}>{time}</p>
                  {e.description && (
                    <p style={{ margin: '6px 0 0', color: '#6b6b74', fontSize: 13, lineHeight: 1.45 }}>
                      {e.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
  width: 36, height: 36, padding: 0, cursor: 'pointer',
  fontSize: 20, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const titleBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid transparent', borderRadius: 8,
  padding: '4px 10px', cursor: 'pointer',
  fontSize: 16, fontWeight: 600, color: '#0b0b0f',
  display: 'flex', alignItems: 'center',
};
const weekHeaderGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4,
};
const dayHeaderStyle: React.CSSProperties = {
  textAlign: 'center', fontSize: 11, fontWeight: 600,
  color: '#9ca3af', paddingBottom: 4,
};
const calGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
};
const emptyCellStyle: React.CSSProperties = {
  aspectRatio: '1', background: '#fafafa',
  borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
};
const dayCellStyle: React.CSSProperties = {
  aspectRatio: '1', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
  cursor: 'pointer', padding: '4px 2px', borderRadius: 0, outline: '2px solid transparent',
};
const cardStyle: React.CSSProperties = {
  listStyle: 'none', padding: '12px 14px',
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
};

// ----- Year/month picker modal -------------------------------------------------
//
// Two-stage commit: tapping a year row updates the pending year but keeps the
// modal open so the user can then pick a month in the same gesture. Tapping a
// month fires onPick(year, month) and closes — single confirm action.

function MonthYearPicker({
  currentYear,
  currentMonth,
  onPick,
  onClose,
}: {
  currentYear: number;
  currentMonth: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15, 16, 25, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Yıl ve ay seçimi"
        style={{
          width: '100%', maxWidth: 340,
          background: '#fff', borderRadius: 14, padding: 16,
          boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6b6b74', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Yıl
        </p>
        <div
          style={{
            display: 'flex', gap: 6, overflowX: 'auto',
            paddingBottom: 6, marginBottom: 14,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {years.map((y) => {
            const active = y === pendingYear;
            return (
              <button
                key={y}
                onClick={() => setPendingYear(y)}
                style={{
                  flex: '0 0 auto',
                  padding: '8px 14px', borderRadius: 999,
                  border: '1px solid ' + (active ? '#7c3aed' : '#e5e7eb'),
                  background: active ? '#7c3aed' : '#fff',
                  color: active ? '#fff' : '#374151',
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {y}
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#6b6b74', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Ay
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {MONTH_NAMES.map((name, idx) => {
            const isCurrent = pendingYear === currentYear && idx === currentMonth;
            return (
              <button
                key={idx}
                onClick={() => onPick(pendingYear, idx)}
                style={{
                  padding: '10px 4px', borderRadius: 8,
                  border: '1px solid ' + (isCurrent ? '#7c3aed' : '#e5e7eb'),
                  background: isCurrent ? '#ede9fe' : '#fff',
                  color: isCurrent ? '#5b21b6' : '#374151',
                  fontSize: 13, fontWeight: isCurrent ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#6b6b74',
              fontSize: 13, padding: '6px 4px', cursor: 'pointer',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
