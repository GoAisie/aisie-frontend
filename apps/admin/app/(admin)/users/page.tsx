'use client';

import { ADMIN_USERS_FIXTURE } from '@/lib/fixtures/users';
import type { AdminUserRow } from '@/lib/fixtures/types';
import { formatDateTime } from '@/lib/format';

export default function AdminUsersPage() {
  const users = ADMIN_USERS_FIXTURE;

  return (
    <section>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Kullanıcılar</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {users.length} kullanıcı · örnek veri (CRUD Faz 3a'da)
        </p>
      </header>

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
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{u.name}</td>
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
    </section>
  );
}

function RoleBadge({ role }: { role: AdminUserRow['role'] }) {
  const palette: Record<AdminUserRow['role'], { label: string; bg: string; color: string }> = {
    COMPANY_ADMIN: { label: 'Yönetici', bg: '#ede9fe', color: '#5b21b6' },
    SALES_MANAGER: { label: 'Satış Müdürü', bg: '#dbeafe', color: '#1e40af' },
    SALES_REP: { label: 'Temsilci', bg: '#f1f5f9', color: '#475569' },
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
