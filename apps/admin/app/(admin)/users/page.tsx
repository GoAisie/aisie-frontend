'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
    queryFn: () =>
      apiFetch<CompanyUser[]>(`/api/v1/companies/${effectiveCompanyId}/users`),
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
    onError: (err) =>
      setInviteError(err instanceof Error ? err.message : 'Davet başarısız.'),
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
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'İşlem başarısız.'),
  });

  const softDelete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setPendingAction(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['company-users', effectiveCompanyId] });
    },
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'Silme başarısız.'),
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
      <PageHeader
        title="Kullanıcılar"
        subtitle={isLoading ? 'Yükleniyor…' : `${rows.length} kullanıcı`}
        rightSlot={
          isSuperAdmin ? (
            <Button
              onClick={() => {
                setInviteOpen(true);
                setInviteError(null);
                setInviteSuccess(null);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden />
              Davet et
            </Button>
          ) : undefined
        }
      />

      {inviteSuccess && (
        <Alert className="mb-3 border-success/40 bg-success/10">
          <AlertDescription className="text-success">{inviteSuccess}</AlertDescription>
        </Alert>
      )}

      {!isLoading && rows.length === 0 ? (
        <EmptyState message="Henüz kullanıcı yok." />
      ) : (
        !isLoading && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Bu ay rapor</TableHead>
                  <TableHead>Son aktivite</TableHead>
                  {isSuperAdmin && (
                    <TableHead className="text-right">İşlemler</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.publicId}>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge status={u.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {u.reportCountThisMonth}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastActiveAt ? formatDateTime(u.lastActiveAt) : '—'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <RowActions
                          user={u}
                          onAction={(type) => {
                            setPendingAction({ type, user: u });
                            setActionError(null);
                          }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setInviteError(null);
              setInviteSuccess(null);
              invite.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Yeni kullanıcı davet et</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] text-muted-foreground">E-posta</Label>
                <Input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="ornek@firma.com"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-[12.5px] text-muted-foreground">Ad</Label>
                  <Input
                    type="text"
                    required
                    value={inviteForm.firstName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-[12.5px] text-muted-foreground">Soyad</Label>
                  <Input
                    type="text"
                    required
                    value={inviteForm.lastName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] text-muted-foreground">Rol</Label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      role: e.target.value as InviteFormState['role'],
                    })
                  }
                  className="h-9 rounded-md border border-input bg-card px-3 text-[14px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="SALES_REP">Satış Kullanıcısı</option>
                  <option value="COMPANY_ADMIN">Şirket Yöneticisi</option>
                </select>
              </div>
            </div>

            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInviteOpen(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={
                  invite.isPending ||
                  !inviteForm.email.trim() ||
                  !inviteForm.firstName.trim() ||
                  !inviteForm.lastName.trim()
                }
              >
                {invite.isPending ? 'Gönderiliyor…' : 'Davet gönder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          {pendingAction && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {pendingAction.type === 'delete'
                    ? `"${pendingAction.user.fullName}" hesabını sil`
                    : pendingAction.type === 'deactivate'
                      ? `"${pendingAction.user.fullName}" hesabını devre dışı bırak`
                      : `"${pendingAction.user.fullName}" hesabını tekrar etkinleştir`}
                </DialogTitle>
                <DialogDescription>
                  {pendingAction.type === 'delete'
                    ? 'Kullanıcı listeden kaldırılacak ve giriş yapamayacak. İşlem geri alınamaz.'
                    : pendingAction.type === 'deactivate'
                      ? "Kullanıcı giriş yapamayacak. Mevcut access token'ı en geç 30 dakika içinde geçersiz olur."
                      : 'Kullanıcı tekrar giriş yapabilir hale gelir.'}
                </DialogDescription>
              </DialogHeader>
              {actionError && (
                <Alert variant="destructive">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingAction(null);
                    setActionError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant={pendingAction.type === 'reactivate' ? 'default' : 'destructive'}
                  disabled={updateStatus.isPending || softDelete.isPending}
                  onClick={handleConfirm}
                >
                  {updateStatus.isPending || softDelete.isPending
                    ? 'İşleniyor…'
                    : pendingAction.type === 'delete'
                      ? 'Sil'
                      : pendingAction.type === 'deactivate'
                        ? 'Devre dışı bırak'
                        : 'Etkinleştir'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RowActions({
  user,
  onAction,
}: {
  user: UserRow;
  onAction: (type: 'deactivate' | 'reactivate' | 'delete') => void;
}) {
  return (
    <div className="inline-flex gap-2">
      {user.status === 'ACTIVE' && (
        <Button variant="ghost" size="xs" onClick={() => onAction('deactivate')}>
          Devre dışı
        </Button>
      )}
      {user.status === 'DEACTIVATED' && (
        <Button variant="ghost" size="xs" onClick={() => onAction('reactivate')}>
          Etkinleştir
        </Button>
      )}
      {user.status === 'INVITED' && (
        <span className="text-[11px] text-muted-foreground">davet bekliyor</span>
      )}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onAction('delete')}
        className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Sil
      </Button>
    </div>
  );
}

const ROLE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN:
    'bg-processing-500/15 text-processing-600 dark:bg-processing-500/20 dark:text-processing-500',
  COMPANY_ADMIN:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  SALES_REP:
    'bg-assistant-500/15 text-assistant-600 dark:bg-assistant-500/25 dark:text-assistant-400',
  SALES_MANAGER:
    'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
};
const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Süper Admin',
  COMPANY_ADMIN: 'Admin',
  SALES_REP: 'Kullanıcı',
  SALES_MANAGER: 'Yönetici',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge className={cn('border-0', ROLE_STYLES[role])}>{ROLE_LABELS[role]}</Badge>
  );
}

const STATUS_STYLES: Record<UserStatus, string> = {
  INVITED:
    'bg-processing-500/15 text-processing-600 dark:bg-processing-500/20',
  ACTIVE:
    'bg-success/15 text-success dark:bg-success/20',
  DEACTIVATED:
    'bg-destructive/10 text-destructive dark:bg-destructive/20',
  DELETED: 'bg-muted text-muted-foreground',
};
const STATUS_LABELS: Record<UserStatus, string> = {
  INVITED: 'Davet bekliyor',
  ACTIVE: 'Aktif',
  DEACTIVATED: 'Devre dışı',
  DELETED: 'Silinmiş',
};

function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge className={cn('border-0', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
