'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
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
import { cn } from '@/lib/utils';

// SUPER_ADMIN-only company directory + create flow. Create is a two-step
// dance: main-service creates the Postgres row, then report-service seeds
// the Mongo CompanyAIConfig (LLM/STT/TTS providers + notification email).
// If step 2 fails, the row still exists in Postgres — accepted risk for
// pilot since the admin can re-run a future repair affordance.

type CompanyRow = {
  public_id: string;
  name: string;
  short_name: string;
  code: string;
  status: string;
};

type CreateResponse = {
  public_id: string;
  name: string;
  short_name: string;
  slug: string;
  code: string;
  status: string;
  notification_email: string | null;
};

type FormState = {
  name: string;
  notification_email: string;
};

const EMPTY_FORM: FormState = { name: '', notification_email: '' };

export default function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  const role = useSessionStore((s) => s.role);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [opError, setOpError] = useState<string | null>(null);

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => apiFetch<CompanyRow[]>('/api/v1/companies'),
    enabled: role === 'SUPER_ADMIN',
  });

  const createCompany = useMutation({
    mutationFn: async (input: FormState) => {
      const name = input.name.trim();
      const email = input.notification_email.trim();
      const created = await apiFetch<CreateResponse>('/api/v1/companies', {
        method: 'POST',
        body: { name, notification_email: email || null },
      });
      try {
        await apiFetch('/api/v1/manage/ai-config/seed-for-company', {
          method: 'POST',
          body: { company_id: created.public_id, notification_email: email || null },
        });
      } catch (seedErr) {
        const msg = seedErr instanceof Error ? seedErr.message : 'seed başarısız';
        throw new Error(
          `Şirket oluşturuldu ama AI yapılandırması seed edilemedi: ${msg}`,
        );
      }
      return created;
    },
    onSuccess: () => {
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setOpError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
    },
    onError: (err) =>
      setOpError(err instanceof Error ? err.message : 'Şirket oluşturulamadı.'),
  });

  if (role !== 'SUPER_ADMIN') {
    return (
      <section>
        <PageHeader title="Şirketler" />
        <p className="m-0 text-[14px] text-muted-foreground">
          Bu sayfa yalnızca SUPER_ADMIN için erişilebilir.
        </p>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        title="Şirketler"
        subtitle={isLoading ? 'Yükleniyor…' : `${companies.length} şirket`}
        rightSlot={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowAdd(true);
              setOpError(null);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" aria-hidden />
            Yeni Şirket
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Şirket listesi yüklenemedi.</AlertDescription>
        </Alert>
      )}

      {!isLoading && companies.length === 0 ? (
        <EmptyState message='Henüz şirket yok. "Yeni Şirket" ile ekleyebilirsin.' />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.public_id}>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">
                    {c.code}
                  </TableCell>
                  <TableCell>
                    <CompanyStatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setOpError(null);
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name.trim().length > 0) createCompany.mutate(form);
            }}
          >
            <DialogHeader>
              <DialogTitle>Yeni Şirket</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] text-muted-foreground">
                  Şirket adı *
                </Label>
                <Input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12.5px] text-muted-foreground">
                  Bildirim e-postası
                </Label>
                <Input
                  type="text"
                  placeholder="ornek@firma.com (virgülle ayırarak birden fazla)"
                  value={form.notification_email}
                  onChange={(e) =>
                    setForm({ ...form, notification_email: e.target.value })
                  }
                />
                <span className="text-[11px] text-muted-foreground/80">
                  Tamamlanan raporlar bu adres(ler)e gönderilir. Boş bırakırsan
                  sonradan şirket yapılandırmasından eklenebilir.
                </span>
              </div>
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
                  setShowAdd(false);
                  setOpError(null);
                }}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={createCompany.isPending || form.name.trim().length === 0}
              >
                {createCompany.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CompanyStatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <Badge
      className={cn(
        'border-0',
        isActive
          ? 'bg-success/15 text-success dark:bg-success/20'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {status}
    </Badge>
  );
}
