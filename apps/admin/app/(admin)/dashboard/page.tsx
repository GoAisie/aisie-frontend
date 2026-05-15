'use client';

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

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics-summary-company'],
    queryFn: () => apiFetch<AnalyticsSummary>('/api/v1/analytics/summary?scope=company'),
  });

  if (isLoading) {
    return (
      <section>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Özet</h1>
        </header>
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Özet</h1>
        </header>
        <p style={{ color: '#dc2626', fontSize: 14 }}>Veriler yüklenemedi.</p>
      </section>
    );
  }

  const delta = data.reports_this_week - data.reports_last_week;

  return (
    <section>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Özet</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>Haftalık aktivite</p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          maxWidth: 1100,
        }}
      >
        <Kpi
          label="Bu hafta rapor"
          value={String(data.reports_this_week)}
          trend={delta > 0 ? `↑ geçen haftaya göre +${delta}` : delta < 0 ? `↓ geçen haftaya göre ${delta}` : 'geçen haftayla aynı'}
          trendPositive={delta >= 0}
        />
        <Kpi
          label="Tamamlanma oranı"
          value={formatPercent(data.completion_rate)}
          trend="son 30 gün"
          trendPositive={data.completion_rate >= 0.8}
        />
        <Kpi
          label="Aktif müşteri"
          value={String(data.active_customers)}
          trend="şirket geneli toplam"
        />
        <Kpi
          label="Bu ay görüşme"
          value={String(data.calls_this_month)}
          trend="toplam rapor sayısı"
        />
        <Kpi
          label="Bugünkü etkinlik"
          value={String(data.pending_today_events)}
          trend={data.pending_today_events === 0 ? 'bugün boş' : 'ajandadan gör'}
          trendPositive={data.pending_today_events === 0}
        />
        <Kpi
          label="Yarım kalan rapor"
          value={String(data.inprogress_reports)}
          trend={data.inprogress_reports === 0 ? 'temiz' : 'raporlardan tamamla'}
          trendPositive={data.inprogress_reports === 0}
        />
      </div>
    </section>
  );
}

function Kpi(props: {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
}) {
  const trendColor =
    props.trendPositive === undefined
      ? '#9ca3af'
      : props.trendPositive
        ? '#059669'
        : '#dc2626';
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '18px 18px 16px',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: '#6b6b74' }}>{props.label}</p>
      <strong style={{ fontSize: 28, lineHeight: 1.1, color: '#0b0b0f', display: 'block', marginTop: 6 }}>
        {props.value}
      </strong>
      {props.trend && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: trendColor }}>{props.trend}</p>
      )}
    </div>
  );
}
