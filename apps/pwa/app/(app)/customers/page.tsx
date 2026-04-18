'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
};

export default function CustomersPage() {
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(`/api/v1/manage/companies/${companyId}/customers`),
    enabled: !!companyId,
  });

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Müşteriler</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : `${customers.length} müşteri`}
          </p>
        </div>
        <button type="button" style={primaryBtnStyle} disabled>
          + Yeni
        </button>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14 }}>Müşteri listesi yüklenemedi.</p>
      )}

      {!isLoading && customers.length === 0 && !isError && (
        <p style={{ color: '#6b6b74', fontSize: 14 }}>
          Henüz müşteri yok. Sesli konuşma sırasında yeni müşteriler otomatik eklenir.
        </p>
      )}

      <ul style={listStyle}>
        {customers.map((c) => (
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
    </section>
  );
}

const listStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'not-allowed',
  opacity: 0.6,
};
