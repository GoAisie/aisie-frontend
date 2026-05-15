'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

// Public endpoint: always returns 200 even when the email is unknown — the
// backend logs the actual outcome so this UI never reveals which addresses
// have an account. Two-step UX: form → confirmation message.
export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const request = useMutation({
    mutationFn: () =>
      apiFetch<void>('/auth/password-reset/request', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuth: true,
      }),
    onSuccess: () => setSubmitted(true),
  });

  if (submitted) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>aisie</h1>
        <h2 style={{ fontSize: 18, color: '#0b0b0f', margin: 0 }}>E-postanızı kontrol edin</h2>
        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>
          E-posta adresiniz sistemimizde kayıtlıysa şifrenizi sıfırlayabileceğiniz bir bağlantı kısa süre içinde gelecek.
        </p>
        <Link href="/login" style={{ color: '#7c3aed', fontWeight: 600, fontSize: 14 }}>
          Giriş ekranına dön
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }}>aisie</h1>
      <h2 style={{ fontSize: 18, textAlign: 'center', color: '#0b0b0f' }}>Şifremi unuttum</h2>
      <p style={{ fontSize: 13, color: '#6b6b74', margin: 0, textAlign: 'center' }}>
        Kayıtlı e-posta adresinizi girin. Şifre sıfırlama bağlantısı size gönderilecek.
      </p>

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

      <button type="submit" disabled={request.isPending} style={buttonStyle}>
        {request.isPending ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
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
