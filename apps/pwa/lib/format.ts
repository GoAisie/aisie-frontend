// Turkish date/number formatters. Centralised so list pages render
// identically regardless of browser locale defaults. All formatters route
// through `parseUtc` so timestamps are anchored to UTC before being rendered
// in the user's local zone — Intl handles the per-user TZ conversion.

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
});
const relFmt = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

// Backend Pydantic models default to `datetime.utcnow` (naive UTC), so some
// endpoints emit ISO without `Z` / `+HH:MM`. `new Date(naive)` would then
// interpret the string as the browser's local TZ — for a Turkish (UTC+3)
// user that misreads UTC 12:00 as Istanbul 12:00 (off by 3h). This helper
// pins missing-TZ strings to UTC so Intl can correctly project them into the
// user's local zone. TZ-bearing input (Z or ±HH:MM) is left untouched —
// forward-compatible if backend ever migrates to aware datetimes.
function parseUtc(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : iso + 'Z');
}

export function formatDate(iso: string): string {
  return dateFmt.format(parseUtc(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(parseUtc(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(parseUtc(iso));
}

// "bugün 15:00" / "yarın 10:00" / "22 Nis 11:30". Keeps upcoming dates
// human-readable without the full month-year noise.
export function formatUpcoming(iso: string, now: Date = new Date()): string {
  const d = parseUtc(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDelta = Math.round((startOf(d) - startOf(now)) / (24 * 60 * 60 * 1000));

  if (dayDelta === 0) return `bugün ${timeFmt.format(d)}`;
  if (dayDelta === 1) return `yarın ${timeFmt.format(d)}`;
  if (dayDelta === -1) return `dün ${timeFmt.format(d)}`;
  if (Math.abs(dayDelta) < 7) return `${relFmt.format(dayDelta, 'day')} ${timeFmt.format(d)}`;
  return dateTimeFmt.format(d);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio,
  );
}
