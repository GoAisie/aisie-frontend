'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { companyAdminRegistrationSchema } from '@aisie/shared';
import { apiFetch, ApiError } from '@/lib/api-client';

// Registration creates both a new Company AND its admin user in a single call —
// main-service handles the @Transactional persistence via
// `CompanyAndUserBusinessService.createCompanyAndAdminUser`. A successful
// request returns 201 with no body; the user then logs in separately.
export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    companyName: '',
    companyCode: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const register = useMutation({
    mutationFn: async () => {
      const body = companyAdminRegistrationSchema.parse(form);
      await apiFetch<unknown>('/auth/register-company-and-admin', {
        method: 'POST',
        body,
        skipAuth: true,
      });
    },
    onSuccess: () => {
      router.replace('/login?registered=1');
    },
  });

  const errorMessage =
    register.error instanceof ApiError && register.error.status === 400
      ? 'Bu e-posta veya şirket kodu zaten kayıtlı.'
      : register.error
      ? 'Kayıt tamamlanamadı. Lütfen tekrar deneyin.'
      : null;

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        register.mutate();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }}>
        aisie
      </h1>
      <h2 style={{ fontSize: 18, textAlign: 'center', color: '#0b0b0f' }}>Şirket Kaydı</h2>

      <Field label="Şirket Adı" value={form.companyName} onChange={update('companyName')} />
      <Field label="Şirket Kodu" value={form.companyCode} onChange={update('companyCode')} />
      <Field label="Yönetici Adı" value={form.adminFirstName} onChange={update('adminFirstName')} />
      <Field label="Yönetici Soyadı" value={form.adminLastName} onChange={update('adminLastName')} />
      <Field label="E-posta" type="email" value={form.adminEmail} onChange={update('adminEmail')} />
      <Field
        label="Şifre (en az 8 karakter)"
        type="password"
        value={form.adminPassword}
        onChange={update('adminPassword')}
      />

      {errorMessage && (
        <p role="alert" style={{ color: '#dc2626', fontSize: 13 }}>
          {errorMessage}
        </p>
      )}

      <button type="submit" disabled={register.isPending} style={buttonStyle}>
        {register.isPending ? 'Kayıt oluşturuluyor…' : 'Kayıt Ol'}
      </button>

      <p style={{ fontSize: 13, textAlign: 'center', color: '#6b6b74' }}>
        Hesabınız var mı?{' '}
        <Link href="/login" style={{ color: '#7c3aed', fontWeight: 600 }}>
          Giriş yapın
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#6b6b74' }}>{label}</span>
      <input type={type} required value={value} onChange={onChange} style={inputStyle} />
    </label>
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
