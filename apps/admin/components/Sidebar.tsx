'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useSessionStore } from '@/lib/auth/session-store';

const NAV_ITEMS: Array<{ href: string; label: string; Icon: (props: { active: boolean }) => ReactElement }> = [
  { href: '/dashboard', label: 'Özet', Icon: IconDashboard },
  { href: '/reports', label: 'Raporlar', Icon: IconReports },
  { href: '/templates', label: 'Şablonlar', Icon: IconTemplates },
  { href: '/users', label: 'Kullanıcılar', Icon: IconUsers },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <aside
      aria-label="Ana navigasyon"
      style={{
        width: 240,
        borderRight: '1px solid #e5e7eb',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100dvh',
      }}
    >
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed' }}>aisie</span>
        <span style={{ fontSize: 11, color: '#6b6b74', marginLeft: 6, letterSpacing: 0.5 }}>ADMIN</span>
      </div>

      <nav style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? '#7c3aed' : '#4b5563',
                background: active ? '#f5f3ff' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms',
              }}
            >
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid #f1f5f9', padding: 16 }}>
        {user && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0b0b0f' }}>
              {user.fullName}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b6b74' }}>{user.email}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7c3aed', fontWeight: 500 }}>
              {user.companyName}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: '#4b5563',
            cursor: 'pointer',
          }}
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}

function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#7c3aed' : '#6b6b74'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function IconReports({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#7c3aed' : '#6b6b74'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}
function IconTemplates({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#7c3aed' : '#6b6b74'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function IconUsers({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#7c3aed' : '#6b6b74'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
