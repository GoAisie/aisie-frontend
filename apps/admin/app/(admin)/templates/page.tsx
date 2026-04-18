'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

type TemplateField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
};

type ReportTemplate = {
  base_id: string;
  version: number;
  name: string;
  fields: TemplateField[];
  is_latest: boolean;
};

export default function AdminTemplatesPage() {
  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiFetch<ReportTemplate[]>('/api/v1/manage/templates'),
  });

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
            {isLoading ? 'Yükleniyor…' : `${templates.length} şablon`}
          </p>
        </div>
        <button type="button" style={primaryBtnStyle} disabled>
          + Yeni Şablon
        </button>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14 }}>Şablonlar yüklenemedi.</p>
      )}

      {!isLoading && !isError && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>Base ID</th>
                <th style={thStyle}>Versiyon</th>
                <th style={thStyle}>Alan sayısı</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={`${t.base_id}-${t.version}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{t.name}</td>
                  <td style={{ ...tdStyle, color: '#6b6b74', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    {t.base_id}
                  </td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>v{t.version}</td>
                  <td style={{ ...tdStyle, color: '#6b6b74', fontVariantNumeric: 'tabular-nums' }}>
                    {t.fields.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
