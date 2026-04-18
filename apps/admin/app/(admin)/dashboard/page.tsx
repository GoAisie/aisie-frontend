'use client';

import { ADMIN_DASHBOARD_FIXTURE } from '@/lib/fixtures/dashboard';
import { formatPercent } from '@/lib/format';

export default function DashboardPage() {
  const d = ADMIN_DASHBOARD_FIXTURE;
  const delta = d.reportsThisWeek - d.reportsLastWeek;

  return (
    <section>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Özet</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          Haftalık aktivite · örnek veri (Faz 3a'da gerçek veri)
        </p>
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
          value={String(d.reportsThisWeek)}
          trend={delta >= 0 ? `↑ geçen haftaya göre +${delta}` : `↓ geçen haftaya göre ${delta}`}
          trendPositive={delta >= 0}
        />
        <Kpi
          label="Tamamlanma oranı"
          value={formatPercent(d.completionRate)}
          trend="son 30 gün"
          trendPositive={d.completionRate >= 0.8}
        />
        <Kpi label="Aktif satış temsilcisi" value={String(d.activeReps)} trend="son 7 gün içinde rapor giren" />
        <Kpi
          label="Rapor başına konuşma turu"
          value={d.averageTurnsPerReport.toFixed(1)}
          trend="ortalama — düşük = verimli diyalog"
        />
        <Kpi
          label="Bekleyen takip"
          value={String(d.pendingFollowups)}
          trend={d.pendingFollowups === 0 ? 'temiz' : 'ajanda sekmesinden dağıtılabilir'}
          trendPositive={d.pendingFollowups <= 5}
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
