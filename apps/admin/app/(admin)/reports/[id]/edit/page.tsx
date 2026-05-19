'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type FieldValue = string | number | boolean | null;

export default function AdminReportEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

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

  // Local edit buffer — initialized from the fetched report once. We never
  // re-sync on every render so the admin's in-flight typing isn't blown away
  // if the query refetches in the background.
  const [draft, setDraft] = useState<Record<string, FieldValue> | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (report && !draft) {
      setDraft({ ...(report.data as Record<string, FieldValue>) });
    }
  }, [report, draft]);

  const update = useMutation({
    mutationFn: (data: Record<string, FieldValue>) =>
      apiFetch<Report>(`/api/v1/reports/${id}`, {
        method: 'PUT',
        body: { data },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report', id] });
      router.push('/reports');
    },
    onError: (err) => {
      setServerError(err instanceof Error ? err.message : 'Kayıt başarısız.');
    },
  });

  if (loadingReport || loadingTemplate) {
    return (
      <section>
        <BackLink href="/reports" label="Raporlar" />
        <p className="m-0 text-[14px] text-muted-foreground">Yükleniyor…</p>
      </section>
    );
  }

  if (errorReport || errorTemplate || !report || !template || !draft) {
    return (
      <section>
        <BackLink href="/reports" label="Raporlar" />
        <p className="m-0 text-[14px] text-destructive">Rapor yüklenemedi.</p>
      </section>
    );
  }

  const customerName =
    typeof report.data?.['customer_name'] === 'string'
      ? (report.data['customer_name'] as string)
      : report.template_name;

  const handleSave = () => {
    setServerError(null);
    update.mutate(draft);
  };

  return (
    <section>
      <BackLink href="/reports" label="Raporlar" />
      <PageHeader
        title={customerName}
        subtitle={`${template.name} · ${report.user_name} · ${formatDateTime(report.created_at)}`}
      />

      {report.is_email_sent && (
        // Correction note — soft warning tone reminding admin that edits
        // trigger a follow-up "[Düzeltme]" email 30s after save.
        <Alert className="mb-4 border-processing-500/40 bg-processing-500/10 [&>svg]:hidden">
          <AlertDescription className="text-foreground">
            Bu rapor daha önce e-posta ile gönderildi
            {(report.email_send_count ?? 0) >= 2 ? ` (${report.email_send_count} kez)` : ''}.
            Düzenleme kaydedildikten 30 saniye sonra{' '}
            <strong>[Düzeltme]</strong> başlıklı bir e-posta otomatik gönderilir.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex max-w-[680px] flex-col gap-4">
        {template.fields.map((field) => (
          <FieldEdit
            key={field.name}
            field={field}
            value={draft[field.name] ?? null}
            onChange={(v) => setDraft({ ...draft, [field.name]: v })}
          />
        ))}
      </div>

      {serverError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        <Button
          asChild
          variant="ghost"
          onClick={() => router.push('/reports')}
        >
          <span>Vazgeç</span>
        </Button>
      </div>
    </section>
  );
}

function FieldEdit({
  field,
  value,
  onChange,
}: {
  field: FieldSchema;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5 transition-colors hover:bg-muted/30">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-brand-600"
        />
        <span className="text-[13px] text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </span>
      </label>
    );
  }

  if (field.type === 'single-select') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12.5px] text-muted-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <select
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 rounded-md border border-input bg-card px-3 text-[14px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— seçin —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    field.type === 'number'
      ? 'number'
      : field.type === 'date'
        ? 'date'
        : field.type === 'time'
          ? 'time'
          : 'text';

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12.5px] text-muted-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Input
        type={inputType}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number') onChange(raw === '' ? null : Number(raw));
          else onChange(raw === '' ? null : raw);
        }}
      />
    </div>
  );
}
