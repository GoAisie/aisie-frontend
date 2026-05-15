'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportStatus } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

type StatusFilter = 'all' | ReportStatus;
type SortKey = 'createdAt' | 'displayName' | 'repName';
type SortDir = 'asc' | 'desc';

// Flatten the API shape to row data the table actually renders. customer_name
// lives inside the dynamic `data` map; the row reads it once so the sort/filter
// passes don't keep digging.
function toRow(r: Report) {
  const customerName =
    typeof r.data?.['customer_name'] === 'string' ? r.data['customer_name'] : null;
  // Pre-compute a lowercased haystack of every dynamic field value so the
  // search filter doesn't recurse into `data` on every keystroke. Sales reps
  // typically search by domain words ("demo", "fiyat") that live inside
  // user-typed values, not just the customer/template top-level names.
  const dataHaystack = Object.values(r.data ?? {})
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(' ')
    .toLowerCase();
  return {
    id: r.report_id,
    displayName: customerName ?? r.template_name,
    templateName: r.template_name,
    templateVersionId: r.template_version_id,
    repName: r.user_name,
    status: r.status,
    createdAt: r.created_at,
    emailSent: r.is_email_sent,
    emailSendCount: r.email_send_count ?? 0,
    dataHaystack,
  };
}

type RowType = ReturnType<typeof toRow>;

