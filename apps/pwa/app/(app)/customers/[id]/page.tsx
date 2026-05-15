'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

// SALES_REP-side detail view of a single CustomerContact. Read-mostly with
// an inline "Düzenle" affordance so a rep can fix typos / add a missing
// phone — no Sil button on this surface (deletion is admin-only and the
// backend DELETE endpoint enforces SUPER_ADMIN/COMPANY_ADMIN role too).

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type FormState = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', phone_number: '', email: '', notes: '' });
  const [opError, setOpError] = useState<string | null>(null);

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(`/api/v1/manage/companies/${companyId}/customers`),
    enabled: !!companyId,
  });

  const customer = customers.find((c) => c.customer_id === id) ?? null;

  const editCustomer = useMutation({
    mutationFn: (input: FormState) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${companyId}/customers/${id}`,
        {
          method: 'PUT',
          // Empty strings → null so backend EmailStr doesn't reject blank
          // optional fields; same shape as the admin Edit modal.
          body: {
            name: input.name.trim(),
            phone_number: input.phone_number.trim() || null,
            email: input.email.trim() || null,
            notes: input.notes.trim() || null,
          },
        }
      ),
    onSuccess: () => {
      setEditing(false);
      setOpError(null);
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
    },
    onError: (err) =>
      setOpError(err instanceof Error ? err.message : 'Müşteri güncellenemedi.'),
  });

  if (isLoading) {
    return (
      <section style={pageStyle}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#6b6b74', fontSize: 14, marginTop: 12 }}>Yükleniyor…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section style={pageStyle}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Müşteri bilgisi yüklenemedi.</p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section style={pageStyle}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Müşteri bulunamadı.</p>
      </section>
    );
  }

  const openEdit = () => {
    setForm({
      name: customer.name,
      phone_number: customer.phone_number ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    });
    setOpError(null);
    setEditing(true);
  };

  return (
    <section style={pageStyle}>
      <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{customer.name}</h1>
        <button type="button" onClick={openEdit} style={primaryBtnStyle}>Düzenle</button>
      </header>

      <dl style={{ marginTop: 20, padding: 0 }}>
        {customer.phone_number && (
          <Field
            label="Telefon"
            value={customer.phone_number}
            href={`tel:${customer.phone_number.replace(/\s/g, '')}`}
          />
        )}
        {customer.email && (
          <Field
            label="E-posta"
            value={customer.email}
            href={`mailto:${customer.email}`}
          />
        )}
        {customer.notes && (
          <div style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ margin: 0, color: '#6b6b74', fontSize: 13 }}>Notlar</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#0b0b0f', whiteSpace: 'pre-wrap' }}>
              {customer.notes}
            </p>
          </div>
        )}
        {!customer.phone_number && !customer.email && !customer.notes && (
          <p style={{ color: '#6b6b74', fontSize: 14 }}>İletişim bilgisi bulunmuyor.</p>
        )}
      </dl>

      {editing && (
        <EditModal
          value={form}
          onChange={setForm}
          onCancel={() => { setEditing(false); setOpError(null); }}
          onSubmit={() => editCustomer.mutate(form)}
          isPending={editCustomer.isPending}
          error={opError}
        />
      )}
    </section>
  );
}

function EditModal({
  value, onChange, onCancel, onSubmit, isPending, error,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const disabled = isPending || value.name.trim().length === 0;
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!disabled) onSubmit(); }}
        role="dialog"
        aria-modal="true"
        style={modalCardStyle}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Müşteriyi Düzenle</h3>

        <Label text="Ad *">
          <input
            type="text"
            required
            autoFocus
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            style={inputStyle}
          />
        </Label>
        <Label text="Telefon">
          <input
            type="tel"
            value={value.phone_number}
            onChange={(e) => onChange({ ...value, phone_number: e.target.value })}
            style={inputStyle}
          />
        </Label>
        <Label text="E-posta">
          <input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            style={inputStyle}
          />
        </Label>
        <Label text="Notlar">
          <textarea
            rows={3}
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Label>

        {error && <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={ghostBtnStyle}>Vazgeç</button>
          <button type="submit" disabled={disabled} style={{ ...primaryBtnStyle, opacity: disabled ? 0.6 : 1 }}>
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: '#6b6b74' }}>{text}</span>
      {children}
    </label>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <dt style={{ color: '#6b6b74', fontSize: 13 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 14, color: '#0b0b0f' }}>
        {href ? (
          <a href={href} style={{ color: '#7c3aed', textDecoration: 'none' }}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '24px 16px 8px',
};

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 0',
  fontSize: 13,
  color: '#7c3aed',
  textDecoration: 'none',
  fontWeight: 500,
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b6b74',
  border: 'none',
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(15,16,25,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const modalCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
