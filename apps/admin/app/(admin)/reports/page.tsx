'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ADMIN_REPORTS_FIXTURE } from '@/lib/fixtures/reports';
import type { AdminReportStatus } from '@/lib/fixtures/types';
import { formatDateTime } from '@/lib/format';

type StatusFilter = 'all' | AdminReportStatus;

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const reps = useMemo(() => {
    const set = new Set<string>();
    ADMIN_REPORTS_FIXTURE.forEach((r) => set.add(r.repName));
    return ['all', ...Array.from(set).sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ADMIN_REPORTS_FIXTURE.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (repFilter !== 'all' && r.repName !== repFilter) return false;
      if (q && !r.customerName.toLowerCase().includes(q) && !r.templateName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [statusFilter, repFilter, search]);

  return (
    <section>
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Raporlar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            Şirket geneli · örnek veri (Faz 3a'da <code>?scope=company</code> ile bağlanacak)
          </p>
        </div>
      </header>

      <div style={filterBarStyle}>
        <input
          type="search"
          placeholder="Müşteri veya şablon ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={inputStyle}
        >
          <option value="all">Tüm durumlar</option>
          <option value="completed">Tamamlandı</option>
          <option value="in-progress">Devam ediyor</option>
          <option value="archived">Arşivlendi</option>
        </select>
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          style={inputStyle}
        >
          {reps.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'Tüm temsilciler' : r}
            </option>
          ))}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={thStyle}>Müşteri</th>
              <th style={thStyle}>Şablon</th>
              <th style={thStyle}>Temsilci</th>
              <th style={thStyle}>Durum</th>
              <th style={thStyle}>Oluşturma</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                  Filtreye uyan rapor yok.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{r.customerName}</td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>{r.templateName}</td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>{r.repName}</td>
                <td style={tdStyle}>
                  <StatusBadge status={r.status} />
                </td>
                <td style={{ ...tdStyle, color: '#6b6b74', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDateTime(r.createdAt)}
                </td>
                <td style={tdStyle}>
                  <Link
                    href={`/reports/${r.id}`}
                    style={{ color: '#7c3aed', fontWeight: 500, textDecoration: 'none', fontSize: 13 }}
                  >
                    Aç →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        {filtered.length} / {ADMIN_REPORTS_FIXTURE.length} kayıt gösteriliyor
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: AdminReportStatus }) {
  const palette: Record<AdminReportStatus, { label: string; bg: string; color: string }> = {
    completed: { label: 'Tamamlandı', bg: '#d1fae5', color: '#065f46' },
    'in-progress': { label: 'Devam ediyor', bg: '#fef3c7', color: '#92400e' },
    archived: { label: 'Arşiv', bg: '#f1f5f9', color: '#475569' },
  };
  const p = palette[status];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: p.color,
        background: p.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {p.label}
    </span>
  );
}

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 16,
  flexWrap: 'wrap',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  background: '#fff',
};
const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b6b74',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};
