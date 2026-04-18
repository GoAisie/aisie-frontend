'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatPercent } from '@/lib/format';

type AnalyticsSummary = {
  reports_this_week: number;
  reports_last_week: number;
  completion_rate: number;
  pending_followups: number;
  active_customers: number;
  calls_this_month: number;
};

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => apiFetch<AnalyticsSummary>('/api/v1/analytics/summary'),
  });

  if (isLoading) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Analiz</h1>
        <p style={{ color: '#6b6b74', fontSize: 14, marginTop: 12 }}>Yükleniyor…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Analiz</h1>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Veriler yüklenemedi.</p>
      </section>
    );
  }

  const weeklyDelta = data.reports_this_week - data.reports_last_week;

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Analiz</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>Haftalık özet</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        <KpiCard
          label="Bu hafta rapor"
          value={String(data.reports_this_week)}
          trend={
            weeklyDelta > 0
              ? `↑ geçen haftaya göre +${weeklyDelta}`
              : weeklyDelta < 0
                ? `↓ geçen haftaya göre ${weeklyDelta}`
                : 'değişim yok'
          }
          trendPositive={weeklyDelta > 0}
        />
        <KpiCard
          label="Tamamlanma oranı"
          value={formatPercent(data.completion_rate)}
          trend="son 30 gün"
          trendPositive={data.completion_rate >= 0.75}
        />
        <KpiCard label="Aktif müşteri" value={String(data.active_customers)} trend="şirket geneli toplam" />
        <KpiCard
          label="Bekleyen takip"
          value={String(data.pending_followups)}
          trend={data.pending_followups > 0 ? 'Ajanda sekmesinden görüntüleyin' : 'temiz'}
          trendPositive={data.pending_followups === 0}
        />
        <KpiCard label="Bu ay görüşme" value={String(data.calls_this_month)} trend="tüm aramalar" />
      </div>
    </section>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  return (
    <div
      style={{
        padding: '14px 14px 12px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 12, color: '#6b6b74' }}>{props.label}</span>
      <strong style={{ fontSize: 26, lineHeight: 1.1, color: '#0b0b0f' }}>{props.value}</strong>
      {props.trend && (
        <span
          style={{
            fontSize: 11,
            color: props.trendPositive === undefined ? '#9ca3af' : props.trendPositive ? '#059669' : '#dc2626',
          }}
        >
          {props.trend}
        </span>
      )}
    </div>
  );
}
