'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge, type ReportStatus as BadgeStatus } from '@/components/ui/status-badge';

type FieldValue = string | number | boolean | null;

export default function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: report, isLoading: loadingReport, isError: errorReport } = useQuery({
    queryKey: ['admin-report', id],
    queryFn: () => apiFetch<Report>(`/api/v1/reports/${id}`),
    enabled: !!id,
  });

  const { data: template, isLoading: loadingTemplate, isError: errorTemplate } = useQuery({
    queryKey: ['admin-report-template', id],
    queryFn: () => apiFetch<ReportTemplate>(`/api/v1/reports/${id}/template`),
    enabled: !!id,
  });

  if (loadingReport || loadingTemplate) {
    return (
      <section>
        <BackLink href="/reports" label="Raporlar" />
        <p className="m-0 text-[14px] text-muted-foreground">Yükleniyor…</p>
      </section>
    );
  }

  if (errorReport || errorTemplate || !report || !template) {
    return (
      <section>
        <BackLink href="/reports" label="Raporlar" />
        <p className="m-0 text-[14px] text-destructive">Rapor yüklenemedi.</p>
      </section>
    );
  }

  const data = report.data as Record<string, FieldValue>;
  const customerName =
    typeof report.data?.['customer_name'] === 'string'
      ? (report.data['customer_name'] as string)
      : report.template_name;
  const badgeStatus: BadgeStatus =
    report.status === 'completed' ? 'completed' : 'in-progress';

  return (
    <section>
      <BackLink href="/reports" label="Raporlar" />
      <PageHeader
        title={customerName}
        subtitle={`${template.name} · ${report.user_name} · ${formatDateTime(report.created_at)}`}
        rightSlot={<StatusBadge status={badgeStatus} />}
      />

      <div className="flex max-w-[680px] flex-col gap-4">
        {template.fields.map((field) => (
          <FieldRead key={field.name} field={field} value={data[field.name] ?? null} />
        ))}
      </div>
    </section>
  );
}

function FieldRead({ field, value }: { field: FieldSchema; value: FieldValue }) {
  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <input
          type="checkbox"
          checked={value === true}
          disabled
          className="size-4 accent-brand-600"
        />
        <span className="text-[13px] text-muted-foreground">{field.label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{field.label}</Label>
      <Input
        value={value === null || value === undefined ? '' : String(value)}
        readOnly
        className="cursor-default bg-muted/40 text-foreground"
      />
    </div>
  );
}
