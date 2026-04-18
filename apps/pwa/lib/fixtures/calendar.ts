import type { CalendarListItem } from './types';

export const CALENDAR_FIXTURE: CalendarListItem[] = [
  {
    id: 'e-01',
    title: 'Ahmet Yılmaz takip araması',
    startAt: '2026-04-18T15:00:00+03:00',
    kind: 'follow-up',
    customerName: 'Ahmet Yılmaz',
    note: 'Teklifle ilgili geri dönüş alınacak.',
  },
  {
    id: 'e-02',
    title: 'Fatma Şahin ile toplantı',
    startAt: '2026-04-19T10:00:00+03:00',
    kind: 'meeting',
    customerName: 'Fatma Şahin',
    note: 'Şantiye ziyareti, mimari plan sunumu.',
  },
  {
    id: 'e-03',
    title: 'Mehmet Demir — teklif son gün',
    startAt: '2026-04-21T14:00:00+03:00',
    kind: 'follow-up',
    customerName: 'Mehmet Demir',
    note: null,
  },
  {
    id: 'e-04',
    title: 'Zeynep Arslan keşif geri dönüşü',
    startAt: '2026-04-22T11:30:00+03:00',
    kind: 'follow-up',
    customerName: 'Zeynep Arslan',
    note: 'Çatı ölçümü sonrası fiyat teklifi iletilecek.',
  },
  {
    id: 'e-05',
    title: 'Haftalık satış ekibi toplantısı',
    startAt: '2026-04-24T09:30:00+03:00',
    kind: 'custom',
    customerName: null,
    note: 'Q2 hedefleri, pipeline review.',
  },
];
