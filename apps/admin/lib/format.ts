// Turkish-first formatters. Duplicated (not imported from PWA) because apps/
// intentionally don't depend on each other — keeps them deployable in
// isolation.

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
});
// Short Turkish date used inside the date-range picker — "13.05.2026"-style
// so the picker label stays compact and recognisable.
const compactFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio,
  );
}

// "13.05.2026 → 17.05.2026" when both dates differ; "13.05.2026" when equal.
// Picker button label + dashboard subtitle use this — readable at a glance.
export function formatDateRange(from: Date, to: Date): string {
  const a = compactFmt.format(from);
  const b = compactFmt.format(to);
  return a === b ? a : `${a} → ${b}`;
}

// ISO YYYY-MM-DD for a Date in local time — the API contract format used
// by the admin dashboard. Backend `_resolve_range` parses this as a UTC day
// boundary; for pilot scale the small UTC/local skew is acceptable.
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Preset keys are shared between the picker and host pages so the host can
// remember "user picked last 30 days" rather than only the resolved dates.
export type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';
