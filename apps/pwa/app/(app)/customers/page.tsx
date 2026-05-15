'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

// Customers page: lists every CustomerContact in the company. The backend
// returns conversation-derived contacts AND any added manually via this page.
// Visibility is controlled by `is_visible` on the contact; direct CRUD inserts
// set it true at write time, so a freshly added contact appears immediately.

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type NewCustomerInput = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

const EMPTY_INPUT: NewCustomerInput = { name: '', phone_number: '', email: '', notes: '' };

export default function CustomersPage() {
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerInput>(EMPTY_INPUT);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(`/api/v1/manage/companies/${companyId}/customers`),
    enabled: !!companyId,
  });

  const addCustomer = useMutation({
    mutationFn: (input: NewCustomerInput) =>
      apiFetch<CustomerContact>(`/api/v1/manage/companies/${companyId}/customers`, {
        method: 'POST',
        // Backend expects null for missing optional fields, not empty strings —
        // the empty string would fail EmailStr validation on the email field
        // even when the admin left it intentionally blank.
        body: {
          name: input.name.trim(),
          phone_number: input.phone_number.trim() || null,
          email: input.email.trim() || null,
          notes: input.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      setShowAddModal(false);
      setNewCustomer(EMPTY_INPUT);
      setAddError(null);
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
    },
    onError: (err) =>
      setAddError(err instanceof Error ? err.message : 'Müşteri eklenemedi.'),
  });

  // Client-side filter: pilot scale (< 50 customers per company) is far below
  // any threshold where round-trips matter. Substring match against name,
  // phone, and email — sales reps typically remember partial names or
  // recognise a phone tail.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone_number, c.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [customers, search]);

  return (
    <section style={{ padding: '60px 16px 8px' }}>
      {/* 60px top padding clears the fixed bildirim + logout icons in
          (app)/layout.tsx (top:12 + 36px button height + ~12 breathing room).
          Other PWA pages keep 24px because they don't put right-aligned
          controls on the same row as their title. */}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Müşteriler</h1>
            <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
              {isLoading ? 'Yükleniyor…' : `${filtered.length} / ${customers.length} müşteri`}
            </p>
          </div>
          <button
            type="button"
            style={primaryBtnStyle}
            onClick={() => { setShowAddModal(true); setAddError(null); }}
          >
            + Yeni
          </button>
        </div>
      </header>

      <input
        type="search"
        placeholder="Ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchStyle}
      />

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14 }}>Müşteri listesi yüklenemedi.</p>
      )}

      {!isLoading && customers.length === 0 && !isError && (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>
          Henüz müşteri yok. Sesli konuşma sırasında otomatik eklenir veya yukarıdaki <strong>+ Yeni</strong> ile manuel ekleyebilirsin.
        </p>
      )}

      {!isLoading && customers.length > 0 && filtered.length === 0 && (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>Aramayla eşleşen müşteri yok.</p>
      )}

      <ul style={listStyle}>
        {filtered.map((c) => (
          <li key={c.customer_id}>
            <Link href={`/customers/${c.customer_id}`} style={{ textDecoration: 'none' }}>
              <div style={cardStyle}>
                <strong style={{ fontSize: 15, color: '#0b0b0f' }}>{c.name}</strong>
                {(c.phone_number || c.email) && (
                  <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>
                    {c.phone_number}
                    {c.phone_number && c.email && <span style={{ margin: '0 6px' }}>·</span>}
                    {c.email}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {showAddModal && (
        <AddCustomerModal
          value={newCustomer}
          onChange={setNewCustomer}
          onCancel={() => {
            setShowAddModal(false);
            setNewCustomer(EMPTY_INPUT);
            setAddError(null);
          }}
          onSubmit={() => addCustomer.mutate(newCustomer)}
          isPending={addCustomer.isPending}
          error={addError}
        />
      )}
    </section>
  );
}

function AddCustomerModal({
  value, onChange, onCancel, onSubmit, isPending, error,
}: {
  value: NewCustomerInput;
  onChange: (v: NewCustomerInput) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const trimmed = value.name.trim();
  const disabled = isPending || trimmed.length === 0;
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!disabled) onSubmit(); }}
        role="dialog"
        aria-modal="true"
        style={modalCardStyle}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Yeni Müşteri</h3>

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

const listStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  listStyle: 'none',
};

const cardStyle: React.CSSProperties = {
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
};

const searchStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  marginBottom: 12,
  boxSizing: 'border-box',
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
