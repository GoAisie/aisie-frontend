'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { useSessionStore } from '@/lib/auth/session-store';

// Client-side role guard. Server-side (httpOnly-cookie JWT + decode-in-RSC)
// is planned for the post-Faz-3 hardening pass; until then we get the same
// user-visible protection by redirecting anyone without COMPANY_ADMIN here.
// The guard runs in useEffect so the initial render can't flash admin UI.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useSessionStore((s) => s.role);
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    if (role !== 'COMPANY_ADMIN') {
      router.replace('/login?error=forbidden');
    }
  }, [accessToken, role, router]);

  if (!accessToken || role !== 'COMPANY_ADMIN') {
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
