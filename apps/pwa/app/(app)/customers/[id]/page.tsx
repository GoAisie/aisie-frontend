import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CUSTOMERS_FIXTURE } from '@/lib/fixtures/customers';
import { formatDate } from '@/lib/format';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = CUSTOMERS_FIXTURE.find((c) => c.id === id);
  if (!customer) notFound();

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <Link href="/customers" style={backLinkStyle}>
        ← Müşteriler
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>{customer.name}</h1>
      <p style={{ margin: 0, color: '#6b6b74', fontSize: 13 }}>{customer.company}</p>

      <dl style={dlStyle}>
        <Field label="Telefon" value={customer.phone} href={`tel:${customer.phone.replace(/\s/g, '')}`} />
        <Field label="E-posta" value={customer.email} href={`mailto:${customer.email}`} />
        <Field
          label="Son iletişim"
          value={customer.lastContactAt ? formatDate(customer.lastContactAt) : 'Henüz iletişim yok'}
        />
      </dl>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 12,
          color: '#075985',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Müşteri geçmişi (rapor listesi + zaman çizelgesi) Faz 3'te eklenecek.
      </div>
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

const dlStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 0,
};
