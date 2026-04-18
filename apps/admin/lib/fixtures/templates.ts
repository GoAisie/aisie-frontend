import type { AdminTemplateRow } from './types';

export const ADMIN_TEMPLATES_FIXTURE: AdminTemplateRow[] = [
  { id: 't-01', name: 'Satış Görüşmesi', baseId: 'sales_visit', version: 3, fieldCount: 8, lastUsedAt: '2026-04-18T09:45:00+03:00' },
  { id: 't-02', name: 'İlk Temas', baseId: 'initial_contact', version: 1, fieldCount: 5, lastUsedAt: '2026-04-17T15:30:00+03:00' },
  { id: 't-03', name: 'Takip Araması', baseId: 'followup_call', version: 2, fieldCount: 6, lastUsedAt: '2026-04-17T11:20:00+03:00' },
  { id: 't-04', name: 'Teklif Değerlendirme', baseId: 'quote_review', version: 2, fieldCount: 7, lastUsedAt: '2026-04-16T10:15:00+03:00' },
  { id: 't-05', name: 'Keşif Ziyareti', baseId: 'discovery_visit', version: 1, fieldCount: 9, lastUsedAt: '2026-04-15T14:40:00+03:00' },
];
