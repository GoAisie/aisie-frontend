'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema, type LoginResponse } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      setSession({ accessToken: data.accessToken, user: data.user });
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

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>E-posta</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#6b6b74' }}>Şifre</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
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

      <p style={{ fontSize: 13, textAlign: 'center', color: '#6b6b74' }}>
        Şirketiniz için yeni hesap mı lazım?{' '}
        <Link href="/register" style={{ color: '#7c3aed', fontWeight: 600 }}>
          Kayıt olun
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
