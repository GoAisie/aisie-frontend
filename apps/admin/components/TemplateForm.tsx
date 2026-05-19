'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Shared form for both Create (new/page.tsx) and Edit (edit/page.tsx). Holds
// the field list as local React state, computes canonical-name previews on
// every keystroke, and runs the same validation rules the server enforces
// (so Save stays disabled until the payload is clean).
//
// Drag-and-drop reorder is deliberately NOT included here — pilot UI uses
// up/down chevron buttons. Adding @dnd-kit is a later polish item.

export type FieldType = 'string' | 'number' | 'date' | 'time' | 'boolean' | 'single-select';

// `entityType` maps to the backend FieldSchema.entity_type marker. UI only
// exposes the "followup_date" variant via a checkbox (rendered when type is
// 'date'); other entity_type values are reserved for future template
// semantics and not yet user-editable. null = no marker (plain field).
export type FieldEntityType = 'followup_date' | null;

export type DraftField = {
  label: string;
  type: FieldType;
  description: string;
  required: boolean;
  options: string[];
  entityType: FieldEntityType;
};

// base_id is server-generated from `name` (slugify_tr + collision suffix).
// We keep it in the type for the edit flow (URL routes through it) but the
// create form leaves it blank and the new page omits it from the POST body.
export type TemplateFormValue = {
  baseId: string;
  name: string;
  fields: DraftField[];
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: 'Metin',
  number: 'Sayı',
  date: 'Tarih',
  time: 'Saat',
  boolean: 'Evet / Hayır',
  'single-select': 'Tek Seçim',
};

export function emptyField(): DraftField {
  return { label: '', type: 'string', description: '', required: true, options: [], entityType: null };
}

