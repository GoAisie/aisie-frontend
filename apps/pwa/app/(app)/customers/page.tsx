'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ListCard } from '@/components/ui/list-card';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

// Customers page: lists every CustomerContact in the company. The backend
// returns conversation-derived contacts AND any added manually via this page.
// Visibility is controlled by `is_visible` on the contact; direct CRUD inserts
// set it true at write time, so a freshly added contact appears immediately.

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type NewCustomerInput = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

const EMPTY_INPUT: NewCustomerInput = {
  name: '',
  phone_number: '',
  email: '',
  notes: '',
};

export default function CustomersPage() {
  const user = useSessionStore((s) => s.user);
  const companyId = user?.companyPublicId;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerInput>(EMPTY_INPUT);
  const [addError, setAddError] = useState<string | null>(null);

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

  const addCustomer = useMutation({
    mutationFn: (input: NewCustomerInput) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${companyId}/customers`,
        {
          method: 'POST',
          // Backend expects null for missing optional fields, not empty strings —
          // an empty string would fail EmailStr validation on the email field
          // even when the admin left it intentionally blank.
          body: {
            name: input.name.trim(),
            phone_number: input.phone_number.trim() || null,
            email: input.email.trim() || null,
            notes: input.notes.trim() || null,
          },
        },
      ),
    onSuccess: () => {
      setShowAddModal(false);
      setNewCustomer(EMPTY_INPUT);
      setAddError(null);
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
    },
    onError: (err) =>
      setAddError(err instanceof Error ? err.message : 'Müşteri eklenemedi.'),
  });

  // Client-side filter: pilot scale (< 50 customers per company) is far below
  // any threshold where round-trips matter. Substring match against name,
  // phone, and email — sales reps typically remember partial names or
  // recognise a phone tail.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone_number, c.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [customers, search]);

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewCustomer(EMPTY_INPUT);
    setAddError(null);
  };

  const trimmedName = newCustomer.name.trim();
  const addDisabled = addCustomer.isPending || trimmedName.length === 0;

  return (
    <section className="px-4 pt-15 pb-2">
      <PageHeader
        title="Müşteriler"
        subtitle={
          isLoading
            ? 'Yükleniyor…'
            : `${filtered.length} / ${customers.length} müşteri`
        }
        rightSlot={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setShowAddModal(true);
              setAddError(null);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Yeni
          </Button>
        }
      />

      <Input
        type="search"
        placeholder="Ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2.5"
      />

      {isError && (
        <p className="m-0 text-[14px] text-destructive">
          Müşteri listesi yüklenemedi.
        </p>
      )}

      {!isLoading && customers.length === 0 && !isError && (
        <EmptyState message="Henüz müşteri yok. Sesli konuşma sırasında otomatik eklenir veya yukarıdaki + Yeni ile manuel ekleyebilirsin." />
      )}

      {!isLoading && customers.length > 0 && filtered.length === 0 && (
        <p className="m-0 text-[14px] text-muted-foreground">
          Aramayla eşleşen müşteri yok.
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {filtered.map((c) => (
          <li key={c.customer_id} className="list-none">
            <ListCard href={`/customers/${c.customer_id}`} gradient>
              <strong className="text-[15px] font-semibold text-foreground">
                {c.name}
              </strong>
              {(c.phone_number || c.email) && (
                <p className="m-0 mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  {c.phone_number}
                  {c.phone_number && c.email && (
                    <span className="mx-1.5">·</span>
                  )}
                  {c.email}
                </p>
              )}
            </ListCard>
          </li>
        ))}
      </ul>

      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          if (!open) closeAddModal();
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!addDisabled) addCustomer.mutate(newCustomer);
            }}
          >
            <DialogHeader>
              <DialogTitle>Yeni Müşteri</DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-3">
              <FormField label="Ad" required>
                <Input
                  type="text"
                  required
                  autoFocus
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Telefon">
                <Input
                  type="tel"
                  value={newCustomer.phone_number}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phone_number: e.target.value,
                    })
                  }
                />
              </FormField>
              <FormField label="E-posta">
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Notlar">
                <textarea
                  rows={3}
                  value={newCustomer.notes}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, notes: e.target.value })
                  }
                  className={cn(
                    'w-full rounded-md border border-input bg-card px-3 py-2 text-[14px] text-foreground transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'resize-y font-sans',
                  )}
                />
              </FormField>
            </div>

            {addError && (
              <p className="mt-2 text-[13px] text-destructive">{addError}</p>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={closeAddModal}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={addDisabled}>
                {addCustomer.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
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
