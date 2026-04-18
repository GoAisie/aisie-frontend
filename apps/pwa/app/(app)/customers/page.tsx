import Link from 'next/link';
import { CUSTOMERS_FIXTURE } from '@/lib/fixtures/customers';
import { formatDate } from '@/lib/format';

export default function CustomersPage() {
  const customers = CUSTOMERS_FIXTURE;

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
            {customers.length} müşteri · örnek veri
          </p>
        </div>
        <button type="button" style={primaryBtnStyle} disabled>
          + Yeni
        </button>
      </header>

      <ul style={listStyle}>
        {customers.map((c) => (
          <li key={c.id} style={{ listStyle: 'none' }}>
            <Link href={`/customers/${c.id}`} style={cardLinkStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <strong style={{ fontSize: 15, color: '#0b0b0f' }}>{c.name}</strong>
                {c.lastContactAt && (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    Son: {formatDate(c.lastContactAt)}
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>{c.company}</p>
              <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 12, lineHeight: 1.5 }}>
                {c.phone}
                <span style={{ margin: '0 6px' }}>·</span>
                {c.email}
              </p>
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

const cardLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  textDecoration: 'none',
  color: 'inherit',
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
