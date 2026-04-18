import { ANALYTICS_FIXTURE } from '@/lib/fixtures/analytics';
import { formatPercent } from '@/lib/format';

export default function AnalyticsPage() {
  const a = ANALYTICS_FIXTURE;
  const weeklyDelta = a.reportsThisWeek - a.reportsLastWeek;

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Analiz</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          Haftalık özet · örnek veri (Faz 3'te gerçek veri)
        </p>
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
          value={String(a.reportsThisWeek)}
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
          value={formatPercent(a.completionRate)}
          trend="son 30 gün"
          trendPositive={a.completionRate >= 0.75}
        />
        <KpiCard label="Aktif müşteri" value={String(a.activeCustomers)} trend="iletişim geçmişi olan" />
        <KpiCard
          label="Bekleyen takip"
          value={String(a.pendingFollowups)}
          trend={a.pendingFollowups > 0 ? 'Ajanda sekmesinden görüntüleyin' : 'temiz'}
          trendPositive={a.pendingFollowups === 0}
        />
        <KpiCard label="Bu ay görüşme" value={String(a.callsThisMonth)} trend="tüm aramalar" />
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
