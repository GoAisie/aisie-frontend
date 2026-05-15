'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';

// Admin customers page — full CRUD over the company's customer list. The
// SUPER_ADMIN can switch acting companies via OrgPicker; effective company
// resolves to the override OR the user's own pinned company.

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type CustomerInput = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

const EMPTY_INPUT: CustomerInput = { name: '', phone_number: '', email: '', notes: '' };

type ModalState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; target: CustomerContact }
  | { kind: 'delete'; target: CustomerContact };

export default function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const sessionUser = useSessionStore((s) => s.user);
  const actingCompanyId = useActingCompanyStore((s) => s.actingCompanyId);
  const effectiveCompanyId = actingCompanyId ?? sessionUser?.companyPublicId ?? null;

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [formInput, setFormInput] = useState<CustomerInput>(EMPTY_INPUT);
  const [opError, setOpError] = useState<string | null>(null);

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['admin-customers', effectiveCompanyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(`/api/v1/manage/companies/${effectiveCompanyId}/customers`),
    enabled: !!effectiveCompanyId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-customers', effectiveCompanyId] });

  const addCustomer = useMutation({
    mutationFn: (input: CustomerInput) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers`,
        {
          method: 'POST',
          body: bodyFromInput(input),
        }
      ),
    onSuccess: () => { setModal({ kind: 'closed' }); setOpError(null); invalidate(); },
    onError: (err) => setOpError(err instanceof Error ? err.message : 'Müşteri eklenemedi.'),
  });

  const editCustomer = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers/${id}`,
        {
          method: 'PUT',
          body: bodyFromInput(input),
        }
      ),
    onSuccess: () => { setModal({ kind: 'closed' }); setOpError(null); invalidate(); },
    onError: (err) => setOpError(err instanceof Error ? err.message : 'Güncellenemedi.'),
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers/${id}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => { setModal({ kind: 'closed' }); setOpError(null); invalidate(); },
    onError: (err) => setOpError(err instanceof Error ? err.message : 'Silinemedi.'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone_number, c.email, c.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [customers, search]);

  return (
    <section>
      <header
        style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Müşteriler</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : `${filtered.length} / ${customers.length} müşteri`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setFormInput(EMPTY_INPUT); setModal({ kind: 'add' }); setOpError(null); }}
          style={primaryBtnStyle}
        >
          + Yeni Müşteri
        </button>
      </header>

      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: '100%', maxWidth: 480 }}
        />
      </div>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Müşteri listesi yüklenemedi.
        </p>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={thStyle}>Ad</th>
              <th style={thStyle}>Telefon</th>
              <th style={thStyle}>E-posta</th>
              <th style={thStyle}>Notlar</th>
              <th style={{ ...thStyle, width: 160, textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                  {customers.length === 0
                    ? 'Henüz müşteri yok. "+ Yeni Müşteri" ile ekleyebilirsin.'
                    : 'Aramayla eşleşen müşteri yok.'}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.customer_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}><strong style={{ fontWeight: 600 }}>{c.name}</strong></td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>{c.phone_number ?? '—'}</td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>{c.email ?? '—'}</td>
                <td style={{ ...tdStyle, color: '#6b6b74', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.notes ?? '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormInput({
                        name: c.name,
                        phone_number: c.phone_number ?? '',
                        email: c.email ?? '',
                        notes: c.notes ?? '',
                      });
                      setModal({ kind: 'edit', target: c });
                      setOpError(null);
                    }}
                    style={smallLinkStyle}
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModal({ kind: 'delete', target: c }); setOpError(null); }}
                    style={{ ...dangerBtnStyle, marginLeft: 8 }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal.kind === 'add' || modal.kind === 'edit') && (
        <CustomerFormModal
          title={modal.kind === 'add' ? 'Yeni Müşteri' : `"${modal.target.name}" düzenle`}
          value={formInput}
          onChange={setFormInput}
          onCancel={() => { setModal({ kind: 'closed' }); setOpError(null); }}
          onSubmit={() => {
            if (modal.kind === 'add') addCustomer.mutate(formInput);
            else editCustomer.mutate({ id: modal.target.customer_id, input: formInput });
          }}
          isPending={addCustomer.isPending || editCustomer.isPending}
          error={opError}
        />
      )}

      {modal.kind === 'delete' && (
        <ConfirmModal
          title={`"${modal.target.name}" sil`}
          body="Bu müşteri kayıtlardan kaldırılacak. Geçmiş raporlar etkilenmez. Devam edilsin mi?"
          confirmLabel={deleteCustomer.isPending ? 'Siliniyor…' : 'Sil'}
          confirmDisabled={deleteCustomer.isPending}
          onCancel={() => { setModal({ kind: 'closed' }); setOpError(null); }}
          onConfirm={() => deleteCustomer.mutate(modal.target.customer_id)}
          error={opError}
        />
      )}
    </section>
  );
}

function bodyFromInput(input: CustomerInput) {
  // Backend expects null for absent optional fields (EmailStr rejects empty
  // strings). Trim to drop whitespace-only "values" that look real to a
  // user but break validation.
  return {
    name: input.name.trim(),
    phone_number: input.phone_number.trim() || null,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
  };
}

function CustomerFormModal({
  title, value, onChange, onCancel, onSubmit, isPending, error,
}: {
  title: string;
  value: CustomerInput;
  onChange: (v: CustomerInput) => void;
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
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{title}</h3>

        <FormField label="Ad *">
          <input
            type="text"
            required
            autoFocus
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Telefon">
          <input
            type="tel"
            value={value.phone_number}
            onChange={(e) => onChange({ ...value, phone_number: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="E-posta">
          <input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Notlar">
          <textarea
            rows={3}
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </FormField>

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

function ConfirmModal({
  title, body, confirmLabel, confirmDisabled, onCancel, onConfirm, error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmDisabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={modalCardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0b0b0f' }}>{title}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#4b5563', lineHeight: 1.45 }}>{body}</p>
        {error && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={ghostBtnStyle}>Vazgeç</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{ ...dangerBtnStyle, padding: '8px 16px', opacity: confirmDisabled ? 0.6 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: '#6b6b74' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  background: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};
const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b6b74',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const smallLinkStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#7c3aed',
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontWeight: 600,
  cursor: 'pointer',
};
const dangerBtnStyle: React.CSSProperties = {
  background: '#fff',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
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
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'rgba(15,16,25,0.45)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20,
  maxWidth: 460, width: '100%', boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
