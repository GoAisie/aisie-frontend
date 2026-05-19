'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { TemplateForm, emptyField, type TemplateFormValue } from '@/components/TemplateForm';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';

// New-template page. Validation lives in TemplateForm; server re-validates on
// save. On success we invalidate the list query so the new template appears
// when we navigate back.
export default function NewTemplatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (value: TemplateFormValue) =>
      apiFetch('/api/v1/manage/templates', {
        method: 'POST',
        // base_id intentionally omitted — server derives it from `name`
        // (slugify_tr + collision suffix). UI never asks the admin for it.
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
            // Pass through only when an entity marker is set. Undefined is
            // cleaner than null on the wire — body contains exactly the keys
            // the admin chose.
            entity_type: f.entityType ?? undefined,
          })),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] });
      router.push('/templates');
    },
    onError: (err) => {
      // Surface the server-side error payload — usually validation_errors[].
      const detail = (err as { body?: { detail?: { validation_errors?: string[] } } })
        .body?.detail;
      if (detail?.validation_errors?.length) {
        setServerError(detail.validation_errors.join(' • '));
      } else {
        setServerError(err instanceof Error ? err.message : 'Oluşturma başarısız.');
      }
    },
  });

  return (
    <section className="mx-auto max-w-4xl">
      <BackLink href="/templates" label="Şablonlar" />
      <PageHeader title="Yeni Şablon" subtitle="Şablon oluştur ve alanları tanımla." />

      <TemplateForm
        initial={{ baseId: '', name: '', fields: [emptyField()] }}
        isEdit={false}
        submitting={create.isPending}
        serverError={serverError}
        onCancel={() => router.push('/templates')}
        onSubmit={(value) => {
          setServerError(null);
          create.mutate(value);
        }}
      />
    </section>
  );
}
