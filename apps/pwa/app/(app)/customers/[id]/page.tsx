'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(`/api/v1/manage/companies/${companyId}/customers`),
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#6b6b74', fontSize: 14, marginTop: 12 }}>Yükleniyor…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Müşteri bilgisi yüklenemedi.</p>
      </section>
    );
  }

  const customer = customers.find((c) => c.customer_id === id);

  if (!customer) {
    return (
      <section style={{ padding: '24px 16px 8px' }}>
        <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>
        <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12 }}>Müşteri bulunamadı.</p>
      </section>
    );
  }

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <Link href="/customers" style={backLinkStyle}>← Müşteriler</Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>{customer.name}</h1>

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
        {!customer.phone_number && !customer.email && (
          <p style={{ color: '#6b6b74', fontSize: 14 }}>İletişim bilgisi bulunmuyor.</p>
        )}
      </dl>
    </section>
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

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 0',
  fontSize: 13,
  color: '#7c3aed',
  textDecoration: 'none',
  fontWeight: 500,
};
