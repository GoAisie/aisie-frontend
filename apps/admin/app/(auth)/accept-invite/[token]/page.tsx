'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { loginResponseSchema, type LoginResponse } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Admin-side landing for a COMPANY_ADMIN/SUPER_ADMIN invite. Token from URL
// path. Invitee sets a password (name was set by the inviter). Backend
// returns a full LoginResponse so accept-invite IS the login event — we
// setSession and bounce to /dashboard. Role gate mirrors /login: only
// COMPANY_ADMIN or SUPER_ADMIN may sit on this app; lower roles see a
// friendly message even if EmailService accidentally routes them here.
export default function AdminAcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: async (): Promise<LoginResponse> => {
      const raw = await apiFetch<unknown>('/auth/accept-invite', {
        method: 'POST',
        body: { token, password },
        skipAuth: true,
      });
      return loginResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      const role = useSessionStore.getState().role;
      if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
        useSessionStore.getState().clearSession();
        setRoleError(
          'Bu davet yalnızca yöneticiler içindir. Lütfen davetin doğru kişiye gönderildiğinden emin olun.',
        );
        return;
      }
      router.replace('/dashboard');
    },
  });

  const errorMessage =
    roleError ??
    (accept.error instanceof ApiError
      ? accept.error.status === 410
        ? 'Davet bağlantısının süresi dolmuş veya kullanılmış. Lütfen yeni bir davet isteyin.'
        : accept.error.message || 'Davet kabul edilemedi.'
      : accept.error
        ? 'Davet kabul edilemedi. Lütfen tekrar deneyin.'
        : null);

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const valid = password.length >= 8 && password === confirmPassword;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setRoleError(null);
        if (valid) accept.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-1">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[15px] font-medium text-foreground">Hesabınızı oluşturun</h2>
        <p className="m-0 text-center text-[13px] text-muted-foreground">
          Davetinizi kabul etmek için bir şifre belirleyin.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password" className="text-[13px] text-muted-foreground">
          Yeni şifre (en az 8 karakter)
        </Label>
        <PasswordInput
          name="new-password"
          id="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password" className="text-[13px] text-muted-foreground">
          Şifreyi tekrar girin
        </Label>
        <PasswordInput
          name="confirm-password"
          id="confirm-password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      {mismatch && (
        <Alert variant="destructive">
          <AlertDescription>Şifreler eşleşmiyor.</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={!valid || accept.isPending} className="mt-1 h-10">
        {accept.isPending ? 'Kaydediliyor…' : 'Hesabı oluştur'}
      </Button>
    </form>
  );
}
