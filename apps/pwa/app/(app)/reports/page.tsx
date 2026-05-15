'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportStatus } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

// SALES_REPs see their own reports here, including in-progress rows. The
// "Sil" action is only offered on `status="in-progress"` rows: completed
// reports were already emailed to the customer and are part of the audit
// trail, so only admin can clean those. Backend enforces the same rule
// (status="in-progress" filter on the user-scoped path) — UI gating is a
// UX nicety, not a security boundary.

type DeleteTarget = {
  id: string;
  displayName: string;
};

type StatusFilter = 'all' | 'in-progress';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD; empty = no date filter

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<Report[]>('/api/v1/reports?limit=50'),
  });

  // Composite client-side filter: status pill + single-day date + keyword
  // search. Pilot scale (<= 50 reports per rep) keeps this cheap — no need
  // for server-side filtering. Substring is case-insensitive; date uses
  // local YYYY-MM-DD slice to match the <input type="date"> value format.
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (dateFilter) {
        const reportDay = (r.created_at ?? '').slice(0, 10);
        if (reportDay !== dateFilter) return false;
      }
      if (!q) return true;
      const customerName =
        typeof r.data?.['customer_name'] === 'string' ? r.data['customer_name'] : '';
      const haystack = [
        customerName,
        r.subject_customer_name ?? '',
        r.template_name,
        ...Object.values(r.data ?? {}).map((v) =>
          v === null || v === undefined ? '' : String(v)
        ),
      ]
        .join(' \u0001 ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, search, statusFilter, dateFilter]);

  const isFiltered = statusFilter !== 'all' || dateFilter !== '' || search.trim() !== '';

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/v1/reports/${id}/soft-delete`, { method: 'POST' }),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) =>
      setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Raporlar</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {isLoading ? 'Yükleniyor…' : `${filteredReports.length} / ${reports.length} rapor`}
        </p>
      </header>

      <input
        type="search"
        placeholder="Ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchStyle}
      />

      {/* Filter bar: status pills + date input. Two rows on narrow screens
          via flex-wrap so the pills don't shrink below their text width. */}
      <div style={filterBarStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={pillStyle(statusFilter === 'all')}
            aria-pressed={statusFilter === 'all'}
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in-progress')}
            style={pillStyle(statusFilter === 'in-progress')}
            aria-pressed={statusFilter === 'in-progress'}
          >
            Devam ediyor
          </button>
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Tarih filtresi"
          style={dateInputStyle}
        />
        {isFiltered && (
          <button
            type="button"
            onClick={() => { setStatusFilter('all'); setDateFilter(''); setSearch(''); }}
            style={clearFilterBtnStyle}
          >
            Temizle
          </button>
        )}
      </div>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14 }}>Raporlar yüklenemedi.</p>
      )}

      {!isLoading && reports.length > 0 && filteredReports.length === 0 && (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Filtreyle eşleşen rapor yok.</p>
      )}

      <ul style={listStyle}>
        {filteredReports.map((r) => {
          // customer_name is the conventional field name set by entity_type:"customer"
          // templates; fall back to template_name if the field is absent or not a string.
          const customerName =
            typeof r.data?.['customer_name'] === 'string' ? r.data['customer_name'] : null;
          const displayName = customerName ?? r.template_name;
          return (
            <li key={r.report_id} style={{ listStyle: 'none' }}>
              <div style={cardStyle}>
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
                      {displayName}
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
                {r.status === 'in-progress' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDelete({ id: r.report_id, displayName });
                      setDeleteError(null);
                    }}
                    aria-label={`${displayName} raporunu sil`}
                    style={deleteBtnStyle}
                  >
                    Sil
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pendingDelete && (
        <ConfirmModal
          title={`"${pendingDelete.displayName}" raporunu sil`}
          body="Bu rapor liste görünümünden gizlenecek. Devam edilsin mi?"
          confirmLabel={softDelete.isPending ? 'Siliniyor…' : 'Sil'}
          confirmDisabled={softDelete.isPending}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={() => softDelete.mutate(pendingDelete.id)}
          error={deleteError}
        />
      )}
    </section>
  );
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  'in-progress': 'Devam ediyor',
  completed: 'Tamamlandı',
};

const STATUS_STYLE: Record<ReportStatus, { color: string; background: string }> = {
  'in-progress': { color: '#92400e', background: '#fef3c7' },
  completed: { color: '#065f46', background: '#d1fae5' },
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

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmDisabled,
  onCancel,
  onConfirm,
  error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmDisabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={modalCardStyle}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0b0b0f' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.45 }}>
          {body}
        </p>
        {error && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#dc2626' }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={ghostBtnStyle}>
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{ ...dangerBtnStyle, padding: '8px 16px', opacity: confirmDisabled ? 0.6 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  marginBottom: 10,
  boxSizing: 'border-box',
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

const dateInputStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  background: '#fff',
  color: '#0b0b0f',
};

const clearFilterBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#7c3aed',
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 8px',
  cursor: 'pointer',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid ' + (active ? '#7c3aed' : '#e5e7eb'),
    background: active ? '#7c3aed' : '#fff',
    color: active ? '#fff' : '#374151',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
};

const cardLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '12px 14px',
  flex: 1,
  minWidth: 0,
  textDecoration: 'none',
  color: 'inherit',
};

const deleteBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#dc2626',
  border: 'none',
  borderLeft: '1px solid #f1f5f9',
  padding: '0 16px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dangerBtnStyle: React.CSSProperties = {
  background: '#fff',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b6b74',
  border: 'none',
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(15,16,25,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const modalCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
