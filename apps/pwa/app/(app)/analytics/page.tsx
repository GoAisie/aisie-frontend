'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatPercent } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { AlertPill, type AlertTone } from '@/components/ui/alert-pill';

type AnalyticsSummary = {
  reports_this_week: number;
  reports_last_week: number;
  completion_rate: number;
  pending_today_events: number;
  inprogress_reports: number;
  active_customers: number;
  calls_this_month: number;
};

type DailyActivityRow = {
  date: string;
  total: number;
  completed: number;
};

export default function AnalyticsPage() {
  const summary = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => apiFetch<AnalyticsSummary>('/api/v1/analytics/summary'),
  });
  const daily = useQuery({
    queryKey: ['analytics-daily'],
    queryFn: () =>
      apiFetch<DailyActivityRow[]>('/api/v1/analytics/daily-activity'),
  });

  if (summary.isLoading) {
    return (
      <section className="px-4 pb-2">
        <PageHeader title="Analiz" subtitle="Yükleniyor…" />
      </section>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <section className="px-4 pb-2">
        <PageHeader title="Analiz" />
        <p className="m-0 mt-3 text-[14px] text-destructive">
          Veriler yüklenemedi.
        </p>
      </section>
    );
  }

  const data = summary.data;
  const weeklyDelta = data.reports_this_week - data.reports_last_week;

  return (
    <section className="px-4 pb-2">
      <PageHeader title="Analiz" />

      {/* KPI cards — 2x2 grid */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatCard
          label="Bu hafta rapor"
          value={String(data.reports_this_week)}
          delta={weeklyDelta}
          deltaLabel="geçen haftaya göre"
        />
        <StatCard
          label="Tamamlanma oranı"
          value={formatPercent(data.completion_rate)}
          tone={
            data.completion_rate >= 0.75
              ? 'good'
              : data.completion_rate >= 0.5
                ? 'neutral'
                : 'bad'
          }
          subtitle="son 30 gün"
        />
        <StatCard
          label="Bugünkü etkinlik"
          value={String(data.pending_today_events)}
          tone={data.pending_today_events === 0 ? 'good' : 'attention'}
          subtitle={
            data.pending_today_events > 0 ? "Ajanda'dan gör" : 'bugün boş'
          }
          href={data.pending_today_events > 0 ? '/calendar' : undefined}
        />
        <StatCard
          label="Aktif müşteri"
          value={String(data.active_customers)}
          subtitle="şirket geneli"
        />
      </div>

      {/* Sparkline */}
      <SectionHeader
        title="Son 30 gün"
        subtitle={
          daily.isLoading
            ? 'Yükleniyor…'
            : daily.data
              ? `${sum(daily.data, 'completed')} tamamlandı / ${sum(daily.data, 'total')} rapor`
              : '—'
        }
      />
      <Card className="mb-5 gap-0 px-3 py-3.5 shadow-none">
        {daily.data && daily.data.length > 0 ? (
          <Sparkline rows={daily.data} />
        ) : (
          <p className="m-0 text-[14px] text-muted-foreground">
            Henüz veri yok.
          </p>
        )}
      </Card>

      {/* Action items — actionable inferences from existing data */}
      <SectionHeader title="Senin için" subtitle="öneriler" />
      <ActionItems
        pendingTodayEvents={data.pending_today_events}
        inprogressReports={data.inprogress_reports}
        completionRate={data.completion_rate}
        thisWeek={data.reports_this_week}
        daily={daily.data ?? []}
      />
    </section>
  );
}

// ----- Sparkline (inline SVG, design-token colors) ---------------------------
// Two-line plot: total (brand violet) + completed (success green). 300x80
// viewBox scales to container width; baseline at y=72 leaves headroom.
// Colors use CSS custom properties so light/dark theme swaps land
// automatically when dark mode is enabled.

