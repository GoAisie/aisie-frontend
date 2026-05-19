'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CustomerContact = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  notes: string | null;
};

type CustomerInput = {
  name: string;
  phone_number: string;
  email: string;
  notes: string;
};

const EMPTY_INPUT: CustomerInput = { name: '', phone_number: '', email: '', notes: '' };

type ModalState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; target: CustomerContact }
  | { kind: 'delete'; target: CustomerContact };

export default function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const sessionUser = useSessionStore((s) => s.user);
  const actingCompanyId = useActingCompanyStore((s) => s.actingCompanyId);
  const effectiveCompanyId = actingCompanyId ?? sessionUser?.companyPublicId ?? null;

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [formInput, setFormInput] = useState<CustomerInput>(EMPTY_INPUT);
  const [opError, setOpError] = useState<string | null>(null);

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['admin-customers', effectiveCompanyId],
    queryFn: () =>
      apiFetch<CustomerContact[]>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers`,
      ),
    enabled: !!effectiveCompanyId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-customers', effectiveCompanyId] });

  const addCustomer = useMutation({
    mutationFn: (input: CustomerInput) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers`,
        { method: 'POST', body: bodyFromInput(input) },
      ),
    onSuccess: () => {
      setModal({ kind: 'closed' });
      setOpError(null);
      invalidate();
    },
    onError: (err) =>
      setOpError(err instanceof Error ? err.message : 'Müşteri eklenemedi.'),
  });

  const editCustomer = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) =>
      apiFetch<CustomerContact>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers/${id}`,
        { method: 'PUT', body: bodyFromInput(input) },
      ),
    onSuccess: () => {
      setModal({ kind: 'closed' });
      setOpError(null);
      invalidate();
    },
    onError: (err) =>
      setOpError(err instanceof Error ? err.message : 'Güncellenemedi.'),
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(
        `/api/v1/manage/companies/${effectiveCompanyId}/customers/${id}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      setModal({ kind: 'closed' });
      setOpError(null);
      invalidate();
    },
    onError: (err) => setOpError(err instanceof Error ? err.message : 'Silinemedi.'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone_number, c.email, c.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [customers, search]);

  return (
    <section>
      <PageHeader
        title="Müşteriler"
        subtitle={
          isLoading
            ? 'Yükleniyor…'
            : `${filtered.length} / ${customers.length} müşteri`
        }
        rightSlot={
          <Button
            onClick={() => {
              setFormInput(EMPTY_INPUT);
              setModal({ kind: 'add' });
              setOpError(null);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden />
            Yeni Müşteri
          </Button>
        }
      />

      <div className="mb-4">
        <Input
          type="search"
          placeholder="Ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Müşteri listesi yüklenemedi.</AlertDescription>
        </Alert>
      )}

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          message={
            customers.length === 0
              ? 'Henüz müşteri yok. "Yeni Müşteri" ile ekleyebilirsin.'
              : 'Aramayla eşleşen müşteri yok.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Notlar</TableHead>
                <TableHead className="w-[140px] text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.customer_id}>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone_number ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {c.notes ?? '—'}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setFormInput({
                          name: c.name,
                          phone_number: c.phone_number ?? '',
                          email: c.email ?? '',
                          notes: c.notes ?? '',
                        });
                        setModal({ kind: 'edit', target: c });
                        setOpError(null);
                      }}
                      className="gap-1"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setModal({ kind: 'delete', target: c });
                        setOpError(null);
                      }}
                      className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Sil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={modal.kind === 'add' || modal.kind === 'edit'}
        onOpenChange={(open) => {
          if (!open) {
            setModal({ kind: 'closed' });
            setOpError(null);
          }
        }}
      >
        <DialogContent>
          {(modal.kind === 'add' || modal.kind === 'edit') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (modal.kind === 'add') addCustomer.mutate(formInput);
                else editCustomer.mutate({ id: modal.target.customer_id, input: formInput });
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {modal.kind === 'add'
                    ? 'Yeni Müşteri'
                    : `"${modal.target.name}" düzenle`}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-3 py-2">
                <FormField label="Ad *">
                  <Input
                    type="text"
                    required
                    autoFocus
                    value={formInput.name}
                    onChange={(e) =>
                      setFormInput({ ...formInput, name: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Telefon">
                  <Input
                    type="tel"
                    value={formInput.phone_number}
                    onChange={(e) =>
                      setFormInput({ ...formInput, phone_number: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="E-posta">
                  <Input
                    type="email"
                    value={formInput.email}
                    onChange={(e) =>
                      setFormInput({ ...formInput, email: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Notlar">
                  <textarea
                    rows={3}
                    value={formInput.notes}
                    onChange={(e) =>
                      setFormInput({ ...formInput, notes: e.target.value })
                    }
                    className="h-20 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-1.5 text-[14px] shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                </FormField>
              </div>

              {opError && (
                <Alert variant="destructive">
                  <AlertDescription>{opError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setModal({ kind: 'closed' });
                    setOpError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  type="submit"
                  disabled={
                    addCustomer.isPending ||
                    editCustomer.isPending ||
                    formInput.name.trim().length === 0
                  }
                >
                  {addCustomer.isPending || editCustomer.isPending
                    ? 'Kaydediliyor…'
                    : 'Kaydet'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={modal.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) {
            setModal({ kind: 'closed' });
            setOpError(null);
          }
        }}
      >
        <DialogContent>
          {modal.kind === 'delete' && (
            <>
              <DialogHeader>
                <DialogTitle>&quot;{modal.target.name}&quot; sil</DialogTitle>
                <DialogDescription>
                  Bu müşteri kayıtlardan kaldırılacak. Geçmiş raporlar etkilenmez.
                  Devam edilsin mi?
                </DialogDescription>
              </DialogHeader>
              {opError && (
                <Alert variant="destructive">
                  <AlertDescription>{opError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setModal({ kind: 'closed' });
                    setOpError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteCustomer.isPending}
                  onClick={() => deleteCustomer.mutate(modal.target.customer_id)}
                >
                  {deleteCustomer.isPending ? 'Siliniyor…' : 'Sil'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function bodyFromInput(input: CustomerInput) {
  // Backend expects null for absent optional fields (EmailStr rejects empty
  // strings). Trim to drop whitespace-only "values" that look real to a user
  // but break validation.
  return {
    name: input.name.trim(),
    phone_number: input.phone_number.trim() || null,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
