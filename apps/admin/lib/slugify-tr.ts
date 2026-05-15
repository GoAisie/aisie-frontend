// Browser-side Turkish slugify — mirrors report-service/app/services/slugify_tr.py
// so the admin can see the canonical name as they type the label. Server
// re-derives this on save, so client output is a preview only — not load-
// bearing for security or correctness.

const TR_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'c',
  'ğ': 'g', 'Ğ': 'g',
  'ı': 'i', 'İ': 'i',
  'ö': 'o', 'Ö': 'o',
  'ş': 's', 'Ş': 's',
  'ü': 'u', 'Ü': 'u',
};

export function slugifyTr(label: string): string {
  if (!label) return 'field';
  const mapped = Array.from(label).map((ch) => TR_MAP[ch] ?? ch).join('');
  let base = mapped.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  base = base.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return (base || 'field').slice(0, 50);
}

export function generateCanonicalName(label: string, existing: Set<string>): string {
  const base = slugifyTr(label);
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  return candidate;
}

/** For a list of labels, return parallel array of unique canonical names. */
export function previewCanonicalNames(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const name = generateCanonicalName(label, seen);
    seen.add(name);
    out.push(name);
  }
  return out;
}
