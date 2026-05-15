'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { loginResponseSchema, type LoginResponse } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { PasswordInput } from '@/components/PasswordInput';

// Magic-link landing for a SUPER_ADMIN's invite email. The raw token comes
// from the URL path (`/accept-invite/<token>`). Invitee picks a password
// only — name/surname were already entered by the SUPER_ADMIN in the
// invite modal, so re-asking would double-enter the same fact and
// invite a mismatch. Accept-invite returns a full LoginResponse so we
// transition straight into the authenticated app — invite acceptance IS
// the login event.
export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

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
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      router.replace('/');
    },
  });

  // Surface server-side validation messages (expired token, weak password,
  // already-used token) verbatim where possible — the user otherwise has no
  // way to know why the link failed.
  const errorMessage =
    accept.error instanceof ApiError
      ? accept.error.status === 410
        ? 'Davet bağlantısının süresi dolmuş veya kullanılmış. Lütfen yeni bir davet isteyin.'
        : accept.error.message || 'Davet kabul edilemedi.'
      : accept.error
      ? 'Davet kabul edilemedi. Lütfen tekrar deneyin.'
      : null;

  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= 8 && password === confirm;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) accept.mutate();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }}>
        aisie
      </h1>
      <h2 style={{ fontSize: 18, textAlign: 'center', color: '#0b0b0f' }}>Hesabınızı oluşturun</h2>
      <p style={{ fontSize: 13, textAlign: 'center', color: '#6b6b74', margin: 0 }}>
        Davetinizi kabul etmek için bir şifre belirleyin.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>Yeni şifre (en az 8 karakter)</span>
        <PasswordInput
          name="new-password"
          id="new-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>Şifreyi tekrar girin</span>
        <PasswordInput
          name="confirm-password"
          id="confirm-password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={setConfirm}
        />
      </label>

      {mismatch && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>
          Şifreler eşleşmiyor.
        </p>
      )}

      {errorMessage && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!valid || accept.isPending}
        style={{ ...buttonStyle, opacity: (!valid || accept.isPending) ? 0.6 : 1 }}
      >
        {accept.isPending ? 'Kaydediliyor…' : 'Hesabı oluştur'}
      </button>
    </form>
  );
}

const buttonStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '12px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
};
