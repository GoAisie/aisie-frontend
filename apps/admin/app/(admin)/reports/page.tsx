'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, MailCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportStatus } from '@aisie/shared';
import { formatDateTime, isoDay, type Preset } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge, type ReportStatus as BadgeStatus } from '@/components/ui/status-badge';
import { FilterChip } from '@/components/ui/filter-chip';
import {
  DateRangePicker,
  presetToRange,
} from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type StatusFilter = 'all' | ReportStatus;
type SortKey = 'createdAt' | 'displayName' | 'repName';
type SortDir = 'asc' | 'desc';

function toRow(r: Report) {
  const customerName =
    typeof r.data?.['customer_name'] === 'string' ? r.data['customer_name'] : null;
  // Pre-compute a lowercased haystack so the search filter doesn't recurse
  // into `data` on every keystroke. Sales reps typically search by domain
  // words ("demo", "fiyat") that live inside user-typed values, not just the
  // top-level customer/template names.
  const dataHaystack = Object.values(r.data ?? {})
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(' ')
    .toLowerCase();
  return {
    id: r.report_id,
    displayName: customerName ?? r.template_name,
    templateName: r.template_name,
    templateVersionId: r.template_version_id,
    repName: r.user_name,
    status: r.status,
    createdAt: r.created_at,
    emailSent: r.is_email_sent,
    emailSendCount: r.email_send_count ?? 0,
    dataHaystack,
  };
}

type RowType = ReturnType<typeof toRow>;