export default function AdminReportsPage() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pendingDelete, setPendingDelete] = useState<RowType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => apiFetch<Report[]>('/api/v1/reports?scope=company&limit=100'),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/v1/reports/${id}/soft-delete`, { method: 'POST' }),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  const rows = useMemo(() => reports.map(toRow), [reports]);

  // Filter option lists are derived from current data so the dropdowns don't
  // list templates/reps that no report uses.
  const reps = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.repName));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const templates = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.templateName));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    // Inclusive upper bound: a "from 2026-05-01 to 2026-05-13" filter should
    // include reports created at 23:59:59 on the 13th.
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (repFilter !== 'all' && r.repName !== repFilter) return false;
      if (templateFilter !== 'all' && r.templateName !== templateFilter) return false;
      if (
        q &&
        !r.displayName.toLowerCase().includes(q) &&
        !r.templateName.toLowerCase().includes(q) &&
        !r.repName.toLowerCase().includes(q) &&
        !r.dataHaystack.includes(q)
      ) {
        return false;
      }
      if (fromTs || toTs) {
        const created = new Date(r.createdAt).getTime();
        if (fromTs && created < fromTs) return false;
        if (toTs && created > toTs) return false;
      }
      return true;
    });
  }, [rows, statusFilter, repFilter, templateFilter, search, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey];
      let bv: string | number = b[sortKey];
      if (sortKey === 'createdAt') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const header = ['Müşteri Adı', 'Şablon Adı', 'Kullanıcı', 'Durum', 'Oluşturma', 'E-posta'];
    const lines = [header.join(',')];
    sorted.forEach((r) => {
      const cells = [
        r.displayName,
        r.templateName,
        r.repName,
        STATUS_PALETTE[r.status]?.label ?? r.status,
        formatDateTime(r.createdAt),
        r.emailSent ? `Gönderildi (${r.emailSendCount}x)` : 'Bekliyor',
      ];
      // RFC 4180 escape: wrap in quotes, double internal quotes. Excel reads
      // a UTF-8 BOM correctly so we prepend one in the download blob below.
      lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raporlar-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <header
        style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Raporlar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : 'Şirket geneli'}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          style={{ ...primaryBtnStyle, opacity: sorted.length === 0 ? 0.5 : 1 }}
        >
          Excel'e Aktar (CSV)
        </button>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Raporlar yüklenemedi.
        </p>
      )}

      <div style={filterBarStyle}>
        <input
          type="search"
          placeholder="Ara..."
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
        </select>
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          style={inputStyle}
        >
          {reps.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'Tüm kullanıcılar' : r}
            </option>
          ))}
        </select>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          style={inputStyle}
        >
          {templates.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'Tüm şablonlar' : t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={inputStyle}
          aria-label="Başlangıç tarihi"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={inputStyle}
          aria-label="Bitiş tarihi"
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <SortableTh label="Müşteri / Şablon" k="displayName" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="Kullanıcı" k="repName" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th style={thStyle}>Durum</th>
              <th style={thStyle}>E-posta</th>
              <SortableTh label="Oluşturma" k="createdAt" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <th style={{ ...thStyle, width: 140, textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                  Filtreye uyan rapor yok.
                </td>
              </tr>
            )}
            {sorted.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{r.displayName}</div>
                  {r.displayName !== r.templateName && (
                    <div style={{ fontSize: 12, color: '#6b6b74', marginTop: 2 }}>{r.templateName}</div>
                  )}
                </td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>{r.repName}</td>
                <td style={tdStyle}>
                  <StatusBadge status={r.status} />
                </td>
                <td style={tdStyle}>
                  <EmailBadge sent={r.emailSent} count={r.emailSendCount} />
                </td>
                <td style={{ ...tdStyle, color: '#6b6b74', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDateTime(r.createdAt)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Link
                    href={`/reports/${r.id}/edit`}
                    style={smallLinkStyle}
                  >
                    Düzenle
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setPendingDelete(r); setDeleteError(null); }}
                    style={{ ...dangerBtnStyle, marginLeft: 8 }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isLoading && (
        <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
          {sorted.length} / {rows.length} kayıt gösteriliyor
        </p>
      )}

      {pendingDelete && (
        <ConfirmModal
          title={`"${pendingDelete.displayName}" raporunu sil`}
          body="Bu rapor liste görünümünden gizlenecek, gönderilen e-postalar etkilenmez. Devam edilsin mi?"
          confirmLabel={softDelete.isPending ? 'Siliniyor…' : 'Sil'}
          onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
          onConfirm={() => softDelete.mutate(pendingDelete.id)}
          confirmDisabled={softDelete.isPending}
          error={deleteError}
        />
      )}
    </section>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  const arrow = !active ? '⇅' : sortDir === 'asc' ? '↑' : '↓';
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onClick(k)}
    >
      {label} <span style={{ marginLeft: 4, color: active ? '#7c3aed' : '#cbd5e1' }}>{arrow}</span>
    </th>
  );
}

function ConfirmModal({
  title, body, confirmLabel, onCancel, onConfirm, confirmDisabled, error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  error: string | null;
}) {
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={modalCardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0b0b0f' }}>{title}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.45 }}>{body}</p>
        {error && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={ghostBtnStyle}>Vazgeç</button>
          <button type="button" onClick={onConfirm} disabled={confirmDisabled} style={{ ...dangerBtnStyle, padding: '8px 16px', opacity: confirmDisabled ? 0.6 : 1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_PALETTE: Partial<Record<ReportStatus, { label: string; bg: string; color: string }>> = {
  completed: { label: 'Tamamlandı', bg: '#d1fae5', color: '#065f46' },
  'in-progress': { label: 'Devam ediyor', bg: '#fef3c7', color: '#92400e' },
};

function StatusBadge({ status }: { status: ReportStatus }) {
  const p = STATUS_PALETTE[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' };
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

function EmailBadge({ sent, count }: { sent: boolean; count: number }) {
  if (!sent) {
    return <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>;
  }
  const isCorrection = count >= 2;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: isCorrection ? '#1e3a8a' : '#065f46',
        background: isCorrection ? '#dbeafe' : '#d1fae5',
        whiteSpace: 'nowrap',
      }}
      title={isCorrection ? `${count} kez gönderildi (düzeltmelerle)` : 'Gönderildi'}
    >
      {isCorrection ? `Düzeltme (${count}x)` : 'Gönderildi'}
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
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const smallLinkStyle: React.CSSProperties = {
  fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontWeight: 600,
};
const dangerBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#dc2626', border: '1px solid #fecaca',
  borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#6b6b74', border: 'none',
  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
};
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'rgba(15,16,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20,
  maxWidth: 420, width: '100%', boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
