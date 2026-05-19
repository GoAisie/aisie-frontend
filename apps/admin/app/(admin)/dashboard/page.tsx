'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '@/lib/api-client';
import {
  formatDateRange,
  formatDateTime,
  formatPercent,
  isoDay,
  type Preset,
} from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DateRangePicker,
  presetToRange,
} from '@/components/ui/date-range-picker';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type SummaryRange = {
  total_reports: number;
  completed_reports: number;
  completion_rate: number;
  prior_total_reports: number;
  prior_completed_reports: number;
  inprogress_reports: number;
  active_customers: number;
  unique_active_users: number;
};

type DailyActivityRow = {
  date: string;
  total: number;
  completed: number;
};

type UserActivityRow = {
  user_id: string;
  report_count_this_month: number;
  last_active_at: string | null;
};

type TemplateDistRow = {
  template_id: string;
  template_name: string;
  report_count: number;
};

type ConversationUser = {
  user_id: string;
  user_name: string;
};

type RecentConversationRow = {
  conversation_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
  report_count: number;
};

// Locale-aware short month label for axis ticks ("13 May" not "13 May 2026").
const tickFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
});

export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>('last30');
  const initialRange = useMemo(() => presetToRange('last30'), []);
  const [range, setRange] = useState<{ from: Date; to: Date }>(initialRange);

  const fromIso = isoDay(range.from);
  const toIso = isoDay(range.to);

  const summary = useQuery({
    queryKey: ['dashboard-summary', fromIso, toIso],
    queryFn: () =>
      apiFetch<SummaryRange>(
        `/api/v1/analytics/summary-range?scope=company&from=${fromIso}&to=${toIso}`,
      ),
  });

  const daily = useQuery({
    queryKey: ['dashboard-daily', fromIso, toIso],
    queryFn: () =>
      apiFetch<DailyActivityRow[]>(
        `/api/v1/analytics/daily-activity?scope=company&from=${fromIso}&to=${toIso}`,
      ),
  });

  const users = useQuery({
    queryKey: ['dashboard-users', fromIso, toIso],
    queryFn: () =>
      apiFetch<UserActivityRow[]>(
        `/api/v1/analytics/user-activity?from=${fromIso}&to=${toIso}`,
      ),
  });

  const templates = useQuery({
    queryKey: ['dashboard-templates', fromIso, toIso],
    queryFn: () =>
      apiFetch<TemplateDistRow[]>(
        `/api/v1/analytics/template-distribution?scope=company&from=${fromIso}&to=${toIso}&limit=5`,
      ),
  });

  // Conversation-users powers the user_id → user_name lookup for the bar
  // chart. Fetched once and cached for the session.
  const userDirectory = useQuery({
    queryKey: ['dashboard-user-directory'],
    queryFn: () =>
      apiFetch<ConversationUser[]>('/api/v1/manage/conversation-users'),
    staleTime: 5 * 60_000,
  });

  const recent = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () =>
      apiFetch<RecentConversationRow[]>('/api/v1/manage/conversations?limit=5'),
    staleTime: 30_000,
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    userDirectory.data?.forEach((u) => m.set(u.user_id, u.user_name));
    return m;
  }, [userDirectory.data]);

  // Bar chart top-5 — sorted desc, names resolved via directory. Fallback to
  // truncated user_id if directory has not loaded or user is missing.
  const topUsers = useMemo(() => {
    const rows = users.data ?? [];
    return [...rows]
      .sort((a, b) => b.report_count_this_month - a.report_count_this_month)
      .slice(0, 5)
      .map((r) => ({
        name: nameById.get(r.user_id) ?? r.user_id.slice(0, 8),
        count: r.report_count_this_month,
      }));
  }, [users.data, nameById]);

  // Series colors — chart-1..5 read from globals.css. Mapping each pie slice
  // to its own slot keeps colors stable across renders.
  const PIE_COLORS = [
    'var(--color-chart-1)',
    'var(--color-chart-2)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-5)',
  ];

  const areaConfig = {
    total: { label: 'Toplam', color: 'var(--color-chart-1)' },
    completed: { label: 'Tamamlandı', color: 'var(--color-chart-2)' },
  } satisfies ChartConfig;

  const barConfig = {
    count: { label: 'Rapor', color: 'var(--color-chart-1)' },
  } satisfies ChartConfig;

  const pieConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    (templates.data ?? []).forEach((t, i) => {
      cfg[t.template_name] = {
        label: t.template_name,
        color: PIE_COLORS[i % PIE_COLORS.length],
      };
    });
    return cfg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.data]);

  // KPI deltas — current period vs prior equal-length period.
  const reportDelta = summary.data
    ? summary.data.total_reports - summary.data.prior_total_reports
    : 0;
  const completedDelta = summary.data
    ? summary.data.completed_reports - summary.data.prior_completed_reports
    : 0;
  const completionDeltaPp = summary.data
    ? (() => {
        const cur = summary.data.completion_rate;
        const prior =
          summary.data.prior_total_reports > 0
            ? summary.data.prior_completed_reports / summary.data.prior_total_reports
            : 0;
        return Math.round((cur - prior) * 100); // percentage points
      })()
    : 0;

  // Compute the prior comparison window so the dashboard can surface "vs
  // önceki dönem" deltas with the actual prior date range, not a hand-wave.
  // Mirrors backend `_resolve_range`'s prior-span math: same length, the
  // window immediately preceding [from, to].
  const priorRange = useMemo(() => {
    const span = range.to.getTime() - range.from.getTime();
    const priorEnd = new Date(range.from.getTime() - 86_400_000); // day before `from`
    priorEnd.setHours(0, 0, 0, 0);
    const priorStart = new Date(priorEnd.getTime() - span);
    priorStart.setHours(0, 0, 0, 0);
    return { from: priorStart, to: priorEnd };
  }, [range]);

  const isLoading = summary.isLoading;

  return (
    <section>
      <PageHeader
        title="Özet"
        subtitle={
          isLoading
            ? 'Yükleniyor…'
            : `${summary.data?.total_reports ?? 0} rapor · ${summary.data?.unique_active_users ?? 0} aktif kullanıcı`
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

      {/* Prior-period note — explains what "↑ vs önceki dönem" actually
         compares against. Without this the deltas read as "vs some unspecified
         past", which forced an "is this right?" question every reload. */}
      <p className="-mt-3 mb-4 text-[12px] text-muted-foreground">
        Karşılaştırma dönemi:{' '}
        <span className="font-medium text-foreground/70">
          {formatDateRange(priorRange.from, priorRange.to)}
        </span>{' '}
        (önceki {Math.round(
          (range.to.getTime() - range.from.getTime()) / 86_400_000,
        ) + 1}{' '}
        gün)
      </p>

      {/* KPI strip — 5 cards. "Yarım kalan" intentionally NOT surfaced here:
         admin doesn't action half-finished reports as a routine task, so the
         card created noise rather than insight. Same rationale removes the
         bottom AlertPill ("yarım kalan rapor müdahale bekliyor"). */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Toplam rapor"
          value={String(summary.data?.total_reports ?? '–')}
          delta={reportDelta}
          deltaLabel="vs önceki dönem"
        />
        <StatCard
          label="Tamamlanan"
          value={String(summary.data?.completed_reports ?? '–')}
          delta={completedDelta}
          deltaLabel="vs önceki dönem"
        />
        <StatCard
          label="Tamamlanma oranı"
          value={summary.data ? formatPercent(summary.data.completion_rate) : '–'}
          subtitle={
            completionDeltaPp > 0
              ? `↑ +${completionDeltaPp}pp`
              : completionDeltaPp < 0
                ? `↓ ${completionDeltaPp}pp`
                : 'değişim yok'
          }
          tone={completionDeltaPp >= 0 ? 'good' : 'bad'}
        />
        <StatCard
          label="Aktif kullanıcı"
          value={String(summary.data?.unique_active_users ?? '–')}
          subtitle="seçili aralıkta"
          tone="neutral"
        />
        <StatCard
          label="Aktif müşteri"
          value={String(summary.data?.active_customers ?? '–')}
          subtitle="şirket geneli"
          tone="neutral"
        />
      </div>

      {/* Section 2: Daily activity area chart */}
      <SectionHeader title="Günlük rapor üretimi" subtitle="Aralık içinde gün gün" />
      <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
        <div className="h-[260px] w-full">
          {daily.isLoading ? (
            <p className="m-0 grid h-full place-items-center text-[13px] text-muted-foreground">
              Yükleniyor…
            </p>
          ) : (daily.data ?? []).every((r) => r.total === 0) ? (
            <EmptyState message="Bu aralıkta rapor yok." />
          ) : (
            <ChartContainer config={areaConfig}>
              <AreaChart
                data={daily.data ?? []}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-completed)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-completed)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => tickFmt.format(new Date(v))}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={28}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v: string) =>
                        new Intl.DateTimeFormat('tr-TR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        }).format(new Date(v))
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  fill="url(#totalFill)"
                  name="total"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--color-completed)"
                  strokeWidth={2}
                  fill="url(#completedFill)"
                  name="completed"
                />
                <Legend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* Section 3: 2-col grid — top users bar + template donut */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm lg:col-span-2">
          <SectionHeader title="En çok rapor üreten kullanıcılar" subtitle="Top 5" className="mt-0" />
          <div className="h-[260px] w-full">
            {users.isLoading ? (
              <p className="m-0 grid h-full place-items-center text-[13px] text-muted-foreground">
                Yükleniyor…
              </p>
            ) : topUsers.length === 0 ? (
              <EmptyState message="Bu aralıkta aktif kullanıcı yok." />
            ) : (
              <>
                {topUsers.length === 1 && (
                  // Bar chart with a single category looks visually bare; an
                  // inline hint explains the data reality so the admin doesn't
                  // mistake it for a rendering bug.
                  <p className="mb-2 text-[12px] text-muted-foreground">
                    Bu aralıkta şirketten yalnızca 1 kullanıcı rapor üretti.
                  </p>
                )}
                <ChartContainer config={barConfig}>
                <BarChart
                  data={topUsers}
                  layout="vertical"
                  margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={110}
                    tick={{ fontSize: 12 }}
                  />
                  <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 6, 6, 0]}
                    name="count"
                  />
                </BarChart>
              </ChartContainer>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <SectionHeader title="Şablon dağılımı" subtitle="En çok kullanılan" className="mt-0" />
          <div className="h-[260px] w-full">
            {templates.isLoading ? (
              <p className="m-0 grid h-full place-items-center text-[13px] text-muted-foreground">
                Yükleniyor…
              </p>
            ) : (templates.data ?? []).length === 0 ? (
              <EmptyState message="Şablon kullanılmamış." />
            ) : (
              <ChartContainer config={pieConfig}>
                <PieChart>
                  <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={templates.data ?? []}
                    dataKey="report_count"
                    nameKey="template_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {(templates.data ?? []).map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="var(--color-card)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Legend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Recent conversations feed */}
      <SectionHeader title="Son konuşmalar" subtitle="Tüm kullanıcılar" />
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
        {recent.isLoading ? (
          <p className="m-0 p-6 text-[13px] text-muted-foreground">Yükleniyor…</p>
        ) : (recent.data ?? []).length === 0 ? (
          <EmptyState message="Konuşma yok." className="m-3" />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {(recent.data ?? []).map((row) => (
              <li
                key={row.conversation_id}
                className="border-b border-border/40 last:border-b-0"
              >
                <Link
                  href={`/conversations/${row.conversation_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-foreground no-underline transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-[14px] font-semibold text-foreground">
                      {row.user_name}
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </p>
                  </div>
                  <span
                    className={
                      row.report_count > 0
                        ? 'rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                        : 'text-[11.5px] text-muted-foreground'
                    }
                  >
                    {row.report_count > 0 ? `${row.report_count} rapor` : '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

    </section>
  );
}
