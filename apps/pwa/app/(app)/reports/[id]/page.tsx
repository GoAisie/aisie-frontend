'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  StatusBadge,
  type ReportStatus,
} from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';

type FieldValue = string | number | boolean | null;
type FormState = Record<string, FieldValue>;

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: report,
    isLoading: loadingReport,
    isError: errorReport,
  } = useQuery({
    queryKey: ['report', id],
    queryFn: () => apiFetch<Report>(`/api/v1/reports/${id}`),
    enabled: !!id,
  });

  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['report-template', id],
    queryFn: () =>
      apiFetch<ReportTemplate>(`/api/v1/reports/${id}/template`),
    enabled: !!id,
  });

  if (loadingReport || loadingTemplate) {
    return (
      <section className="px-4 pt-15 pb-2">
        <BackLink />
        <p className="m-0 mt-3 text-[14px] text-muted-foreground">
          Yükleniyor…
        </p>
      </section>
    );
  }

  if (errorReport || !report) {
    return (
      <section className="px-4 pt-15 pb-2">
        <BackLink />
        <p className="m-0 mt-3 text-[14px] text-destructive">
          Rapor yüklenemedi.
        </p>
      </section>
    );
  }

  return <ReportEditor report={report} template={template ?? null} id={id} />;
}

function BackLink() {
  // Back link rendered as a bordered Button (outline variant) so it reads
  // as a tappable target rather than a hyperlink — matches the visual
  // weight of "Değişiklikleri Kaydet" etc. action buttons. asChild lets
  // Button apply its styling to the inner <Link> without nesting elements.
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="gap-1.5 text-brand-700 hover:text-brand-800 dark:text-brand-200 dark:hover:text-brand-100"
    >
      <Link href="/reports">
        <ArrowLeft className="size-3.5" aria-hidden />
        Raporlar
      </Link>
    </Button>
  );
}

function ReportEditor({
  report,
  template,
  id,
}: {
  report: Report;
  template: ReportTemplate | null;
  id: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // Initialize only from template fields so backend validation never rejects
  // extra keys stored in report.data (e.g. customer_name is metadata, not a field).
  const [form, setForm] = useState<FormState>(() => {
    const data = report.data as FormState;
    if (!template) return { ...data };
    return Object.fromEntries(
      template.fields.map((f) => [f.name, data[f.name] ?? null]),
    );
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: FormState) =>
      apiFetch<Report>(`/api/v1/reports/${id}`, {
        method: 'PUT',
        body: { data },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['report', id], updated);
      setSavedAt(new Date());
      setErrorMsg(null);
      router.push('/reports');
    },
    onError: (err: Error) => {
      setErrorMsg(err.message ?? 'Kaydedilemedi.');
    },
  });

  const customerName =
    typeof report.data['customer_name'] === 'string'
      ? (report.data['customer_name'] as string)
      : report.template_name;

  // Status taxonomy simplified 2026-05-17 to two values (in-progress /
  // completed). Older 6-state STATUS_LABELS dictionary removed; any legacy
  // status the backend may still emit gets coerced to in-progress for badge
  // display so the UI never shows an unstyled raw string.
  const badgeStatus: ReportStatus =
    report.status === 'completed' ? 'completed' : 'in-progress';

  return (
    <section className="px-4 pt-15 pb-20">
      <BackLink />

      <header className="mb-5 mt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 flex-1 text-[22px] font-bold tracking-tight text-foreground">
            {customerName}
          </h1>
          <StatusBadge status={badgeStatus} />
        </div>
        <p className="m-0 mt-1 text-[13px] text-muted-foreground">
          {report.template_name} · {formatDateTime(report.created_at)}
        </p>
      </header>

      {!template || template.fields.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle px-4 py-4 text-[14px] text-muted-foreground">
          Bu raporun şablon alanları bulunamadı.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="flex flex-col gap-3.5"
        >
          {template.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={form[field.name] ?? null}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, [field.name]: v }));
                setSavedAt(null);
                setErrorMsg(null);
              }}
            />
          ))}

          <div className="mt-2 flex items-center justify-between gap-2.5">
            <div className="text-[13px]">
              {mutation.isPending && (
                <span className="text-muted-foreground">Kaydediliyor…</span>
              )}
              {savedAt && !mutation.isPending && (
                <span className="inline-flex items-center gap-1 text-assistant-600">
                  <Check className="size-3.5" aria-hidden /> Kaydedildi
                </span>
              )}
              {errorMsg && (
                <span className="text-destructive">{errorMsg}</span>
              )}
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="shrink-0"
            >
              {mutation.isPending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldSchema;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  const label = (
    <span className="text-[13px] font-medium text-muted-foreground">
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </span>
  );

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-border accent-brand-600"
        />
        {label}
      </label>
    );
  }

  if (field.type === 'single-select') {
    return (
      <label className="flex flex-col gap-1.5">
        {label}
        <select
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.required}
          className={cn(
            'w-full rounded-md border border-input bg-card px-3 py-2 text-[14px] text-foreground transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <option value="">— seçin —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
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

  // date inputs require exactly "YYYY-MM-DD"; datetime strings
  // ("2026-04-20T00:00:00") returned by older MongoDB records would show
  // empty — strip the time portion.
  const displayValue =
    value === null || value === undefined
      ? ''
      : field.type === 'date'
        ? String(value).slice(0, 10)
        : String(value);

  return (
    <label className="flex flex-col gap-1.5">
      {label}
      <Input
        type={inputType}
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number')
            onChange(raw === '' ? null : Number(raw));
          else onChange(raw === '' ? null : raw);
        }}
        required={field.required}
      />
    </label>
  );
}