export default function AdminReportsPage() {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<Preset>('last30');
  const initialRange = useMemo(() => presetToRange('last30'), []);
  const [range, setRange] = useState<{ from: Date; to: Date }>(initialRange);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pendingDelete, setPendingDelete] = useState<RowType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['admin-reports'],
    // Backend caps at le=100. Pilot scale (~50 reports/rep/month) keeps this
    // safe — true pagination is a later-round affordance once volume grows.
    queryFn: () => apiFetch<Report[]>('/api/v1/reports?scope=company&limit=100'),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/v1/reports/${id}/soft-delete`, { method: 'POST' }),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  const rows = useMemo(() => reports.map(toRow), [reports]);

  // Filter option lists are derived from current data so the dropdowns don't
  // list templates/reps that no report uses.
  const reps = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.repName));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const templates = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.templateName));
    return ['all', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = range.from.getTime();
    // Inclusive upper bound: range.to is start-of-day; add 24h-1ms so the last
    // day's reports (created up to 23:59:59) are included.
    const toTs = range.to.getTime() + 86_400_000 - 1;
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (repFilter !== 'all' && r.repName !== repFilter) return false;
      if (templateFilter !== 'all' && r.templateName !== templateFilter) return false;
      const created = new Date(r.createdAt).getTime();
      if (created < fromTs || created > toTs) return false;
      if (
        q &&
        !r.displayName.toLowerCase().includes(q) &&
        !r.templateName.toLowerCase().includes(q) &&
        !r.repName.toLowerCase().includes(q) &&
        !r.dataHaystack.includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, repFilter, templateFilter, search, range]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: string | number = a[sortKey];
      let bv: string | number = b[sortKey];
      if (sortKey === 'createdAt') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const header = ['Müşteri Adı', 'Şablon Adı', 'Kullanıcı', 'Durum', 'Oluşturma', 'E-posta'];
    const lines = [header.join(',')];
    sorted.forEach((r) => {
      const cells = [
        r.displayName,
        r.templateName,
        r.repName,
        r.status === 'completed' ? 'Tamamlandı' : 'Devam ediyor',
        formatDateTime(r.createdAt),
        r.emailSent ? `Gönderildi (${r.emailSendCount}x)` : 'Bekliyor',
      ];
      // RFC 4180 escape: wrap in quotes, double internal quotes. Excel reads
      // a UTF-8 BOM correctly so we prepend one in the download blob below.
      lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raporlar-${isoDay(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <PageHeader
        title="Raporlar"
        subtitle={
          isLoading
            ? 'Yükleniyor…'
            : `${sorted.length} rapor`
        }
        rightSlot={
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={range}
              preset={preset}
              onChange={(next, p) => {
                setRange(next);
                setPreset(p);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={sorted.length === 0}
              className="gap-1.5"
            >
              <Download className="size-4" aria-hidden />
              CSV
            </Button>
          </div>
        }
      />

      {isError && (
        <p className="m-0 mb-4 text-[14px] text-destructive">Raporlar yüklenemedi.</p>
      )}

      {/* Filter rail — keyword search + status chips + rep/template selects */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
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
        <FilterChip
          label="Tamamlandı"
          active={statusFilter === 'completed'}
          onClick={() => setStatusFilter('completed')}
        />
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Kullanıcıya göre filtrele"
        >
          {reps.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'Tüm kullanıcılar' : r}
            </option>
          ))}
        </select>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Şablona göre filtrele"
        >
          {templates.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'Tüm şablonlar' : t}
            </option>
          ))}
        </select>
      </div>

      {!isLoading && sorted.length === 0 ? (
        <EmptyState
          message={
            rows.length === 0
              ? 'Henüz rapor yok.'
              : 'Filtreyle eşleşen rapor yok.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTh label="Müşteri / Şablon" k="displayName" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Kullanıcı" k="repName" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <TableHead>Durum</TableHead>
                <TableHead>E-posta</TableHead>
                <SortableTh label="Oluşturma" k="createdAt" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <TableHead className="w-[140px] text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const badgeStatus: BadgeStatus =
                  r.status === 'completed' ? 'completed' : 'in-progress';
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.displayName}</div>
                      {r.displayName !== r.templateName && (
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {r.templateName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.repName}</TableCell>
                    <TableCell>
                      <StatusBadge status={badgeStatus} />
                    </TableCell>
                    <TableCell>
                      <EmailBadge sent={r.emailSent} count={r.emailSendCount} />
                    </TableCell>
                    <TableCell className="text-muted-foreground/90 tabular-nums">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button asChild variant="ghost" size="xs">
                        <Link href={`/reports/${r.id}/edit`}>Düzenle</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setPendingDelete(r);
                          setDeleteError(null);
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Sil
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
                  &quot;{pendingDelete.displayName}&quot; raporunu sil
                </DialogTitle>
                <DialogDescription>
                  Bu rapor liste görünümünden gizlenecek. Gönderilen e-postalar
                  etkilenmez. Devam edilsin mi?
                </DialogDescription>
              </DialogHeader>
              {deleteError && (
                <p className="m-0 text-[13px] text-destructive">{deleteError}</p>
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

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  const arrow = !active ? '⇅' : sortDir === 'asc' ? '↑' : '↓';
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onClick(k)}>
      {label}{' '}
      <span className={active ? 'ml-1 text-brand-600' : 'ml-1 text-muted-foreground/50'}>
        {arrow}
      </span>
    </TableHead>
  );
}

function EmailBadge({ sent, count }: { sent: boolean; count: number }) {
  if (!sent) {
    return <span className="text-[11.5px] text-muted-foreground">—</span>;
  }
  const isCorrection = count >= 2;
  return (
    <Badge
      variant={isCorrection ? 'default' : 'secondary'}
      className={
        isCorrection
          ? 'gap-1 bg-assistant-500/15 text-assistant-600 dark:bg-assistant-500/25 dark:text-assistant-400'
          : 'gap-1 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
      }
      title={isCorrection ? `${count} kez gönderildi (düzeltmelerle)` : 'Gönderildi'}
    >
      <MailCheck className="size-3" aria-hidden />
      {isCorrection ? `Düzeltme (${count}x)` : 'Gönderildi'}
    </Badge>
  );
}
