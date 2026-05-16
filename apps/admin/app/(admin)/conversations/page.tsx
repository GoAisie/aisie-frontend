'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

// Server-paginated list. We accumulate fetched pages into `accumulated` rather
// than asking react-query to merge them — the simpler approach keeps useState
// + a stable cache key per (filter, page) tuple. Each "Daha Fazla" click
// bumps `skip` and triggers a new query; results are appended.
const PAGE_SIZE = 50;

type ConversationRow = {
  conversation_id: string;
  user_id: string;
  user_name: string;
  company_id: string;
  company_name: string;
  created_at: string;
  updated_at: string;
  report_count: number;
  pipeline_complete: boolean;
};

type UserOption = {
  user_id: string;
  user_name: string;
};

export default function AdminConversationsPage() {
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD, empty = no date filter
  const [skip, setSkip] = useState(0);
  const [accumulated, setAccumulated] = useState<ConversationRow[]>([]);

  // User dropdown options. Fetched once and cached; the active-company picker
  // (super admin) will refetch via the company_id header change anyway.
  const { data: userOptions = [] } = useQuery<UserOption[]>({
    queryKey: ['admin-conversation-users'],
    queryFn: () => apiFetch<UserOption[]>('/api/v1/manage/conversation-users'),
  });

  // Page query — re-runs whenever filters or skip change. Results are
  // appended to `accumulated` via the useQuery onSuccess pattern below; we
  // don't render `data` directly because react-query would replace the list
  // on every paginated fetch, defeating the "Load more" UX.
  const {
    data: pageRows = [],
    isFetching,
    isError,
    refetch,
  } = useQuery<ConversationRow[]>({
    queryKey: ['admin-conversations', userFilter, dateFilter, skip],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('skip', String(skip));
      if (userFilter !== 'all') params.set('user_id', userFilter);
      if (dateFilter) params.set('date', dateFilter);
      const rows = await apiFetch<ConversationRow[]>(
        `/api/v1/manage/conversations?${params.toString()}`,
      );
      // Append-on-fetch — first page resets, subsequent pages extend.
      setAccumulated((prev) => (skip === 0 ? rows : [...prev, ...rows]));
      return rows;
    },
  });

  // Reset pagination + accumulator when filters change. Without this the
  // first "Load more" after changing a filter would append wrong-filter rows.
  const resetAndReload = (next: () => void) => {
    setAccumulated([]);
    setSkip(0);
    next();
  };

  const canLoadMore = pageRows.length === PAGE_SIZE;

  return (
    <section>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Konuşma Geçmişleri</h1>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Konuşmalar yüklenemedi.
          <button type="button" onClick={() => refetch()} style={{ marginLeft: 8, ...ghostBtnStyle }}>
            Tekrar Dene
          </button>
        </p>
      )}

      <div style={filterBarStyle}>
        <select
          value={userFilter}
          onChange={(e) => resetAndReload(() => setUserFilter(e.target.value))}
          style={inputStyle}
          aria-label="Kullanıcıya göre filtrele"
        >
          <option value="all">Tüm kullanıcılar</option>
          {userOptions.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => resetAndReload(() => setDateFilter(e.target.value))}
          style={inputStyle}
          aria-label="Tarihe göre filtrele"
        />
        {dateFilter && (
          <button
            type="button"
            onClick={() => resetAndReload(() => setDateFilter(''))}
            style={ghostBtnStyle}
          >
            Tarih filtresini temizle
          </button>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={thStyle}>Tarih</th>
              <th style={thStyle}>Kullanıcı</th>
              <th style={{ ...thStyle, textAlign: 'center', width: 100 }}>Rapor</th>
              <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Detay</th>
            </tr>
          </thead>
          <tbody>
            {accumulated.length === 0 && !isFetching && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                  Filtreye uyan konuşma yok.
                </td>
              </tr>
            )}
            {accumulated.map((row) => (
              <tr key={row.conversation_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, color: '#4b5563', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDateTime(row.created_at)}
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{row.user_name}</div>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <ReportCountBadge count={row.report_count} />
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Link href={`/conversations/${row.conversation_id}`} style={smallLinkStyle}>
                    Görüntüle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#9ca3af' }}>
        <span>{accumulated.length} kayıt yüklendi</span>
        {canLoadMore && (
          <button
            type="button"
            onClick={() => setSkip(accumulated.length)}
            disabled={isFetching}
            style={{ ...primaryBtnStyle, opacity: isFetching ? 0.6 : 1 }}
          >
            {isFetching ? 'Yükleniyor…' : 'Daha Fazla Yükle (50)'}
          </button>
        )}
      </div>
    </section>
  );
}

function ReportCountBadge({ count }: { count: number }) {
  if (count === 0) return <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: '#1e3a8a',
        background: '#dbeafe',
      }}
    >
      {count}
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
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#6b6b74', border: 'none',
  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
};