function Sparkline({ rows }: { rows: DailyActivityRow[] }) {
  // Parent already guards on `rows.length > 0`, but TS's noUncheckedIndexedAccess
  // can't see through that boundary — keep a defensive early return.
  if (rows.length === 0) return null;

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;

  const { totalPath, completedPath, lastPoint } = useMemo(() => {
    const max = Math.max(1, ...rows.map((r) => r.total));
    const stepX = 300 / (rows.length - 1 || 1);
    const yFor = (v: number) => 72 - (v / max) * 60;
    const tot = rows
      .map(
        (r, i) =>
          `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${yFor(r.total).toFixed(1)}`,
      )
      .join(' ');
    const com = rows
      .map(
        (r, i) =>
          `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${yFor(r.completed).toFixed(1)}`,
      )
      .join(' ');
    const lastIdx = rows.length - 1;
    return {
      totalPath: tot,
      completedPath: com,
      lastPoint: { x: lastIdx * stepX, y: yFor(last.total) },
    };
  }, [rows, last]);

  const firstDate = new Date(first.date + 'T12:00:00');
  const lastDate = new Date(last.date + 'T12:00:00');
  const dateFmt = (d: Date) =>
    d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  return (
    <div>
      <svg
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        className="block h-20 w-full"
      >
        {/* baseline grid */}
        <line
          x1="0"
          y1="72"
          x2="300"
          y2="72"
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        {/* completed (success green) — underneath so brand violet sits on top */}
        <path
          d={completedPath}
          fill="none"
          stroke="var(--color-assistant-500)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* total (brand violet) */}
        <path
          d={totalPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* last point marker */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3"
          fill="var(--color-brand-600)"
        />
      </svg>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{dateFmt(firstDate)}</span>
        <span>{dateFmt(lastDate)}</span>
      </div>
      <div className="mt-2 flex gap-3.5 text-[11px] text-muted-foreground">
        <LegendDot color="var(--color-brand-600)" label="Toplam" />
        <LegendDot color="var(--color-assistant-500)" label="Tamamlanan" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ background: color }}
      />
      <span>{label}</span>
    </span>
  );
}

// ----- Action items ----------------------------------------------------------
// Derived from existing summary + daily data so the panel always reflects the
// same source of truth as the cards above — no separate state to drift.

function ActionItems({
  pendingTodayEvents,
  inprogressReports,
  completionRate,
  thisWeek,
  daily,
}: {
  pendingTodayEvents: number;
  inprogressReports: number;
  completionRate: number;
  thisWeek: number;
  daily: DailyActivityRow[];
}) {
  const items: { label: string; tone: AlertTone; href?: string }[] = [];

  if (pendingTodayEvents > 0) {
    items.push({
      label: `${pendingTodayEvents} bugünkü etkinlik — ajanda'dan gör`,
      tone: 'attention',
      href: '/calendar',
    });
  }

  if (inprogressReports > 0) {
    items.push({
      label: `${inprogressReports} yarım kalan rapor — raporlardan tamamla`,
      tone: 'attention',
      href: '/reports',
    });
  }

  if (completionRate > 0 && completionRate < 0.5) {
    items.push({
      label: `Tamamlanma oranı düşük (${formatPercent(completionRate)}) — yarım kalan raporları gözden geçir`,
      tone: 'attention',
      href: '/reports',
    });
  }

  if (thisWeek === 0) {
    items.push({
      label: 'Bu hafta henüz rapor yok — bir görüşme kaydetmeye ne dersin?',
      tone: 'info',
      href: '/',
    });
  }

  // Three or more consecutive zero-total days at the end of the daily series
  // signals a silent gap; surface it gently.
  if (daily.length >= 3) {
    const tail = daily.slice(-3);
    if (tail.every((r) => r.total === 0)) {
      items.push({
        label: 'Son 3 gündür rapor girilmedi — kaldığın yerden devam et',
        tone: 'info',
        href: '/',
      });
    }
  }

  if (items.length === 0) {
    items.push({
      label: 'Her şey yolunda — şu an ek bir aksiyon gerekmiyor',
      tone: 'good',
    });
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((it, i) => (
        <li key={i} className="list-none">
          <AlertPill tone={it.tone} label={it.label} href={it.href} />
        </li>
      ))}
    </ul>
  );
}

function sum<T extends Record<string, number | string>>(
  rows: T[],
  key: keyof T,
): number {
  return rows.reduce(
    (acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0),
    0,
  );
}
