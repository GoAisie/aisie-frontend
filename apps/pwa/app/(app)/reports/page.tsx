'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportStatus } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

export default function ReportsPage() {
  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<Report[]>('/api/v1/reports?limit=50'),
  });

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Raporlar</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {isLoading ? 'Yükleniyor…' : `Son ${reports.length} rapor`}
        </p>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14 }}>Raporlar yüklenemedi.</p>
      )}

      <ul style={listStyle}>
        {reports.map((r) => {
          // customer_name is the conventional field name set by entity_type:"customer"
          // templates; fall back to template_name if the field is absent or not a string.
          const customerName =
            typeof r.data?.['customer_name'] === 'string' ? r.data['customer_name'] : null;
          return (
            <li key={r.report_id} style={{ listStyle: 'none' }}>
              <Link href={`/reports/${r.report_id}`} style={cardLinkStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                  }}
                >
                  <strong style={{ fontSize: 15, color: '#0b0b0f' }}>
                    {customerName ?? r.template_name}
                  </strong>
                  <StatusBadge status={r.status} />
                </div>
                {customerName && (
                  <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
                    {r.template_name}
                  </p>
                )}
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 12 }}>
                  {formatDateTime(r.created_at)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  'in-progress': 'Devam ediyor',
  completed: 'Tamamlandı',
  archived: 'Arşivlendi',
  'pending-approval': 'Onay bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const STATUS_STYLE: Record<ReportStatus, { color: string; background: string }> = {
  'in-progress': { color: '#92400e', background: '#fef3c7' },
  completed: { color: '#065f46', background: '#d1fae5' },
  archived: { color: '#374151', background: '#f3f4f6' },
  'pending-approval': { color: '#1e40af', background: '#dbeafe' },
  approved: { color: '#065f46', background: '#d1fae5' },
  rejected: { color: '#991b1b', background: '#fee2e2' },
};

function StatusBadge({ status }: { status: ReportStatus }) {
  const style = STATUS_STYLE[status] ?? { color: '#374151', background: '#f3f4f6' };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const listStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const cardLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  textDecoration: 'none',
  color: 'inherit',
};
