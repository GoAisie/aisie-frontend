'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema, type LoginResponse } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { readAndClearLogoutReason, useSessionStore } from '@/lib/auth/session-store';
import { PasswordInput } from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Reason banner — when the user was redirected here by the auth guard
  // because their refresh token expired/was revoked, we surface a clear
  // explanation instead of letting them stare at a blank form wondering why
  // they were logged out. Read-once on mount so a successful login does not
  // re-display the banner if the user later logs out manually.
  //
  // Why `if (v) setLogoutReason(v)` and not unconditional `setLogoutReason(v)`:
  // `readAndClearLogoutReason` is destructive — it removes the marker after
  // reading. React 19 StrictMode fires effects mount → unmount → remount in
  // dev (parity-with-future-Suspense check), so the second invocation reads
  // null. An unconditional setState would then clobber the first run's value
  // and hide the banner. Conditional set keeps the banner sticky after the
  // first non-null read. Production (no StrictMode double-fire) is unchanged.
  const [logoutReason, setLogoutReason] = useState<'session_expired' | null>(null);
  useEffect(() => {
    const v = readAndClearLogoutReason();
    if (v) setLogoutReason(v);
  }, []);

  const login = useMutation({
    mutationFn: async (): Promise<LoginResponse> => {
      const body = loginRequestSchema.parse({ email, password });
      // skipAuth: login itself mints the token; no Authorization header yet.
      const raw = await apiFetch<unknown>('/auth/login', {
        method: 'POST',
        body,
        skipAuth: true,
      });
      return loginResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      router.replace('/');
    },
  });

  const errorMessage =
    login.error instanceof ApiError && login.error.status === 401
      ? 'E-posta veya şifre hatalı.'
      : login.error
      ? 'Giriş yapılamadı. Lütfen tekrar deneyin.'
      : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        login.mutate();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }}>
        aisie
      </h1>
      <h2 style={{ fontSize: 18, textAlign: 'center', color: '#0b0b0f' }}>Giriş Yap</h2>

      {logoutReason === 'session_expired' && (
        <div
          role="status"
          style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            color: '#92400e',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
          }}
        >
          Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>E-posta</span>
        <input
          type="email"
          name="email"
          id="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>Şifre</span>
        <PasswordInput
          name="password"
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
      </label>

      {errorMessage && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13 }}>
          {errorMessage}
        </p>
      )}

      <button type="submit" disabled={login.isPending} style={buttonStyle}>
        {login.isPending ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </button>

      <p style={{ fontSize: 13, textAlign: 'center', color: '#6b6b74', margin: 0 }}>
        <Link href="/password-reset/request" style={{ color: '#7c3aed', fontWeight: 600 }}>
          Şifremi unuttum
        </Link>
      </p>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 15,
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '12px 16px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
