'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
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

const KIND_ICONS: Record<string, string> = {
  calendar_reminder: '📅',
  report_completed: '📄',
  generic: '🔔',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<Notification[]>('/api/v1/notifications?limit=50'),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<Notification>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old = []) =>
        old.map((n) => (n.notification_id === updated.notification_id ? updated : n)),
      );
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <section style={{ padding: '24px 16px 80px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Bildirimler</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            style={{
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, color: '#6b6b74', cursor: 'pointer',
            }}
          >
            Tümünü okundu işaretle
          </button>
        )}
      </header>

      {isLoading ? (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Bildirim yok.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            return (
              <div
                key={n.notification_id}
                onClick={() => { if (isUnread) readMutation.mutate(n.notification_id); }}
                style={{
                  background: isUnread ? '#faf5ff' : '#fff',
                  border: `1px solid ${isUnread ? '#e9d5ff' : '#e5e7eb'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: isUnread ? 'pointer' : 'default',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1.4, flexShrink: 0 }}>
                  {KIND_ICONS[n.kind] ?? KIND_ICONS.generic}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <strong style={{ fontSize: 14, fontWeight: 600, color: '#0b0b0f', lineHeight: 1.3 }}>
                      {n.title}
                    </strong>
                    {isUnread && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#7c3aed',
                        flexShrink: 0, marginTop: 5,
                      }} />
                    )}
                  </div>
                  {n.body && (
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                    {relativeTime(n.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
