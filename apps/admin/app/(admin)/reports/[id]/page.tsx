'use client';

import Link from 'next/link';
import { useMemo, useState, use } from 'react';
import {
  ADMIN_REPORTS_FIXTURE,
  ADMIN_REPORT_DETAIL_FIXTURE,
} from '@/lib/fixtures/reports';
import type {
  AdminReportDetail,
  AdminReportField,
} from '@/lib/fixtures/types';
import { formatDateTime } from '@/lib/format';

type FieldValue = string | number | boolean | null;
type FormState = Record<string, FieldValue>;

export default function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const detail = useMemo<AdminReportDetail | null>(() => {
    const hit = ADMIN_REPORT_DETAIL_FIXTURE[id];
    if (hit) return hit;
    // Fall back to a minimal shell built from the list row so the route
    // doesn't 404 for the reports that don't have a full detail fixture.
    const row = ADMIN_REPORTS_FIXTURE.find((r) => r.id === id);
    if (!row) return null;
    return {
      ...row,
      templateFields: [
        { name: 'customer_name', label: 'Müşteri Adı', type: 'string', required: true },
        { name: 'notes', label: 'Notlar', type: 'string', required: false },
      ],
      data: { customer_name: row.customerName, notes: '' },
    };
  }, [id]);

  if (!detail) {
    return (
      <div>
        <Link href="/reports" style={backLinkStyle}>
          ← Raporlar
        </Link>
        <p style={{ marginTop: 12, color: '#6b6b74' }}>Rapor bulunamadı.</p>
      </div>
    );
  }

  return <ReportEditor detail={detail} />;
}

function ReportEditor({ detail }: { detail: AdminReportDetail }) {
  const [form, setForm] = useState<FormState>(() => ({ ...detail.data }));
  const [saved, setSaved] = useState(false);

  const setField = (name: string, value: FieldValue) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO(Faz 3a): PUT /api/v1/reports/{id} with validated data.
    setSaved(true);
  };

  return (
    <section>
      <Link href="/reports" style={backLinkStyle}>
        ← Raporlar
      </Link>

      <header style={{ margin: '8px 0 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{detail.customerName}</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          {detail.templateName} · {detail.repName} · {formatDateTime(detail.createdAt)}
        </p>
      </header>

      <form onSubmit={save} style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {detail.templateFields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={form[field.name] ?? null}
            onChange={(v) => setField(field.name, v)}
          />
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 8,
            alignItems: 'center',
          }}
        >
          {saved && (
            <span style={{ fontSize: 13, color: '#059669' }}>
              Kaydedildi (fixture — gerçek kayıt Faz 3a'da).
            </span>
          )}
          <button type="submit" style={buttonStyle}>
            Değişiklikleri Kaydet
          </button>
        </div>
      </form>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AdminReportField;
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
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label}
      <input
        type={inputType}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === 'number') {
            onChange(raw === '' ? null : Number(raw));
          } else {
            onChange(raw === '' ? null : raw);
          }
        }}
        required={field.required}
        style={inputStyle}
      />
    </label>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 0',
  fontSize: 13,
  color: '#7c3aed',
  textDecoration: 'none',
  fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  background: '#fff',
  outline: 'none',
};
const buttonStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
