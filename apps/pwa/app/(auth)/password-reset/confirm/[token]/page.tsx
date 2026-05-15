'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api-client';
import { PasswordInput } from '@/components/PasswordInput';

// Magic-link confirm step. Token is in the URL path; user enters the new
// password. Server returns 200 on success, 410 if token expired/used. Unlike
// accept-invite this does NOT auto-login — user is bounced to /login so they
// confirm the new password works.
export default function PasswordResetConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const confirm = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, newPassword: password },
        skipAuth: true,
      }),
    onSuccess: () => setDone(true),
  });

  const errorMessage =
    confirm.error instanceof ApiError
      ? confirm.error.status === 410
        ? 'Bağlantının süresi dolmuş veya kullanılmış. Lütfen tekrar şifre sıfırlama isteyin.'
        : confirm.error.message || 'Şifre sıfırlanamadı.'
      : confirm.error
      ? 'Şifre sıfırlanamadı. Lütfen tekrar deneyin.'
      : null;

  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const valid = password.length >= 8 && password === confirmPassword;

  if (done) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>aisie</h1>
        <h2 style={{ fontSize: 18, color: '#0b0b0f', margin: 0 }}>Şifreniz güncellendi</h2>
        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>
          Yeni şifrenizle giriş yapabilirsiniz.
        </p>
        <button onClick={() => router.replace('/login')} style={buttonStyle}>
          Giriş ekranına git
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) confirm.mutate();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }}>aisie</h1>
      <h2 style={{ fontSize: 18, textAlign: 'center', color: '#0b0b0f' }}>Yeni şifre belirleyin</h2>

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
          value={confirmPassword}
          onChange={setConfirmPassword}
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
        disabled={!valid || confirm.isPending}
        style={{ ...buttonStyle, opacity: (!valid || confirm.isPending) ? 0.6 : 1 }}
      >
        {confirm.isPending ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
      </button>

      <p style={{ fontSize: 13, textAlign: 'center', color: '#6b6b74', margin: 0 }}>
        <Link href="/login" style={{ color: '#7c3aed', fontWeight: 600 }}>← Giriş ekranı</Link>
      </p>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d4d4d8', borderRadius: 8,
  padding: '10px 12px', fontSize: 15, outline: 'none',
};
const buttonStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
  padding: '12px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
};
