'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, loginResponseSchema, type LoginResponse } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: async (): Promise<LoginResponse> => {
      const body = loginRequestSchema.parse({ email, password });
      const raw = await apiFetch<unknown>('/auth/login', {
        method: 'POST',
        body,
        skipAuth: true,
      });
      return loginResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      // session-store derives the role from the JWT claim itself; only admins
      // (SUPER_ADMIN or COMPANY_ADMIN) can reach the admin area. Other roles
      // see a friendly forbidden message.
      const role = useSessionStore.getState().role;
      if (role !== 'COMPANY_ADMIN' && role !== 'SUPER_ADMIN') {
        useSessionStore.getState().clearSession();
        setRoleError('Bu panele yalnızca şirket yöneticileri erişebilir.');
        return;
      }
      router.replace('/dashboard');
    },
  });

  const errorMessage =
    roleError ??
    (login.error instanceof ApiError && login.error.status === 401
      ? 'E-posta veya şifre hatalı.'
      : login.error
        ? 'Giriş yapılamadı. Lütfen tekrar deneyin.'
        : null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setRoleError(null);
        login.mutate();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col items-center gap-1">
        <h1 className="m-0 text-[26px] font-bold text-brand-600">aisie admin</h1>
        <h2 className="m-0 text-[15px] font-medium text-foreground">Yönetim Paneli Girişi</h2>
      </div>

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-[13px] text-muted-foreground">Şifre</Label>
        <PasswordInput
          name="password"
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={login.isPending} className="mt-1 h-10">
        {login.isPending ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </Button>

      <p className="m-0 text-center text-[13px] text-muted-foreground">
        <Link
          href="/password-reset/request"
          className="font-semibold text-brand-600 hover:underline"
        >
          Şifremi unuttum
        </Link>
      </p>
    </form>
  );
}
