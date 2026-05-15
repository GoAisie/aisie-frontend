'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

// Admin "Şirketler" page — SUPER_ADMIN-only company directory + create flow.
// COMPANY_ADMIN never reaches this route (sidebar hides it, and the backend
// GET /companies endpoint 403s without SUPER_ADMIN role).
//
// Create flow is a two-step backend dance: main-service creates the Company
// row in Postgres, then we call report-service to seed the Mongo
// CompanyAIConfig (LLM/STT/TTS providers + notification email). If step 2
// fails, the row still exists in Postgres — the admin can re-run the seed
// via a future "repair" affordance. For pilot the two-step risk is documented
// and accepted.

type CompanyRow = {
  public_id: string;
  name: string;
  short_name: string;
  code: string;
  status: string;
};

type CreateResponse = {
  public_id: string;
  name: string;
  short_name: string;
  slug: string;
  code: string;
  status: string;
  notification_email: string | null;
};

type FormState = {
  name: string;
  notification_email: string;
};

const EMPTY_FORM: FormState = { name: '', notification_email: '' };

export default function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const role = useSessionStore((s) => s.role);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [opError, setOpError] = useState<string | null>(null);

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiFetch<CompanyRow[]>('/api/v1/companies'),
    enabled: role === 'SUPER_ADMIN',
  });

  const createCompany = useMutation({
    mutationFn: async (input: FormState) => {
      const name = input.name.trim();
      const email = input.notification_email.trim();
      // Step 1: Postgres row via main-service.
      const created = await apiFetch<CreateResponse>('/api/v1/companies', {
        method: 'POST',
        body: { name, notification_email: email || null },
      });
      // Step 2: Mongo CompanyAIConfig seed. If this fails the Postgres row
      // is already saved — surface the error so the admin knows the AI
      // config is missing, but don't roll back (rollback would need a DELETE
      // endpoint we don't expose, and the row is still useful for inviting
      // users while config is repaired).
      try {
        await apiFetch(`/api/v1/manage/ai-config/seed-for-company`, {
          method: 'POST',
          body: { company_id: created.public_id, notification_email: email || null },
        });
      } catch (seedErr) {
        const msg = seedErr instanceof Error ? seedErr.message : 'seed başarısız';
        throw new Error(`Şirket oluşturuldu ama AI yapılandırması seed edilemedi: ${msg}`);
      }
      return created;
    },
    onSuccess: () => {
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setOpError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      // OrgPicker also lists companies — keep it in sync so the new
      // company appears in the dropdown without a manual refresh.
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
    },
    onError: (err) =>
      setOpError(err instanceof Error ? err.message : 'Şirket oluşturulamadı.'),
  });

  if (role !== 'SUPER_ADMIN') {
    return (
      <section>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Şirketler</h1>
        <p style={{ marginTop: 12, fontSize: 14, color: '#6b6b74' }}>
          Bu sayfa yalnızca SUPER_ADMIN için erişilebilir.
        </p>
      </section>
    );
  }

  return (
    <section>
      <header
        style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Şirketler</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : `${companies.length} şirket`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); setOpError(null); }}
          style={primaryBtnStyle}
        >
          + Yeni Şirket
        </button>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Şirket listesi yüklenemedi.
        </p>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={thStyle}>Ad</th>
              <th style={thStyle}>Kod</th>
              <th style={thStyle}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && companies.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                  Henüz şirket yok. "+ Yeni Şirket" ile ekleyebilirsin.
                </td>
              </tr>
            )}
            {companies.map((c) => (
              <tr key={c.public_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}><strong style={{ fontWeight: 600 }}>{c.name}</strong></td>
                <td style={{ ...tdStyle, color: '#6b6b74', fontFamily: 'monospace', fontSize: 12 }}>{c.code}</td>
                <td style={tdStyle}>
                  <span style={statusBadgeStyle(c.status)}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <CompanyFormModal
          value={form}
          onChange={setForm}
          onCancel={() => { setShowAdd(false); setOpError(null); }}
          onSubmit={() => createCompany.mutate(form)}
          isPending={createCompany.isPending}
          error={opError}
        />
      )}
    </section>
  );
}

function CompanyFormModal({
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
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Yeni Şirket</h3>

        <label style={fieldStyle}>
          <span style={labelStyle}>Şirket adı *</span>
          <input
            type="text"
            required
            autoFocus
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Bildirim e-postası</span>
          <input
            type="text"
            placeholder="ornek@firma.com (virgülle ayırarak birden fazla)"
            value={value.notification_email}
            onChange={(e) => onChange({ ...value, notification_email: e.target.value })}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Tamamlanan raporlar bu adres(ler)e gönderilir. Boş bırakırsan sonradan
            şirket yapılandırmasından eklenebilir.
          </span>
        </label>

        {error && <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onCancel} style={ghostBtnStyle}>Vazgeç</button>
          <button type="submit" disabled={disabled} style={{ ...primaryBtnStyle, opacity: disabled ? 0.6 : 1 }}>
            {isPending ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const palette = status === 'ACTIVE'
    ? { bg: '#d1fae5', color: '#065f46' }
    : { bg: '#f3f4f6', color: '#475569' };
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.color,
    whiteSpace: 'nowrap',
  };
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
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#6b6b74',
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
  maxWidth: 460,
  width: '100%',
  boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
