'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api-client';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Magic-link confirm step. Token is in the URL path; user enters the new
// password. Server returns 200 on success, 410 if token expired/used. Unlike
// accept-invite this does NOT auto-login — user is bounced to /login so they
// confirm the new password works.
export default function AdminPasswordResetConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
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
      <section className="flex flex-col gap-4 text-center">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[16px] font-medium text-foreground">Şifreniz güncellendi</h2>
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          Yeni şifrenizle giriş yapabilirsiniz.
        </p>
        <Button onClick={() => router.replace('/login')} className="h-10">
          Giriş ekranına git
        </Button>
      </section>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) confirm.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-1">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[15px] font-medium text-foreground">Yeni şifre belirleyin</h2>
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

      <Button type="submit" disabled={!valid || confirm.isPending} className="mt-1 h-10">
        {confirm.isPending ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
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
