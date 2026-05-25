'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { BottomTabs } from '@/components/BottomTabs';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';
import { LogoutButton } from '@/components/LogoutButton';
import { ModeToggle } from '@/components/ModeToggle';
import { useSessionStore } from '@/lib/auth/session-store';
import { apiFetch } from '@/lib/api-client';
import { subscribeToPush } from '@/lib/push';
import type { Notification } from '@aisie/shared';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const initialized = useSessionStore((s) => s.initialized);
  const router = useRouter();

  const { data: unread = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiFetch<Notification[]>('/api/v1/notifications?unread_only=true&limit=50'),
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
    <div className="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))]">
      {/* Top-right icon cluster: bell, theme toggle, logout. Single flex
          row keeps positions consistent across breakpoints and removes
          the need for each button to own its own fixed-position state. */}
      <div className="fixed right-4 top-3 z-40 flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label={
            unread.length > 0
              ? `${unread.length} okunmamış bildirim`
              : 'Bildirimler'
          }
          className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all duration-150 hover:bg-muted active:scale-95"
        >
          <Bell className="size-[18px]" aria-hidden />
          {badgeCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-notification px-1.5 text-center text-[10px] font-bold leading-4 text-notification-foreground">
              {badgeCount}
              {unread.length > 9 ? '+' : ''}
            </span>
          )}
        </Link>
        <ModeToggle />
        <LogoutButton />
      </div>

      <main>{children}</main>
      {/* Pilot support hook: long-press-copyable build SHA. Tap-to-copy lets a
          user pinpoint the exact deploy they hit a bug on without us asking
          "hangi sürümdeydiniz" by hand. Positioned just above BottomTabs so it
          never overlaps the nav. */}
      <button
        type="button"
        onClick={() => {
          const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local';
          if (navigator.clipboard) navigator.clipboard.writeText(sha).catch(() => {});
        }}
        title="Sürümü kopyala"
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+4px)] right-3 z-30 rounded-full bg-transparent px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground/60 hover:text-foreground active:scale-95"
        aria-label="Uygulama sürümü"
      >
        v{process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local'}
      </button>
      <BottomTabs />
      <IosInstallPrompt />
    </div>
  );
}
