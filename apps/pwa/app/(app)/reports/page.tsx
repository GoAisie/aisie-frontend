import Link from 'next/link';
import { REPORTS_FIXTURE } from '@/lib/fixtures/reports';
import type { ReportStatusUi } from '@/lib/fixtures/types';
import { formatDateTime } from '@/lib/format';

export default function ReportsPage() {
  const reports = REPORTS_FIXTURE;

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Raporlar</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          Son {reports.length} rapor · örnek veri (Faz 3'te gerçek backend)
        </p>
      </header>

      <ul style={listStyle}>
        {reports.map((r) => (
          <li key={r.id} style={{ listStyle: 'none' }}>
            <Link href={`/reports/${r.id}`} style={cardLinkStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <strong style={{ fontSize: 15, color: '#0b0b0f' }}>{r.customerName}</strong>
                <StatusBadge status={r.status} />
              </div>
              <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
                {r.templateName}
              </p>
              <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 12 }}>
                {formatDateTime(r.createdAt)} · {r.repName}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: ReportStatusUi }) {
  const isDone = status === 'completed';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: isDone ? '#065f46' : '#92400e',
        background: isDone ? '#d1fae5' : '#fef3c7',
        whiteSpace: 'nowrap',
      }}
    >
      {isDone ? 'Tamamlandı' : 'Devam ediyor'}
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
