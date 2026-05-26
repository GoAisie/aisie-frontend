'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, Calendar, FileText } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListCard } from '@/components/ui/list-card';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import type { Notification } from '@aisie/shared';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
}

// Notification kind → lucide icon mapping. Emoji icons replaced 2026-05-17
// per user feedback ("güncel profesyonel simge"). Add new kinds here as
// backend introduces them; falls back to Bell for unknown kinds.
const KIND_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  calendar_reminder: Calendar,
  report_completed: FileText,
  generic: Bell,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<Notification[]>('/api/v1/notifications?limit=50'),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<Notification>(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old = []) =>
        old.map((n) =>
          n.notification_id === updated.notification_id ? updated : n,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <section className="px-4 pb-20">
      <PageHeader
        title="Bildirimler"
        rightSlot={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              Tümünü okundu işaretle
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="m-0 mt-2 text-[14px] text-muted-foreground">
          Yükleniyor…
        </p>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-8" aria-hidden />}
          message="Henüz bildirim yok."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            const Icon = KIND_ICONS[n.kind] ?? Bell;
            return (
              <li key={n.notification_id} className="list-none">
                <ListCard
                  unread={isUnread}
                  onClick={
                    isUnread
                      ? () => readMutation.mutate(n.notification_id)
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                        isUnread
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-[14px] font-semibold leading-tight text-foreground">
                          {n.title}
                        </strong>
                        {isUnread && (
                          <span
                            aria-hidden
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"
                          />
                        )}
                      </div>
                      {n.body && (
                        <p className="m-0 mt-1 text-[13px] leading-snug text-foreground/80">
                          {n.body}
                        </p>
                      )}
                      <p className="m-0 mt-1.5 text-[12px] text-muted-foreground">
                        {relativeTime(n.created_at)}
                      </p>
                    </div>
                  </div>
                </ListCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
