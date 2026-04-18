'use client';

import { ADMIN_TEMPLATES_FIXTURE } from '@/lib/fixtures/templates';
import { formatDateTime } from '@/lib/format';

export default function AdminTemplatesPage() {
  const templates = ADMIN_TEMPLATES_FIXTURE;

  return (
    <section>
      <header
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Şablonlar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {templates.length} şablon · düzenleme Faz 3a'da açılacak
          </p>
        </div>
        <button type="button" style={primaryBtnStyle} disabled>
          + Yeni Şablon
        </button>
      </header>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={thStyle}>Ad</th>
              <th style={thStyle}>Base ID</th>
              <th style={thStyle}>Versiyon</th>
              <th style={thStyle}>Alan sayısı</th>
              <th style={thStyle}>Son kullanım</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{t.name}</td>
                <td style={{ ...tdStyle, color: '#6b6b74', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                  {t.baseId}
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>v{t.version}</td>
                <td style={{ ...tdStyle, color: '#6b6b74', fontVariantNumeric: 'tabular-nums' }}>
                  {t.fieldCount}
                </td>
                <td style={{ ...tdStyle, color: '#6b6b74' }}>
                  {t.lastUsedAt ? formatDateTime(t.lastUsedAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b6b74',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'not-allowed',
  opacity: 0.6,
};
