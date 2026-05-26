'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// SALES_REP-side detail view of a single CustomerContact. Read-mostly with
// an inline "Düzenle" affordance so a rep can fix typos / add a missing
// phone — no Sil button on this surface (deletion is admin-only and the
// backend DELETE endpoint enforces SUPER_ADMIN/COMPANY_ADMIN role too).

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type FormState = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    phone_number: '',
    email: '',
    notes: '',
  });
  const [opError, setOpError] = useState<string | null>(null);

  const {
    data: customers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(
        `/api/v1/manage/companies/${companyId}/customers`,
      ),
    enabled: !!companyId,
  });

  const customer = customers.find((c) => c.customer_id === id) ?? null;

  const editCustomer = useMutation({
    mutationFn: (input: FormState) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${companyId}/customers/${id}`,
        {
          method: 'PUT',
          // Empty strings → null so backend EmailStr doesn't reject blank
          // optional fields; same shape as the admin Edit modal.
          body: {
            name: input.name.trim(),
            phone_number: input.phone_number.trim() || null,
            email: input.email.trim() || null,
            notes: input.notes.trim() || null,
          },
        },
      ),
    onSuccess: () => {
      setEditing(false);
      setOpError(null);
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
    },
    onError: (err) =>
      setOpError(
        err instanceof Error ? err.message : 'Müşteri güncellenemedi.',
      ),
  });

  if (isLoading) {
    return (
      <section className="px-4 pt-[var(--pt-page)] pb-2">
        <BackLink />
        <p className="m-0 mt-3 text-[14px] text-muted-foreground">
          Yükleniyor…
        </p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="px-4 pt-[var(--pt-page)] pb-2">
        <BackLink />
        <p className="m-0 mt-3 text-[14px] text-destructive">
          Müşteri bilgisi yüklenemedi.
        </p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="px-4 pt-[var(--pt-page)] pb-2">
        <BackLink />
        <p className="m-0 mt-3 text-[14px] text-destructive">
          Müşteri bulunamadı.
        </p>
      </section>
    );
  }

  const openEdit = () => {
    setForm({
      name: customer.name,
      phone_number: customer.phone_number ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    });
    setOpError(null);
    setEditing(true);
  };

  const editDisabled =
    editCustomer.isPending || form.name.trim().length === 0;

  return (
    <section className="px-4 pt-[var(--pt-page)] pb-2">
      <BackLink />

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="m-0 text-[22px] font-bold tracking-tight text-foreground">
          {customer.name}
        </h1>
        <Button type="button" size="sm" onClick={openEdit}>
          <Pencil className="size-3.5" aria-hidden />
          Düzenle
        </Button>
      </header>

      <dl className="m-0 mt-5 p-0">
        {customer.phone_number && (
          <Field
            label="Telefon"
            value={customer.phone_number}
            href={`tel:${customer.phone_number.replace(/\s/g, '')}`}
          />
        )}
        {customer.email && (
          <Field
            label="E-posta"
            value={customer.email}
            href={`mailto:${customer.email}`}
          />
        )}
        {customer.notes && (
          <div className="border-b border-border py-3">
            <p className="m-0 text-[13px] text-muted-foreground">Notlar</p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] text-foreground">
              {customer.notes}
            </p>
          </div>
        )}
        {!customer.phone_number && !customer.email && !customer.notes && (
          <p className="m-0 text-[14px] text-muted-foreground">
            İletişim bilgisi bulunmuyor.
          </p>
        )}
      </dl>

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(false);
            setOpError(null);
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editDisabled) editCustomer.mutate(form);
            }}
          >
            <DialogHeader>
              <DialogTitle>Müşteriyi Düzenle</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-3">
              <FormField label="Ad" required>
                <Input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>
              <FormField label="Telefon">
                <Input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) =>
                    setForm({ ...form, phone_number: e.target.value })
                  }
                />
              </FormField>
              <FormField label="E-posta">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label="Notlar">
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={cn(
                    'w-full rounded-md border border-input bg-card px-3 py-2 text-[14px] text-foreground transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'resize-y font-sans',
                  )}
                />
              </FormField>
            </div>

            {opError && (
              <p className="mt-2 text-[13px] text-destructive">{opError}</p>
            )}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setOpError(null);
                }}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={editDisabled}>
                {editCustomer.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BackLink() {
  // Back link rendered as a bordered Button (outline variant) so it reads
  // as a tappable target rather than a hyperlink — matches the visual
  // weight of "Düzenle" / "+ Yeni" etc. action buttons. asChild lets
  // Button apply its styling to the inner <Link> without nesting elements.
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="gap-1.5 text-brand-700 hover:text-brand-800 dark:text-brand-200 dark:hover:text-brand-100"
    >
      <Link href="/customers">
        <ArrowLeft className="size-3.5" aria-hidden />
        Müşteriler
      </Link>
    </Button>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="m-0 text-[14px] text-foreground">
        {href ? (
          <a
            href={href}
            className="text-brand-600 no-underline transition-colors hover:text-brand-700"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
