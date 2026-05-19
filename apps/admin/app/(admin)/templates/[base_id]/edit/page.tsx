'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { TemplateForm, type FieldType, type TemplateFormValue } from '@/components/TemplateForm';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';

type FetchedField = {
  name: string;
  label: string;
  type: FieldType;
  description?: string | null;
  required?: boolean;
  options?: string[] | null;
  entity_type?: 'followup_date' | 'customer' | null;
};
type FetchedTemplate = {
  base_id: string;
  name: string;
  version: number;
  fields: FetchedField[];
};

// Next.js 16 makes route params a Promise; we unwrap with React.use().
export default function EditTemplatePage(props: { params: Promise<{ base_id: string }> }) {
  const { base_id: baseId } = use(props.params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: template, isLoading, isError } = useQuery({
    queryKey: ['admin-templates', baseId],
    queryFn: async () => {
      const list = await apiFetch<FetchedTemplate[]>('/api/v1/manage/templates');
      return list.find((t) => t.base_id === baseId) ?? null;
    },
  });

  const update = useMutation({
    mutationFn: (value: TemplateFormValue) =>
      apiFetch(`/api/v1/manage/templates/${baseId}`, {
        method: 'PUT',
        body: {
          name: value.name,
          fields: value.fields.map((f) => ({
            label: f.label.trim(),
            type: f.type,
            description: f.description.trim() || undefined,
            required: f.required,
            options:
              f.type === 'single-select'
                ? f.options.map((o) => o.trim()).filter(Boolean)
                : undefined,
            entity_type: f.entityType ?? undefined,
          })),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      router.push('/templates');
    },
    onError: (err) => {
      const detail = (err as { body?: { detail?: { validation_errors?: string[] } } })
        .body?.detail;
      if (detail?.validation_errors?.length) {
        setServerError(detail.validation_errors.join(' • '));
      } else {
        setServerError(err instanceof Error ? err.message : 'Güncelleme başarısız.');
      }
    },
  });

  if (isLoading) {
    return (
      <section>
        <BackLink href="/templates" label="Şablonlar" />
        <p className="m-0 text-[14px] text-muted-foreground">Yükleniyor…</p>
      </section>
    );
  }

  if (isError || !template) {
    return (
      <section>
        <BackLink href="/templates" label="Şablonlar" />
        <p className="m-0 text-[14px] text-destructive">Şablon bulunamadı.</p>
      </section>
    );
  }

  const initial: TemplateFormValue = {
    baseId: template.base_id,
    name: template.name,
    fields: template.fields.map((f) => ({
      label: f.label,
      type: f.type,
      description: f.description ?? '',
      required: f.required ?? true,
      options: f.options ?? [],
      // Only "followup_date" round-trips through the UI. "customer" entity_type
      // is preserved at the server level but invisible here — the form drops it
      // on save (no UI to render). If we expose customer-typed fields in the
      // editor later, this normalisation step disappears.
      entityType: f.entity_type === 'followup_date' ? 'followup_date' : null,
    })),
  };

  return (
    <section className="mx-auto max-w-4xl">
      <BackLink href="/templates" label="Şablonlar" />
      <PageHeader title="Şablon Düzenle" subtitle={`v${template.version}`} />

      <TemplateForm
        initial={initial}
        isEdit={true}
        submitting={update.isPending}
        serverError={serverError}
        onCancel={() => router.push('/templates')}
        onSubmit={(value) => {
          setServerError(null);
          update.mutate(value);
        }}
      />
    </section>
  );
}
