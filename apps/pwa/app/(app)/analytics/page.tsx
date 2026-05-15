'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatPercent } from '@/lib/format';

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
    queryFn: () => apiFetch<DailyActivityRow[]>('/api/v1/analytics/daily-activity'),
  });

  if (summary.isLoading) {
    return (
      <section style={pageStyle}>
        <h1 style={h1Style}>Analiz</h1>
        <p style={mutedStyle}>Yükleniyor…</p>
      </section>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <section style={pageStyle}>
        <h1 style={h1Style}>Analiz</h1>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Veriler yüklenemedi.</p>
      </section>
    );
  }

  const data = summary.data;
  const weeklyDelta = data.reports_this_week - data.reports_last_week;

  return (
    <section style={pageStyle}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={h1Style}>Analiz</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>Haftalık özet</p>
      </header>

      {/* KPI cards — 2x2 grid, delta-first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
        <KpiCard
          label="Bu hafta rapor"
          value={String(data.reports_this_week)}
          delta={weeklyDelta}
          deltaLabel="geçen haftaya göre"
        />
        <KpiCard
          label="Tamamlanma oranı"
          value={formatPercent(data.completion_rate)}
          tone={data.completion_rate >= 0.75 ? 'good' : data.completion_rate >= 0.5 ? 'neutral' : 'bad'}
          subtitle="son 30 gün"
        />
        <KpiCard
          label="Bugünkü etkinlik"
          value={String(data.pending_today_events)}
          tone={data.pending_today_events === 0 ? 'good' : 'attention'}
          subtitle={data.pending_today_events > 0 ? 'Ajanda’dan gör' : 'bugün boş'}
          href={data.pending_today_events > 0 ? '/calendar' : undefined}
        />
        <KpiCard
          label="Aktif müşteri"
          value={String(data.active_customers)}
          subtitle="şirket geneli"
        />
      </div>

      {/* Sparkline */}
      <SectionTitle title="Son 30 gün" subtitle={daily.isLoading ? 'Yükleniyor…' : daily.data ? `${sum(daily.data, 'completed')} tamamlandı / ${sum(daily.data, 'total')} rapor` : '—'} />
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 12px', marginBottom: 18 }}>
        {daily.data && daily.data.length > 0 ? (
          <Sparkline rows={daily.data} />
        ) : (
          <p style={{ ...mutedStyle, margin: 0 }}>Henüz veri yok.</p>
        )}
      </div>

      {/* Action items — actionable inferences from existing data */}
      <SectionTitle title="Senin için" subtitle="öneriler" />
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

// ----- Sparkline (inline SVG) -------------------------------------------------
// Two-line plot: total (purple) + completed (green). 300×80 viewBox scales to
// container width; baseline at y=72 to leave headroom for the top value.

function Sparkline({ rows }: { rows: DailyActivityRow[] }) {
  // Parent already guards on `rows.length > 0`, but TS's noUncheckedIndexedAccess
  // can't see through that boundary — keep a defensive early return.
  if (rows.length === 0) return null;

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;

  const { totalPath, completedPath, lastPoint } = useMemo(() => {
    const max = Math.max(1, ...rows.map((r) => r.total));
    const stepX = 300 / (rows.length - 1 || 1);
    const yFor = (v: number) => 72 - (v / max) * 60; // 12..72 vertical band
    const tot = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${yFor(r.total).toFixed(1)}`).join(' ');
    const com = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${yFor(r.completed).toFixed(1)}`).join(' ');
    const lastIdx = rows.length - 1;
    return {
      totalPath: tot,
      completedPath: com,
      lastPoint: { x: lastIdx * stepX, y: yFor(last.total) },
    };
  }, [rows, last]);

  const firstDate = new Date(first.date + 'T12:00:00');
  const lastDate = new Date(last.date + 'T12:00:00');
  const dateFmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  return (
    <div>
      <svg viewBox="0 0 300 80" preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block' }}>
        {/* axis baseline */}
        <line x1="0" y1="72" x2="300" y2="72" stroke="#f3f4f6" strokeWidth="1" />
        {/* completed (green) — underneath so total purple sits on top */}
        <path d={completedPath} fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* total (purple) */}
        <path d={totalPath} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* last point marker */}
        <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill="#7c3aed" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
        <span>{dateFmt(firstDate)}</span>
        <span>{dateFmt(lastDate)}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: '#6b6b74' }}>
        <LegendDot color="#7c3aed" label="Toplam" />
        <LegendDot color="#059669" label="Tamamlanan" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