export function TemplateForm({
  initial,
  isEdit,
  submitting,
  onSubmit,
  onCancel,
  serverError,
}: {
  initial: TemplateFormValue;
  isEdit: boolean;
  submitting: boolean;
  onSubmit: (value: TemplateFormValue) => void;
  onCancel: () => void;
  serverError?: string | null;
}) {
  const [baseId, setBaseId] = useState(initial.baseId);
  const [name, setName] = useState(initial.name);
  const [fields, setFields] = useState<DraftField[]>(initial.fields);

  const errors = useMemo(
    () => validate({ baseId, name, fields }, isEdit),
    [baseId, name, fields, isEdit],
  );
  const valid = errors.length === 0;

  const setField = (i: number, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeField = (i: number) =>
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  const moveField = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
  };
  const addField = () => setFields((prev) => [...prev, emptyField()]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || submitting) return;
        onSubmit({ baseId: baseId.trim(), name: name.trim(), fields });
      }}
      className="flex flex-col gap-5"
    >
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-[14px] font-bold text-foreground">Şablon bilgileri</h2>
        <FormField
          label="Ad"
          required
          help="Şablonun listede görünecek adı. Sistem buradan otomatik bir kimlik üretir."
        >
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ör. CRM Aktivite Raporu"
          />
        </FormField>
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[14px] font-bold text-foreground">
            Alanlar ({fields.length})
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden />
            Alan Ekle
          </Button>
        </header>

        {fields.length === 0 && (
          <p className="m-0 text-[13px] text-muted-foreground">
            Henüz alan yok. "Alan Ekle" ile başla.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {fields.map((field, i) => (
            <FieldRow
              key={i}
              index={i}
              total={fields.length}
              field={field}
              onChange={(patch) => setField(i, patch)}
              onRemove={() => removeField(i)}
              onMoveUp={() => moveField(i, -1)}
              onMoveDown={() => moveField(i, 1)}
            />
          ))}
        </div>
      </section>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="m-0 font-semibold">Düzeltmen gereken noktalar</p>
            <ul className="m-0 mt-1 pl-5">
              {errors.map((err, i) => (
                <li key={i} className="my-0.5">
                  {err}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>Sunucu: {serverError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          İptal
        </Button>
        <Button type="submit" disabled={!valid || submitting}>
          {submitting ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Oluştur'}
        </Button>
      </div>
    </form>
  );
}

function FieldRow({
  index,
  total,
  field,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  field: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground/70">
          #{index + 1}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="Yukarı taşı"
        >
          <ChevronUp className="size-3" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="Aşağı taşı"
        >
          <ChevronDown className="size-3" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Alanı sil"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-3" aria-hidden />
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Etiket" required>
          <Input
            type="text"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Müşteri Adı"
          />
        </FormField>
        <FormField label="Tip" required>
          <select
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value as FieldType;
              // When admin switches away from date, drop any followup marker;
              // entity_type=followup_date only makes sense on dates.
              const patch: Partial<DraftField> = { type: nextType };
              if (nextType !== 'date' && field.entityType === 'followup_date') {
                patch.entityType = null;
              }
              onChange(patch);
            }}
            className="h-9 rounded-md border border-input bg-card px-3 text-[14px] text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Zorunlu">
          <label className="flex h-9 items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="size-4 accent-brand-600"
            />
            Bu alan dolmadan rapor tamamlanmasın
          </label>
        </FormField>
        {field.type === 'date' && (
          <FormField
            label="Takip tarihi mi?"
            help="Seçildiğinde ajandaya girilen tarih için hatırlatma oluşturulur."
          >
            <label className="flex h-9 items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={field.entityType === 'followup_date'}
                onChange={(e) =>
                  onChange({ entityType: e.target.checked ? 'followup_date' : null })
                }
                className="size-4 accent-brand-600"
              />
              Evet, takip tarihi
            </label>
          </FormField>
        )}
        <div className="sm:col-span-2">
          <FormField
            label="Açıklama"
            help="Yapay Zeka'nın bu alanı doğru doldurabilmesi için ipucu."
          >
            <textarea
              value={field.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Bu alana hangi tür bilgi yazılacağı nasıl tahmin edilebilir?"
              rows={2}
              className="w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-1.5 text-[14px] shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </FormField>
        </div>
        {field.type === 'single-select' && (
          <div className="sm:col-span-2">
            <FormField label="Seçenekler" required help="En az 2 seçenek girilmeli.">
              <OptionsEditor
                options={field.options}
                onChange={(opts) => onChange({ options: opts })}
              />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const set = (i: number, v: string) =>
    onChange(options.map((o, idx) => (idx === i ? v : o)));
  const add = () => onChange([...options, '']);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <Input
            type="text"
            value={opt}
            onChange={(e) => set(i, e.target.value)}
            placeholder={`Seçenek ${i + 1}`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => remove(i)}
            aria-label="Seçeneği sil"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="self-start gap-1.5"
      >
        <Plus className="size-3.5" aria-hidden />
        Seçenek
      </Button>
    </div>
  );
}

function FormField({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12.5px] font-semibold text-foreground/80">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {help && (
        <span className="text-[11px] text-muted-foreground">{help}</span>
      )}
    </div>
  );
}

function validate(v: TemplateFormValue, _isEdit: boolean): string[] {
  // Note: base_id no longer enters the validation — it's server-generated from
  // the name on create, and stable (URL identifier only) on edit.
  const errors: string[] = [];
  if (!v.name.trim()) errors.push('Ad zorunlu.');
  if (v.fields.length === 0) errors.push('En az 1 alan girilmeli.');

  let hasRequired = false;
  v.fields.forEach((f, i) => {
    const pos = `Alan #${i + 1}`;
    if (!f.label.trim()) errors.push(`${pos}: etiket boş olamaz.`);
    if (f.type === 'single-select') {
      const cleaned = f.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2)
        errors.push(`${pos}: tek seçim için en az 2 seçenek gerekli.`);
      if (new Set(cleaned).size !== cleaned.length)
        errors.push(`${pos}: seçenekler benzersiz olmalı.`);
    }
    if (f.required) hasRequired = true;
  });
  if (v.fields.length > 0 && !hasRequired)
    errors.push('Şablonda en az 1 zorunlu alan olmalı.');
  return errors;
}
