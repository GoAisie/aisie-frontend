'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

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
      <div>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ marginTop: 12, color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
      </div>
    );
  }

  if (errorReport || errorTemplate || !report || !template) {
    return (
      <div>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ marginTop: 12, color: '#dc2626', fontSize: 14 }}>Rapor yüklenemedi.</p>
      </div>
    );
  }

  return <ReportViewer report={report} template={template} />;
}

function ReportViewer({ report, template }: { report: Report; template: ReportTemplate }) {
  const data = report.data as Record<string, FieldValue>;

  const customerName =
    typeof report.data?.['customer_name'] === 'string'
      ? (report.data['customer_name'] as string)
      : report.template_name;

  return (
    <section>
      <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>

      <header style={{ margin: '8px 0 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{customerName}</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {template.name} · {report.user_name} · {formatDateTime(report.created_at)}
        </p>
      </header>

      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {template.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={data[field.name] ?? null}
            readOnly
          />
        ))}
      </div>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  readOnly = false,
}: {
  field: FieldSchema;
  value: FieldValue;
  onChange?: (v: FieldValue) => void;
  readOnly?: boolean;
}) {
  const label = (
    <span style={{ fontSize: 13, color: '#6b6b74' }}>
      {field.label}
      {field.required && !readOnly && <span style={{ color: '#dc2626' }}> *</span>}
    </span>
  );

  const roStyle: React.CSSProperties = readOnly
    ? { ...inputStyle, background: '#f9fafb', color: '#374151', cursor: 'default' }
    : inputStyle;

  if (field.type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={value === true}
          disabled={readOnly}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.checked)}
          readOnly={readOnly}
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
          disabled={readOnly}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value || null)}
          style={roStyle}
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
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => {
          const raw = e.target.value;
          if (field.type === 'number') onChange?.(raw === '' ? null : Number(raw));
          else onChange?.(raw === '' ? null : raw);
        }}
        style={roStyle}
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
  padding: '8px 12px', fontSize: 14, background: '#fff', outline: 'none',
};