// ----- Action items -----------------------------------------------------------
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
  const items: { label: string; tone: 'attention' | 'info' | 'good'; href?: string }[] = [];

  if (pendingTodayEvents > 0) {
    items.push({
      label: `${pendingTodayEvents} bugünkü etkinlik — ajanda’dan gör`,
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
    items.push({ label: 'Her şey yolunda — şu an ek bir aksiyon gerekmiyor', tone: 'good' });
  }

  return (
    <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => {
        const palette =
          it.tone === 'attention'
            ? { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' }
            : it.tone === 'good'
              ? { bg: '#d1fae5', color: '#065f46', dot: '#059669' }
              : { bg: '#e0e7ff', color: '#3730a3', dot: '#6366f1' };
        const inner = (
          <li
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px',
              background: palette.bg, borderRadius: 12,
              fontSize: 13, color: palette.color, lineHeight: 1.4,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: palette.dot, marginTop: 5, flexShrink: 0 }} />
            <span>{it.label}</span>
          </li>
        );
        return it.href ? (
          <Link key={i} href={it.href} style={{ textDecoration: 'none', display: 'block' }}>
            {inner}
          </Link>
        ) : (
          inner
        );
      })}
    </ul>
  );
}

// ----- Small UI primitives ----------------------------------------------------

function KpiCard(props: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  tone?: 'good' | 'attention' | 'bad' | 'neutral';
  href?: string;
}) {
  const toneColor =
    props.tone === 'good' ? '#059669'
    : props.tone === 'attention' ? '#d97706'
    : props.tone === 'bad' ? '#dc2626'
    : '#6b6b74';

  let deltaText: string | null = null;
  let deltaColor = '#9ca3af';
  if (typeof props.delta === 'number') {
    if (props.delta > 0) {
      deltaText = `↑ +${props.delta} ${props.deltaLabel ?? ''}`.trim();
      deltaColor = '#059669';
    } else if (props.delta < 0) {
      deltaText = `↓ ${props.delta} ${props.deltaLabel ?? ''}`.trim();
      deltaColor = '#dc2626';
    } else {
      deltaText = `değişim yok`;
    }
  }

  const card = (
    <div
      style={{
        padding: '14px 14px 12px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        height: '100%',
      }}
    >
      <span style={{ fontSize: 12, color: '#6b6b74' }}>{props.label}</span>
      <strong style={{ fontSize: 26, lineHeight: 1.1, color: '#0b0b0f' }}>{props.value}</strong>
      {deltaText && <span style={{ fontSize: 11, color: deltaColor }}>{deltaText}</span>}
      {!deltaText && props.subtitle && (
        <span style={{ fontSize: 11, color: toneColor }}>{props.subtitle}</span>
      )}
    </div>
  );

  return props.href ? (
    <Link href={props.href} style={{ textDecoration: 'none', display: 'block' }}>
      {card}
    </Link>
  ) : (
    card
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0b0b0f' }}>{title}</h2>
      {subtitle && <span style={{ fontSize: 11, color: '#9ca3af' }}>{subtitle}</span>}
    </div>
  );
}

function sum<T extends Record<string, number | string>>(rows: T[], key: keyof T): number {
  return rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
}

// ----- Styles -----------------------------------------------------------------

const pageStyle: React.CSSProperties = { padding: '24px 16px 8px' };
const h1Style: React.CSSProperties = { fontSize: 22, fontWeight: 700, margin: 0 };
const mutedStyle: React.CSSProperties = { color: '#6b6b74', fontSize: 14, marginTop: 12 };
