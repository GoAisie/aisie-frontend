'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { Report, ReportTemplate, FieldSchema } from '@aisie/shared';
import { formatDateTime } from '@/lib/format';

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
      <div>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ marginTop: 12, color: '#6b6b74', fontSize: 14 }}>Yükleniyor…</p>
      </div>
    );
  }

  if (errorReport || errorTemplate || !report || !template || !draft) {
    return (
      <div>
        <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>
        <p style={{ marginTop: 12, color: '#dc2626', fontSize: 14 }}>Rapor yüklenemedi.</p>
      </div>
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
      <Link href="/reports" style={backLinkStyle}>← Raporlar</Link>

      <header style={{ margin: '8px 0 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{customerName}</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {template.name} · {report.user_name} · {formatDateTime(report.created_at)}
        </p>
      </header>

      {report.is_email_sent && (
        <div style={correctionNoteStyle}>
          Bu rapor daha önce e-posta ile gönderildi
          {(report.email_send_count ?? 0) >= 2 ? ` (${report.email_send_count} kez)` : ''}.
          Düzenleme kaydedildikten 30 saniye sonra <strong>[Düzeltme]</strong> başlıklı bir e-posta otomatik gönderilir.
        </div>
      )}

      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {template.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={draft[field.name] ?? null}
            onChange={(v) => setDraft({ ...draft, [field.name]: v })}
          />
        ))}
      </div>

      {serverError && (
        <p style={{ marginTop: 16, color: '#dc2626', fontSize: 13 }}>{serverError}</p>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          style={{ ...primaryBtnStyle, opacity: update.isPending ? 0.6 : 1 }}
        >
          {update.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <Link href="/reports" style={ghostLinkStyle}>Vazgeç</Link>
      </div>
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
  padding: '8px 12px', fontSize: 14, background: '#fff', outline: 'none',
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const ghostLinkStyle: React.CSSProperties = {
  background: 'transparent', color: '#6b6b74', border: 'none',
  padding: '10px 16px', fontSize: 14, cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center',
};
const correctionNoteStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: '10px 14px',
  borderRadius: 8,
  background: '#fef3c7',
  border: '1px solid #fde68a',
  color: '#92400e',
  fontSize: 13,
  lineHeight: 1.45,
};
