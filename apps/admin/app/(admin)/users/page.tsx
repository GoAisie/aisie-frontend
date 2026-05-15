'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { formatDateTime } from '@/lib/format';

type UserStatus = 'INVITED' | 'ACTIVE' | 'DEACTIVATED' | 'DELETED';
type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_REP' | 'SALES_MANAGER';

type CompanyUser = {
  publicId: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

type UserActivityRow = {
  user_id: string;
  report_count_this_month: number;
  last_active_at: string | null;
};

type UserRow = CompanyUser & {
  reportCountThisMonth: number;
  lastActiveAt: string | null;
};

type InviteFormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'SALES_REP' | 'COMPANY_ADMIN';
};

const INITIAL_INVITE: InviteFormState = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'SALES_REP',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const sessionUser = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);
  const actingCompanyId = useActingCompanyStore((s) => s.actingCompanyId);
  // SUPER_ADMIN: invite goes to the picked company. COMPANY_ADMIN doesn't see
  // the invite button anyway (gated below), so the fallback is purely defensive.
  const effectiveCompanyId = actingCompanyId ?? sessionUser?.companyPublicId ?? null;

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(INITIAL_INVITE);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<
    | { type: 'deactivate' | 'reactivate' | 'delete'; user: UserRow }
    | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: companyUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['company-users', effectiveCompanyId],
    queryFn: () => apiFetch<CompanyUser[]>(`/api/v1/companies/${effectiveCompanyId}/users`),
    enabled: !!effectiveCompanyId,
  });

  const { data: activity = [], isLoading: loadingActivity } = useQuery({
    queryKey: ['user-activity', effectiveCompanyId],
    queryFn: () => apiFetch<UserActivityRow[]>('/api/v1/analytics/user-activity'),
  });

  const isLoading = loadingUsers || loadingActivity;

  const invite = useMutation({
    mutationFn: () =>
      apiFetch<{ token_public_id: string; email: string; expires_at: string }>(
        '/api/v1/users/invite',
        {
          method: 'POST',
          body: {
            email: inviteForm.email.trim(),
            first_name: inviteForm.firstName.trim(),
            last_name: inviteForm.lastName.trim(),
            role: inviteForm.role,
            company_id: effectiveCompanyId,
          },
        },
      ),
    onSuccess: (res) => {
      setInviteSuccess(`Davet gönderildi: ${res.email}`);
      setInviteForm(INITIAL_INVITE);
      queryClient.invalidateQueries({ queryKey: ['company-users', effectiveCompanyId] });
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : 'Davet başarısız.');
    },
  });

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: 'ACTIVE' | 'DEACTIVATED' }) =>
      apiFetch<{ status: string }>(`/api/v1/users/${vars.id}/status`, {
        method: 'PATCH',
        body: { status: vars.status },
      }),
    onSuccess: () => {
      setPendingAction(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['company-users', effectiveCompanyId] });
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'İşlem başarısız.'),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setPendingAction(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['company-users', effectiveCompanyId] });
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  const activityMap = new Map(activity.map((a) => [a.user_id, a]));
  const rows: UserRow[] = companyUsers
    .filter((u) => u.status !== 'DELETED')
    .map((u) => {
      const act = activityMap.get(u.publicId);
      return {
        ...u,
        reportCountThisMonth: act?.report_count_this_month ?? 0,
        lastActiveAt: act?.last_active_at ?? null,
      };
    });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    invite.mutate();
  };

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      softDelete.mutate(pendingAction.user.publicId);
    } else {
      updateStatus.mutate({
        id: pendingAction.user.publicId,
        status: pendingAction.type === 'reactivate' ? 'ACTIVE' : 'DEACTIVATED',
      });
    }
  };

  return (
    <section>
      <header
        style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Kullanıcılar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
            {isLoading ? 'Yükleniyor…' : `${rows.length} kullanıcı`}
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => { setInviteOpen(true); setInviteError(null); setInviteSuccess(null); }}
            style={primaryBtnStyle}
          >
            + Davet et
          </button>
        )}
      </header>

      {inviteSuccess && (
        <p style={{ marginBottom: 12, fontSize: 13, color: '#065f46' }}>{inviteSuccess}</p>
      )}

      {!isLoading && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>E-posta</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>Bu ay rapor</th>
                <th style={thStyle}>Son aktivite</th>
                {isSuperAdmin && <th style={{ ...thStyle, textAlign: 'right' }}>İşlemler</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} style={{ padding: 32, textAlign: 'center', color: '#6b6b74' }}>
                    Henüz kullanıcı yok.
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.publicId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{u.fullName}</td>
                  <td style={{ ...tdStyle, color: '#6b6b74' }}>{u.email}</td>
                  <td style={tdStyle}><RoleBadge role={u.role} /></td>
                  <td style={tdStyle}><StatusBadge status={u.status} /></td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {u.reportCountThisMonth}
                  </td>
                  <td style={{ ...tdStyle, color: '#6b6b74' }}>
                    {u.lastActiveAt ? formatDateTime(u.lastActiveAt) : '—'}
                  </td>
                  {isSuperAdmin && (
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <RowActions
                        user={u}
                        onAction={(type) => { setPendingAction({ type, user: u }); setActionError(null); }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          form={inviteForm}
          setForm={setInviteForm}
          pending={invite.isPending}
          error={inviteError}
          onCancel={() => setInviteOpen(false)}
          onSubmit={handleInviteSubmit}
        />
      )}

      {pendingAction && (
        <ConfirmModal
          title={
            pendingAction.type === 'delete'
              ? `"${pendingAction.user.fullName}" hesabını sil`
              : pendingAction.type === 'deactivate'
              ? `"${pendingAction.user.fullName}" hesabını devre dışı bırak`
              : `"${pendingAction.user.fullName}" hesabını tekrar etkinleştir`
          }
          body={
            pendingAction.type === 'delete'
              ? 'Kullanıcı listeden kaldırılacak ve giriş yapamayacak. İşlem geri alınamaz (yeniden davet etmeniz gerekir).'
              : pendingAction.type === 'deactivate'
              ? 'Kullanıcı giriş yapamayacak. Mevcut access token\'ı en geç 30 dakika içinde geçersiz olur.'
              : 'Kullanıcı tekrar giriş yapabilir hale gelir.'
          }
          confirmLabel={
            updateStatus.isPending || softDelete.isPending ? 'İşleniyor…' :
            pendingAction.type === 'delete' ? 'Sil' :
            pendingAction.type === 'deactivate' ? 'Devre dışı bırak' : 'Etkinleştir'
          }
          danger={pendingAction.type !== 'reactivate'}
          confirmDisabled={updateStatus.isPending || softDelete.isPending}
          error={actionError}
          onCancel={() => { setPendingAction(null); setActionError(null); }}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  );
}

function RowActions({
  user, onAction,
}: {
  user: UserRow;
  onAction: (type: 'deactivate' | 'reactivate' | 'delete') => void;
}) {
  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      {user.status === 'ACTIVE' && (
        <button type="button" onClick={() => onAction('deactivate')} style={smallBtnStyle}>
          Devre dışı
        </button>
      )}
      {user.status === 'DEACTIVATED' && (
        <button type="button" onClick={() => onAction('reactivate')} style={smallBtnStyle}>
          Etkinleştir
        </button>
      )}
      {user.status === 'INVITED' && (
        <span style={{ fontSize: 11, color: '#6b6b74' }}>davet bekliyor</span>
      )}
      <button type="button" onClick={() => onAction('delete')} style={dangerBtnStyle}>
        Sil
      </button>
    </div>
  );
}

function InviteModal({
  form, setForm, pending, error, onCancel, onSubmit,
}: {
  form: InviteFormState;
  setForm: (f: InviteFormState) => void;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const valid = form.email.trim() && form.firstName.trim() && form.lastName.trim();
  return (
    <div onClick={onCancel} style={modalOverlayStyle}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ ...modalCardStyle, maxWidth: 480 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0b0b0f' }}>
          Yeni kullanıcı davet et
        </h3>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={fieldLabelStyle}>
            E-posta
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
              placeholder="ornek@firma.com"
            />
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ ...fieldLabelStyle, flex: 1 }}>
              Ad
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={{ ...fieldLabelStyle, flex: 1 }}>
              Soyad
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={fieldLabelStyle}>
            Rol
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as InviteFormState['role'] })}
              style={inputStyle}
            >
              <option value="SALES_REP">Satış Kullanıcısı</option>
              <option value="COMPANY_ADMIN">Şirket Yöneticisi</option>
            </select>
          </label>
          {error && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onCancel} style={ghostBtnStyle}>Vazgeç</button>
            <button
              type="submit"
              disabled={!valid || pending}
              style={{ ...primaryBtnStyle, opacity: (!valid || pending) ? 0.6 : 1 }}
            >
              {pending ? 'Gönderiliyor…' : 'Davet gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({
  title, body, confirmLabel, danger, onCancel, onConfirm, confirmDisabled, error,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  error: string | null;
}) {
  const confirmStyle = danger ? dangerBtnStyle : primaryBtnStyle;
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
            style={{ ...confirmStyle, padding: '8px 16px', opacity: confirmDisabled ? 0.6 : 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const palette: Record<UserRole, { label: string; bg: string; color: string }> = {
    SUPER_ADMIN:    { label: 'Süper Admin', bg: '#fef3c7', color: '#92400e' },
    COMPANY_ADMIN:  { label: 'Admin',       bg: '#ede9fe', color: '#5b21b6' },
    SALES_REP:      { label: 'Kullanıcı',   bg: '#f0fdf4', color: '#166534' },
    SALES_MANAGER:  { label: 'Yönetici',    bg: '#dbeafe', color: '#1e40af' },
  };
  const p = palette[role] ?? { label: role, bg: '#f1f5f9', color: '#475569' };
  return <Badge {...p} />;
}

function StatusBadge({ status }: { status: UserStatus }) {
  const palette: Record<UserStatus, { label: string; bg: string; color: string }> = {
    INVITED:     { label: 'Davet bekliyor', bg: '#fef3c7', color: '#92400e' },
    ACTIVE:      { label: 'Aktif',          bg: '#d1fae5', color: '#065f46' },
    DEACTIVATED: { label: 'Devre dışı',     bg: '#fee2e2', color: '#991b1b' },
    DELETED:     { label: 'Silinmiş',       bg: '#f1f5f9', color: '#475569' },
  };
  const p = palette[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' };
  return <Badge {...p} />;
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
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
const fieldLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, color: '#6b6b74',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8', borderRadius: 8,
  padding: '8px 12px', fontSize: 14, background: '#fff', outline: 'none',
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const smallBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#374151', border: '1px solid #d4d4d8',
  borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
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
