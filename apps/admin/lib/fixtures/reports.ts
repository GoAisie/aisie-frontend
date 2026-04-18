import type { AdminReportDetail, AdminReportRow } from './types';

// Company-wide fixture for admin — 4 reps, mix of templates/statuses so
// filters and pagination UI look populated. In Faz 3a the list view calls
// GET /api/v1/reports?scope=company (admin-only) to replace this.
export const ADMIN_REPORTS_FIXTURE: AdminReportRow[] = [
  { id: 'r-01', customerName: 'Ahmet Yılmaz', templateName: 'Satış Görüşmesi', repName: 'Anıl Sale', status: 'completed', createdAt: '2026-04-18T09:45:00+03:00', updatedAt: '2026-04-18T09:58:00+03:00' },
  { id: 'r-02', customerName: 'Ayşe Kaya', templateName: 'İlk Temas', repName: 'Mehmet Aksoy', status: 'completed', createdAt: '2026-04-17T15:30:00+03:00', updatedAt: '2026-04-17T15:42:00+03:00' },
  { id: 'r-03', customerName: 'Mehmet Demir', templateName: 'Takip Araması', repName: 'Anıl Sale', status: 'completed', createdAt: '2026-04-17T11:20:00+03:00', updatedAt: '2026-04-17T11:30:00+03:00' },
  { id: 'r-04', customerName: 'Fatma Şahin', templateName: 'Satış Görüşmesi', repName: 'Selin Yıldırım', status: 'in-progress', createdAt: '2026-04-16T16:00:00+03:00', updatedAt: '2026-04-16T16:22:00+03:00' },
  { id: 'r-05', customerName: 'Can Öztürk', templateName: 'Teklif Değerlendirme', repName: 'Mehmet Aksoy', status: 'completed', createdAt: '2026-04-16T10:15:00+03:00', updatedAt: '2026-04-16T10:28:00+03:00' },
  { id: 'r-06', customerName: 'Zeynep Arslan', templateName: 'Keşif Ziyareti', repName: 'Anıl Sale', status: 'completed', createdAt: '2026-04-15T14:40:00+03:00', updatedAt: '2026-04-15T14:55:00+03:00' },
  { id: 'r-07', customerName: 'Emre Koç', templateName: 'Satış Görüşmesi', repName: 'Selin Yıldırım', status: 'completed', createdAt: '2026-04-15T09:00:00+03:00', updatedAt: '2026-04-15T09:14:00+03:00' },
  { id: 'r-08', customerName: 'Deniz Aydın', templateName: 'İlk Temas', repName: 'Burak Çelik', status: 'completed', createdAt: '2026-04-14T11:30:00+03:00', updatedAt: '2026-04-14T11:41:00+03:00' },
  { id: 'r-09', customerName: 'Elif Gündüz', templateName: 'Takip Araması', repName: 'Mehmet Aksoy', status: 'archived', createdAt: '2026-04-14T08:15:00+03:00', updatedAt: '2026-04-14T08:24:00+03:00' },
  { id: 'r-10', customerName: 'Osman Tekin', templateName: 'Satış Görüşmesi', repName: 'Burak Çelik', status: 'completed', createdAt: '2026-04-13T17:00:00+03:00', updatedAt: '2026-04-13T17:16:00+03:00' },
  { id: 'r-11', customerName: 'Seda Çelik', templateName: 'Keşif Ziyareti', repName: 'Selin Yıldırım', status: 'in-progress', createdAt: '2026-04-13T13:45:00+03:00', updatedAt: '2026-04-13T14:02:00+03:00' },
  { id: 'r-12', customerName: 'Ahmet Yılmaz', templateName: 'Takip Araması', repName: 'Anıl Sale', status: 'completed', createdAt: '2026-04-12T10:30:00+03:00', updatedAt: '2026-04-12T10:39:00+03:00' },
];

export const ADMIN_REPORT_DETAIL_FIXTURE: Record<string, AdminReportDetail> = {
  'r-01': {
    id: 'r-01',
    customerName: 'Ahmet Yılmaz',
    templateName: 'Satış Görüşmesi',
    repName: 'Anıl Sale',
    status: 'completed',
    createdAt: '2026-04-18T09:45:00+03:00',
    updatedAt: '2026-04-18T09:58:00+03:00',
    templateFields: [
      { name: 'customer_name', label: 'Müşteri Adı', type: 'string', required: true },
      { name: 'meeting_outcome', label: 'Görüşme Sonucu', type: 'single-select', required: true, options: ['Olumlu', 'Nötr', 'Olumsuz'] },
      { name: 'estimated_value', label: 'Tahmini Değer (TL)', type: 'number', required: false },
      { name: 'next_action_date', label: 'Sonraki Aksiyon Tarihi', type: 'date', required: false },
      { name: 'needs_followup', label: 'Takip Gerekiyor mu?', type: 'boolean', required: false },
      { name: 'notes', label: 'Notlar', type: 'string', required: false },
    ],
    data: {
      customer_name: 'Ahmet Yılmaz',
      meeting_outcome: 'Olumlu',
      estimated_value: 125000,
      next_action_date: '2026-04-25',
      needs_followup: true,
      notes: 'Teklifimizi inceleyip geri dönecek. Fiyat konusunda esneklik istiyor.',
    },
  },
  'r-04': {
    id: 'r-04',
    customerName: 'Fatma Şahin',
    templateName: 'Satış Görüşmesi',
    repName: 'Selin Yıldırım',
    status: 'in-progress',
    createdAt: '2026-04-16T16:00:00+03:00',
    updatedAt: '2026-04-16T16:22:00+03:00',
    templateFields: [
      { name: 'customer_name', label: 'Müşteri Adı', type: 'string', required: true },
      { name: 'meeting_outcome', label: 'Görüşme Sonucu', type: 'single-select', required: true, options: ['Olumlu', 'Nötr', 'Olumsuz'] },
      { name: 'estimated_value', label: 'Tahmini Değer (TL)', type: 'number', required: false },
      { name: 'next_action_date', label: 'Sonraki Aksiyon Tarihi', type: 'date', required: false },
      { name: 'needs_followup', label: 'Takip Gerekiyor mu?', type: 'boolean', required: false },
      { name: 'notes', label: 'Notlar', type: 'string', required: false },
    ],
    data: {
      customer_name: 'Fatma Şahin',
      meeting_outcome: null,
      estimated_value: null,
      next_action_date: null,
      needs_followup: null,
      notes: 'Şantiye ziyareti planlandı, detaylar yarın netleşecek.',
    },
  },
};
