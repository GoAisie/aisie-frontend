'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  StatusBadge,
  type ReportStatus,
} from '@/components/ui/status-badge';
import type { Report } from '@aisie/shared';

// SALES_REPs see their own reports here, including in-progress rows. The
// "Sil" action is only offered on `status="in-progress"` rows: completed
// reports were already emailed to the customer and are part of the audit
// trail, so only admin can clean those. Backend enforces the same rule
// (status="in-progress" filter on the user-scoped path) — UI gating is a
// UX nicety, not a security boundary.

type DeleteTarget = {
  id: string;
  displayName: string;
};

type StatusFilter = 'all' | 'in-progress';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD; empty = no date filter

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<Report[]>('/api/v1/reports?limit=50'),
  });

  // Composite client-side filter: status pill + single-day date + keyword
  // search. Pilot scale (<= 50 reports per rep) keeps this cheap — no need
  // for server-side filtering. Substring is case-insensitive; date uses
  // local YYYY-MM-DD slice to match the <input type="date"> value format.
  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (dateFilter) {
        const reportDay = (r.created_at ?? '').slice(0, 10);
        if (reportDay !== dateFilter) return false;
      }
      if (!q) return true;
      const customerName =
        typeof r.data?.['customer_name'] === 'string'
          ? r.data['customer_name']
          : '';
      const haystack = [
        customerName,
        r.subject_customer_name ?? '',
        r.template_name,
        ...Object.values(r.data ?? {}).map((v) =>
          v === null || v === undefined ? '' : String(v),
        ),
      ]
        .join(' \u0001 ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, search, statusFilter, dateFilter]);

  const isFiltered =
    statusFilter !== 'all' || dateFilter !== '' || search.trim() !== '';

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/v1/reports/${id}/soft-delete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) =>
      setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  return (
    <section className="px-4 pt-15 pb-2">
      <PageHeader
        title="Raporlar"
        subtitle={
          isLoading
            ? 'Yükleniyor…'
            : `${filteredReports.length} / ${reports.length} rapor`
        }
      />

      <Input
        type="search"
        placeholder="Ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2.5"
      />

      {/* Filter bar — flex-wrap keeps pills tight on narrow screens. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Tümü"
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <FilterChip
          label="Devam ediyor"
          active={statusFilter === 'in-progress'}
          onClick={() => setStatusFilter('in-progress')}
        />
        <DatePicker
          value={dateFilter}
          onChange={setDateFilter}
          ariaLabel="Tarih filtresi"
          placeholder="Tarih seç"
        />
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setDateFilter('');
              setSearch('');
            }}
            className="text-brand-600 hover:text-brand-700"
          >
            Temizle
          </Button>
        )}
      </div>

      {isError && (
        <p className="m-0 text-[14px] text-destructive">
          Raporlar yüklenemedi.
        </p>
      )}

      {!isLoading && reports.length === 0 && (
        <EmptyState message="Henüz rapor yok." />
      )}

      {!isLoading &&
        reports.length > 0 &&
        filteredReports.length === 0 && (
          <p className="m-0 text-[14px] text-muted-foreground">
            Filtreyle eşleşen rapor yok.
          </p>
        )}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {filteredReports.map((r) => {
          // customer_name is the conventional field name set by
          // entity_type:"customer" templates; fall back to template_name
          // when absent or not a string.
          const customerName =
            typeof r.data?.['customer_name'] === 'string'
              ? r.data['customer_name']
              : null;
          const displayName = customerName ?? r.template_name;
          // Defensive coerce — backend may emit legacy statuses we don't
          // surface; treat anything non-completed as in-progress.
          const badgeStatus: ReportStatus =
            r.status === 'completed' ? 'completed' : 'in-progress';
          return (
            <li key={r.report_id} className="list-none">
              <div className="flex overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-brand-200/70 to-brand-100/40 transition-all hover:from-brand-300/70 hover:to-brand-200/50 dark:from-brand-800/60 dark:to-brand-900/40 dark:hover:from-brand-700/70 dark:hover:to-brand-800/50">
                <Link
                  href={`/reports/${r.report_id}`}
                  className="block min-w-0 flex-1 px-3.5 py-3 text-foreground no-underline active:scale-[0.995]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="text-[15px] font-semibold leading-tight text-foreground">
                      {displayName}
                    </strong>
                    <StatusBadge status={badgeStatus} />
                  </div>
                  {customerName && (
                    <p className="m-0 mt-1 text-[13px] text-muted-foreground">
                      {r.template_name}
                    </p>
                  )}
                  <p className="m-0 mt-1 text-[12px] text-muted-foreground/80">
                    {formatDateTime(r.created_at)}
                  </p>
                </Link>
                {r.status === 'in-progress' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDelete({ id: r.report_id, displayName });
                      setDeleteError(null);
                    }}
                    aria-label={`${displayName} raporunu sil`}
                    className="flex items-center gap-1.5 border-l border-border px-4 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10 active:scale-95"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Sil
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          {pendingDelete && (
            <>
              <DialogHeader>
                <DialogTitle>
                  "{pendingDelete.displayName}" raporunu sil
                </DialogTitle>
                <DialogDescription>
                  Bu rapor liste görünümünden gizlenecek. Devam edilsin mi?
                </DialogDescription>
              </DialogHeader>
              {deleteError && (
                <p className="m-0 text-[13px] text-destructive">
                  {deleteError}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingDelete(null);
                    setDeleteError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="destructive"
                  disabled={softDelete.isPending}
                  onClick={() => softDelete.mutate(pendingDelete.id)}
                >
                  {softDelete.isPending ? 'Siliniyor…' : 'Sil'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
