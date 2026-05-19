'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime, isoDay, type Preset } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import {
  DateRangePicker,
  presetToRange,
} from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Server fetches up to 200 conversations in the selected range. Pilot scale
// (<50 reps, < tens of conversations per week per rep) easily fits, and
// dropping the manual "Daha Fazla" accumulator side-steps the cache-coupling
// bug where useQuery returned cached data without re-running the side effect
// that populated `accumulated` — re-selecting "Tüm kullanıcılar" after picking
// one rep used to leave the table empty until full page refresh.

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
  const [preset, setPreset] = useState<Preset>('last30');
  const initialRange = useMemo(() => presetToRange('last30'), []);
  const [range, setRange] = useState<{ from: Date; to: Date }>(initialRange);

  const fromIso = isoDay(range.from);
  const toIso = isoDay(range.to);

  const { data: userOptions = [] } = useQuery<UserOption[]>({
    queryKey: ['admin-conversation-users'],
    queryFn: () => apiFetch<UserOption[]>('/api/v1/manage/conversation-users'),
    staleTime: 5 * 60_000,
  });

  // Single-page fetch — react-query handles cache; no manual accumulator.
  // We keep date filtering server-side via the existing `date=YYYY-MM-DD`
  // query param (single-day filter); range filtering is client-side because
  // the legacy endpoint doesn't yet accept ranges. For pilot volume the
  // client filter is cheap and avoids a backend change.
  const { data: rows = [], isFetching, isError, refetch } = useQuery<ConversationRow[]>({
    queryKey: ['admin-conversations', userFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Backend caps at le=100 on /manage/conversations. Pilot scale is far
      // below this; pagination is deferred until the cap actually bites.
      params.set('limit', '100');
      params.set('skip', '0');
      if (userFilter !== 'all') params.set('user_id', userFilter);
      return apiFetch<ConversationRow[]>(
        `/api/v1/manage/conversations?${params.toString()}`,
      );
    },
  });

  const filtered = useMemo(() => {
    const fromTs = range.from.getTime();
    const toTs = range.to.getTime() + 86_400_000 - 1;
    return rows.filter((r) => {
      const created = new Date(r.created_at).getTime();
      return created >= fromTs && created <= toTs;
    });
  }, [rows, range]);

  return (
    <section>
      <PageHeader
        title="Konuşma Geçmişleri"
        subtitle={
          isFetching
            ? 'Yükleniyor…'
            : `${filtered.length} konuşma`
        }
        rightSlot={
          <DateRangePicker
            value={range}
            preset={preset}
            onChange={(next, p) => {
              setRange(next);
              setPreset(p);
            }}
          />
        }
      />

      {isError && (
        <p className="m-0 mb-4 text-[14px] text-destructive">
          Konuşmalar yüklenemedi.
          <Button
            variant="ghost"
            size="xs"
            onClick={() => refetch()}
            className="ml-2"
          >
            Tekrar Dene
          </Button>
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Kullanıcıya göre filtrele"
        >
          <option value="all">Tüm kullanıcılar</option>
          {userOptions.map((u) => (
            <option key={u.user_id} value={u.user_id}>
              {u.user_name}
            </option>
          ))}
        </select>
      </div>

      {!isFetching && filtered.length === 0 ? (
        <EmptyState
          message={
            rows.length === 0
              ? 'Bu aralıkta konuşma yok.'
              : 'Filtreyle eşleşen konuşma yok.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead className="w-[100px] text-center">Rapor</TableHead>
                <TableHead className="w-[100px] text-right">Detay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.conversation_id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{row.user_name}</TableCell>
                  <TableCell className="text-center">
                    {row.report_count === 0 ? (
                      <span className="text-[11.5px] text-muted-foreground">—</span>
                    ) : (
                      <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                        {row.report_count}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="xs" className="gap-1">
                      <Link href={`/conversations/${row.conversation_id}`}>
                        Görüntüle
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
