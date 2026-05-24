'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Backend returns 200 even for unknown e-mails so this UI never reveals which
// addresses have an admin account. The submitted-state copy reflects that
// guarantee — it never confirms or denies account existence.
export default function AdminPasswordResetRequestPage() {
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
      <section className="flex flex-col gap-4 text-center">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[16px] font-medium text-foreground">E-postanızı kontrol edin</h2>
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          E-posta adresiniz sistemimizde kayıtlıysa şifrenizi sıfırlayabileceğiniz bir bağlantı kısa süre içinde gelecek.
        </p>
        <Link
          href="/login"
          className="text-[13px] font-semibold text-brand-600 hover:underline"
        >
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
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-1">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[15px] font-medium text-foreground">Şifremi Unuttum</h2>
      </div>

      <p className="m-0 text-center text-[13px] text-muted-foreground">
        Kayıtlı e-posta adresinizi girin. Şifre sıfırlama bağlantısı size gönderilecek.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-[13px] text-muted-foreground">E-posta</Label>
        <Input
          type="email"
          name="email"
          id="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={request.isPending} className="mt-1 h-10">
        {request.isPending ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
      </Button>

      <p className="m-0 text-center text-[13px] text-muted-foreground">
        <Link
          href="/login"
          className="font-semibold text-brand-600 hover:underline"
        >
          ← Giriş ekranı
        </Link>
      </p>
    </form>
  );
}
