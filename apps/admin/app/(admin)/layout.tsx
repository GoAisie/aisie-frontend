'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useSessionStore } from '@/lib/auth/session-store';

// Client-side role guard. Waits for initialize() to settle before redirecting
// so a page-reload silent-refresh doesn't race against the guard check.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const accessToken = useSessionStore((s) => s.accessToken);
  const initialized = useSessionStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    // SUPER_ADMIN + COMPANY_ADMIN are admins of the admin panel. Other roles
    // (SALES_REP, SALES_MANAGER) bounce to /login with a forbidden marker.
    if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
      router.replace('/login?error=forbidden');
    }
  }, [initialized, accessToken, role, router]);

  if (!initialized) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
      </div>
    );
  }

  if (!accessToken || (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN')) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Yetki kontrol ediliyor…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          padding: 32,
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
