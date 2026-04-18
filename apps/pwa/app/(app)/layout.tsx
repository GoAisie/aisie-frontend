'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BottomTabs } from '@/components/BottomTabs';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';
import { useSessionStore } from '@/lib/auth/session-store';
import { apiFetch } from '@/lib/api-client';
import { subscribeToPush } from '@/lib/push';
import type { Notification } from '@aisie/shared';

const TAB_BAR_HEIGHT = 64;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const initialized = useSessionStore((s) => s.initialized);
  const router = useRouter();

  const { data: unread = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => apiFetch<Notification[]>('/api/v1/notifications?unread_only=true&limit=50'),
    refetchInterval: false,
    staleTime: 86_400_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (!initialized) return;
    if (!accessToken) {
      router.replace('/login');
    }
  }, [initialized, accessToken, router]);

  useEffect(() => {
    if (accessToken && initialized) {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (key) subscribeToPush(key);
    }
  }, [accessToken, initialized]);

  if (!initialized) return null;
  if (!accessToken) return null;

  const badgeCount = Math.min(unread.length, 9);

  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingBottom: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
      }}
    >
      <Link
        href="/notifications"
        style={{
          position: 'fixed', top: 12, right: 16, zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          background: '#fff', border: '1px solid #e5e7eb',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          textDecoration: 'none',
        }}
        aria-label={unread.length > 0 ? `${unread.length} okunmamış bildirim` : 'Bildirimler'}
      >
        <span style={{ fontSize: 18 }}>🔔</span>
        {badgeCount > 0 && (
          <span
            style={{
              position: 'absolute', top: -4, right: -4,
              background: '#dc2626', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: 1,
              padding: '2px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center',
            }}
          >
            {badgeCount}{unread.length > 9 ? '+' : ''}
          </span>
        )}
      </Link>
      <main>{children}</main>
      <BottomTabs />
      <IosInstallPrompt />
    </div>
  );
}
