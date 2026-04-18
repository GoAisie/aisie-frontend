'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { formatDateTime } from '@/lib/format';

type CompanyUser = {
  publicId: string;
  fullName: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'SALES_REP';
};

type UserActivityRow = {
  user_id: string;
  report_count_this_month: number;
  last_active_at: string | null;
};

type UserRow = CompanyUser & {
  reportCountThisMonth: number;
  lastActiveAt: string | null;
};

export default function AdminUsersPage() {
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;

  const { data: companyUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => apiFetch<CompanyUser[]>(`/api/v1/companies/${companyId}/users`),
    enabled: !!companyId,
  });

  const { data: activity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ['user-activity'],
    queryFn: () => apiFetch<UserActivityRow[]>('/api/v1/analytics/user-activity'),
  });

  const isLoading = loadingUsers || loadingActivity;

  const activityMap = new Map(activity.map((a) => [a.user_id, a]));
  const rows: UserRow[] = companyUsers.map((u) => {
    const act = activityMap.get(u.publicId);
    return {
      ...u,
      reportCountThisMonth: act?.report_count_this_month ?? 0,
      lastActiveAt: act?.last_active_at ?? null,
    };
  });

  return (
    <section>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Kullanıcılar</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {isLoading ? 'Yükleniyor…' : `${rows.length} kullanıcı`}
        </p>
      </header>

      {!isLoading && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>E-posta</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Bu ay rapor</th>
                <th style={thStyle}>Son aktivite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.publicId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{u.fullName}</td>
                  <td style={{ ...tdStyle, color: '#6b6b74' }}>{u.email}</td>
                  <td style={tdStyle}>
                    <RoleBadge role={u.role} />
                  </td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {u.reportCountThisMonth}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b6b74' }}>
                    {u.lastActiveAt ? formatDateTime(u.lastActiveAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RoleBadge({ role }: { role: CompanyUser['role'] }) {
  const palette: Record<CompanyUser['role'], { label: string; bg: string; color: string }> = {
    COMPANY_ADMIN: { label: 'Admin',     bg: '#ede9fe', color: '#5b21b6' },
    SALES_REP:     { label: 'Kullanıcı', bg: '#f0fdf4', color: '#166534' },
  };
  const p = palette[role];
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

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b6b74',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };
