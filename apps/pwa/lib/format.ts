// Turkish date/number formatters. Centralised so list pages render
// identically regardless of browser locale defaults.

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

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

// "bugün 15:00" / "yarın 10:00" / "22 Nis 11:30". Keeps upcoming dates
// human-readable without the full month-year noise.
export function formatUpcoming(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
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
