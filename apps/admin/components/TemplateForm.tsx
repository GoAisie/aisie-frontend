'use client';

import { useMemo, useState } from 'react';

// Shared form for both Create (new/page.tsx) and Edit (edit/page.tsx). Holds
// the field list as local React state, computes canonical-name previews on
// every keystroke, and runs the same validation rules the server enforces
// (so Save stays disabled until the payload is clean).
//
// Drag-and-drop reorder is deliberately NOT included here — pilot UI uses
// up/down chevron buttons. Adding @dnd-kit is a Phase 8 polish item.

export type FieldType = 'string' | 'number' | 'date' | 'time' | 'boolean' | 'single-select';

// `entityType` maps to the backend FieldSchema.entity_type marker. The UI
// only exposes the "followup_date" variant via a checkbox (rendered when
// type === 'date'); other entity_type values (e.g. "customer") are reserved
// for future template semantics and are not yet user-editable. null means
// no marker — plain field, no server-side side effects.
export type FieldEntityType = 'followup_date' | null;

export type DraftField = {
  label: string;
  type: FieldType;
  description: string;
  required: boolean;
  options: string[]; // only used when type === 'single-select'
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

  const errors = useMemo(() => validate({ baseId, name, fields }, isEdit), [baseId, name, fields, isEdit]);
  const valid = errors.length === 0;

  const setField = (i: number, patch: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));
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
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Şablon bilgileri</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Ad" required help="Şablonun listede görünecek adı. Sistem buradan otomatik bir kimlik üretir.">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ör. CRM Aktivite Raporu"
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      <section style={cardStyle}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={sectionTitleStyle}>Alanlar ({fields.length})</h2>
          <button type="button" onClick={addField} style={secondaryBtnStyle}>+ Alan Ekle</button>
        </header>

        {fields.length === 0 && (
          <p style={mutedStyle}>Henüz alan yok. "Alan Ekle" ile başla.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        <div style={{ ...cardStyle, borderColor: '#fca5a5', background: '#fef2f2' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#991b1b' }}>Düzeltmen gereken noktalar</p>
          <ul style={{ margin: '6px 0 0 20px', padding: 0, fontSize: 13, color: '#7f1d1d' }}>
            {errors.map((err, i) => (<li key={i} style={{ margin: '2px 0' }}>{err}</li>))}
          </ul>
        </div>
      )}

      {serverError && (
        <div style={{ ...cardStyle, borderColor: '#fca5a5', background: '#fef2f2' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>Sunucu: {serverError}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" onClick={onCancel} style={ghostBtnStyle}>İptal</button>
        <button
          type="submit"
          disabled={!valid || submitting}
          style={{ ...primaryBtnStyle, opacity: valid && !submitting ? 1 : 0.5, cursor: valid && !submitting ? 'pointer' : 'not-allowed' }}
        >
          {submitting ? 'Kaydediliyor…' : isEdit ? 'Güncelle' : 'Oluştur'}
        </button>
      </div>
    </form>
  );
}

function FieldRow({
  index, total, field,
  onChange, onRemove, onMoveUp, onMoveDown,
}: {
  index: number; total: number;
  field: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div style={{ ...cardStyle, padding: 14, background: '#fcfcfd', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>#{index + 1}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onMoveUp} disabled={index === 0} style={iconBtnStyle} aria-label="Yukarı taşı">▲</button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} style={iconBtnStyle} aria-label="Aşağı taşı">▼</button>
        <button type="button" onClick={onRemove} style={{ ...iconBtnStyle, color: '#dc2626' }} aria-label="Alanı sil">✕</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Etiket" required>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Müşteri Adı"
            style={inputStyle}
          />
        </Field>
        <Field label="Tip" required>
          <select
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value as FieldType;
              // When the admin switches away from date, drop any followup
              // marker; entity_type=followup_date only makes sense on dates.
              const patch: Partial<DraftField> = { type: nextType };
              if (nextType !== 'date' && field.entityType === 'followup_date') {
                patch.entityType = null;
              }
              onChange(patch);
            }}
            style={inputStyle}
          >
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Zorunlu">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            Bu alan dolmadan rapor tamamlanmasın
          </label>
        </Field>
        {field.type === 'date' && (
          <Field label="Takip tarihi mi?" help="Seçildiğinde ajandaya girilen tarih için hatırlatma oluşturulur.">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={field.entityType === 'followup_date'}
                onChange={(e) =>
                  onChange({ entityType: e.target.checked ? 'followup_date' : null })
                }
              />
              Evet, takip tarihi
            </label>
          </Field>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Açıklama" help="Yapay Zeka'nın bu alanı doğru doldurabilmesi için ipucu.">
            <textarea
              value={field.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Bu alana hangi tür bilgi yazılacağı nasıl tahmin edilebilir?"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>
        {field.type === 'single-select' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Seçenekler" required help="En az 2 seçenek girilmeli.">
              <OptionsEditor
                options={field.options}
                onChange={(opts) => onChange({ options: opts })}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const set = (i: number, v: string) => onChange(options.map((o, idx) => (idx === i ? v : o)));
  const add = () => onChange([...options, '']);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={opt}
            onChange={(e) => set(i, e.target.value)}
            placeholder={`Seçenek ${i + 1}`}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={() => remove(i)} style={iconBtnStyle} aria-label="Seçeneği sil">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ ...secondaryBtnStyle, alignSelf: 'flex-start' }}>+ Seçenek</button>
    </div>
  );
}

function Field({
  label, help, required, children,
}: { label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {help && <span style={{ fontSize: 11, color: '#6b6b74' }}>{help}</span>}
    </label>
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
      if (cleaned.length < 2) errors.push(`${pos}: tek seçim için en az 2 seçenek gerekli.`);
      if (new Set(cleaned).size !== cleaned.length) errors.push(`${pos}: seçenekler benzersiz olmalı.`);
    }
    if (f.required) hasRequired = true;
  });
  if (v.fields.length > 0 && !hasRequired) errors.push('Şablonda en az 1 zorunlu alan olmalı.');
  return errors;
}

// ---- styles -----------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: '#0b0b0f', margin: '0 0 12px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#0b0b0f', background: '#fff',
};
const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600,
};
const secondaryBtnStyle: React.CSSProperties = {
  background: '#fff', color: '#4b5563', border: '1px solid #e5e7eb',
  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#6b6b74', border: 'none',
  padding: '10px 14px', fontSize: 13, cursor: 'pointer',
};
const iconBtnStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
  width: 28, height: 28, padding: 0, fontSize: 12, color: '#4b5563', cursor: 'pointer',
};
const mutedStyle: React.CSSProperties = { margin: 0, fontSize: 13, color: '#6b6b74' };
