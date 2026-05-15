'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  to_be_deleted?: boolean;
};

export default function AdminTemplatesPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ReportTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiFetch<ReportTemplate[]>('/api/v1/manage/templates'),
  });

  const softDelete = useMutation({
    mutationFn: (baseId: string) =>
      apiFetch<{ ok: true }>(`/api/v1/manage/templates/${baseId}/soft-delete`, { method: 'POST' }),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
    },
    onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  return (
    <section>
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Şablonlar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : `${templates.length} şablon`}
          </p>
        </div>
        <Link href="/templates/new" style={primaryLinkStyle}>+ Yeni Şablon</Link>
      </header>

      {isError && <p style={{ color: '#dc2626', fontSize: 14 }}>Şablonlar yüklenemedi.</p>}

      {!isLoading && !isError && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>Versiyon</th>
                <th style={thStyle}>Alan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={`${t.base_id}-${t.version}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{t.name}</td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>v{t.version}</td>
                  <td style={{ ...tdStyle, color: '#6b6b74', fontVariantNumeric: 'tabular-nums' }}>{t.fields.length}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <Link href={`/templates/${t.base_id}/edit`} style={smallLinkStyle}>Düzenle</Link>
                    <button
                      type="button"
                      onClick={() => { setPendingDelete(t); setDeleteError(null); }}
                      style={{ ...dangerBtnStyle, marginLeft: 8 }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, color: '#6b6b74', textAlign: 'center' }}>Henüz şablon yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <ConfirmModal
          title={`"${pendingDelete.name}" şablonunu sil`}
          body={`Bu şablon liste görünümünden gizlenecek. Mevcut raporlar etkilenmez. Devam edilsin mi?`}
          confirmLabel={softDelete.isPending ? 'Siliniyor…' : 'Sil'}
          onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
          onConfirm={() => softDelete.mutate(pendingDelete.base_id)}
          confirmDisabled={softDelete.isPending}
          error={deleteError}
        />
      )}
    </section>
  );
}

function ConfirmModal({
  title, body, confirmLabel, onCancel, onConfirm, confirmDisabled, error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
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
          <button type="button" onClick={onConfirm} disabled={confirmDisabled} style={{ ...dangerBtnStyle, padding: '8px 16px', opacity: confirmDisabled ? 0.6 : 1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, fontWeight: 600,
  color: '#6b6b74', textTransform: 'uppercase', letterSpacing: 0.4,
};
const tdStyle: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };
const primaryLinkStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', borderRadius: 8,
  padding: '10px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
};
const smallLinkStyle: React.CSSProperties = {
  fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontWeight: 600,
};
const dangerBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#dc2626', border: '1px solid #fecaca',
  borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#6b6b74', border: 'none',
  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
};
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'rgba(15,16,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20,
  maxWidth: 420, width: '100%', boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
};
