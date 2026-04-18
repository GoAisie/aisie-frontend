'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

type FieldValue = string | number | boolean | null;
type FormState = Record<string, FieldValue>;

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  'completed':        { label: 'Tamamlandı',     bg: '#dcfce7', color: '#166534' },
  'in-progress':      { label: 'Devam ediyor',   bg: '#fef9c3', color: '#854d0e' },
  'pending-approval': { label: 'Onay bekliyor',  bg: '#dbeafe', color: '#1e40af' },
  'approved':         { label: 'Onaylandı',      bg: '#ede9fe', color: '#5b21b6' },
  'rejected':         { label: 'Reddedildi',     bg: '#fee2e2', color: '#991b1b' },
  'archived':         { label: 'Arşivlendi',     bg: '#f3f4f6', color: '#374151' },
};

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: report, isLoading: loadingReport, isError: errorReport } = useQuery({
    queryKey: ['report', id],
    queryFn: () => apiFetch<Report>(`/api/v1/reports/${id}`),
    enabled: !!id,
  });

  const { data: template, isLoading: loadingTemplate } = useQuery({
    queryKey: ['report-template', id],
    queryFn: () => apiFetch<ReportTemplate>(`/api/v1/reports/${id}/template`),
    enabled: !!id,
  });

  if (loadingReport || loadingTemplate) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ color: '#6b6b74', fontSize: 14, marginTop: 12 }}>Yükleniyor…</p>
      </section>
    );
  }

  if (errorReport || !report) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Rapor yüklenemedi.</p>
      </section>
    );
  }

  return <ReportEditor report={report} template={template ?? null} id={id} />;
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
    return Object.fromEntries(template.fields.map((f) => [f.name, data[f.name] ?? null]));
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: FormState) =>
      apiFetch<Report>(`/api/v1/reports/${id}`, { method: 'PUT', body: { data } }),
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

  const statusMeta = STATUS_LABELS[report.status] ?? { label: report.status, bg: '#f3f4f6', color: '#374151' };

  return (
    <section style={{ padding: '24px 16px 80px' }}>
      <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>

      <header style={{ margin: '8px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>{customerName}</h1>
          <span style={{ ...badgeStyle, background: statusMeta.bg, color: statusMeta.color }}>
            {statusMeta.label}
          </span>
        </div>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {report.template_name} · {formatDateTime(report.created_at)}
        </p>
      </header>

      {!template || template.fields.length === 0 ? (
        <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, fontSize: 14, color: '#6b6b74' }}>
          Bu raporun şablon alanları bulunamadı.
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 }}>
            <div style={{ fontSize: 13 }}>
              {mutation.isPending && <span style={{ color: '#6b7280' }}>Kaydediliyor…</span>}
              {savedAt && !mutation.isPending && (
                <span style={{ color: '#16a34a' }}>✓ Kaydedildi</span>
              )}
              {errorMsg && <span style={{ color: '#dc2626' }}>{errorMsg}</span>}
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{
                ...buttonStyle,
                opacity: mutation.isPending ? 0.6 : 1,
                cursor: mutation.isPending ? 'wait' : 'pointer',
              }}
            >
              {mutation.isPending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
            </button>
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
    <span style={{ fontSize: 13, color: '#6b6b74' }}>
      {field.label}
      {field.required && <span style={{ color: '#dc2626' }}> *</span>}
    </span>
  );

  if (field.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  }

  if (field.type === 'single-select') {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label}
        <select
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.required}
          style={inputStyle}
        >
          <option value="">— seçin —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' :
    field.type === 'date'   ? 'date'   :
    field.type === 'time'   ? 'time'   : 'text';

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label}
      <input
        type={inputType}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number') onChange(raw === '' ? null : Number(raw));
          else onChange(raw === '' ? null : raw);
        }}
        required={field.required}
        style={inputStyle}
      />
    </label>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block', padding: '6px 0',
  fontSize: 13, color: '#7c3aed', textDecoration: 'none', fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, background: '#fff', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
const buttonStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  flexShrink: 0,
};
const badgeStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '3px 9px',
  borderRadius: 999, whiteSpace: 'nowrap',
};
