'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TemplateField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
};

type ReportTemplate = {
  base_id: string;
  version: number;
  name: string;
  fields: TemplateField[];
  is_latest: boolean;
  to_be_deleted?: boolean;
};

export default function AdminTemplatesPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ReportTemplate | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => apiFetch<ReportTemplate[]>('/api/v1/manage/templates'),
  });

  const softDelete = useMutation({
    mutationFn: (baseId: string) =>
      apiFetch<{ ok: true }>(
        `/api/v1/manage/templates/${baseId}/soft-delete`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      setPendingDelete(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
    },
    onError: (err) =>
      setDeleteError(err instanceof Error ? err.message : 'Silme başarısız.'),
  });

  return (
    <section>
      <PageHeader
        title="Şablonlar"
        subtitle={isLoading ? 'Yükleniyor…' : `${templates.length} şablon`}
        rightSlot={
          <Button asChild className="gap-1.5">
            <Link href="/templates/new" className="no-underline">
              <Plus className="size-4" aria-hidden />
              Yeni Şablon
            </Link>
          </Button>
        }
      />

      {isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Şablonlar yüklenemedi.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && templates.length === 0 ? (
        <EmptyState message='Henüz şablon yok. "Yeni Şablon" ile ekleyebilirsin.' />
      ) : (
        !isLoading && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead className="w-[100px]">Versiyon</TableHead>
                  <TableHead className="w-[100px]">Alan</TableHead>
                  <TableHead className="w-[180px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={`${t.base_id}-${t.version}`}>
                    <TableCell className="font-semibold">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        v{t.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {t.fields.length}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button asChild variant="ghost" size="xs" className="gap-1">
                        <Link href={`/templates/${t.base_id}/edit`}>
                          <Pencil className="size-3.5" aria-hidden />
                          Düzenle
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setPendingDelete(t);
                          setDeleteError(null);
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
        )
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          {pendingDelete && (
            <>
              <DialogHeader>
                <DialogTitle>
                  &quot;{pendingDelete.name}&quot; şablonunu sil
                </DialogTitle>
                <DialogDescription>
                  Bu şablon liste görünümünden gizlenecek. Mevcut raporlar
                  etkilenmez. Devam edilsin mi?
                </DialogDescription>
              </DialogHeader>
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingDelete(null);
                    setDeleteError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="destructive"
                  disabled={softDelete.isPending}
                  onClick={() => softDelete.mutate(pendingDelete.base_id)}
                >
                  {softDelete.isPending ? 'Siliniyor…' : 'Sil'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
