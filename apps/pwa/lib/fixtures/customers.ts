import type { CustomerListItem } from './types';

// Hand-crafted fixtures for Faz 1. Values mirror a typical Turkish B2B
// pilot customer book so the UI doesn't look empty before the real
// backend lands in Faz 3.
export const CUSTOMERS_FIXTURE: CustomerListItem[] = [
  {
    id: 'c-01',
    name: 'Ahmet Yılmaz',
    company: 'Tek Gıda Ltd. Şti.',
    phone: '+90 532 123 45 67',
    email: 'ahmet.yilmaz@tekgida.com.tr',
    lastContactAt: '2026-04-18T09:45:00+03:00',
  },
  {
    id: 'c-02',
    name: 'Ayşe Kaya',
    company: 'Mavi Tekstil A.Ş.',
    phone: '+90 544 987 65 43',
    email: 'a.kaya@mavitekstil.com.tr',
    lastContactAt: '2026-04-17T15:30:00+03:00',
  },
  {
    id: 'c-03',
    name: 'Mehmet Demir',
    company: 'ÖzKimya Kozmetik',
    phone: '+90 505 555 12 34',
    email: 'mdemir@ozkimya.com',
    lastContactAt: '2026-04-17T11:20:00+03:00',
  },
  {
    id: 'c-04',
    name: 'Fatma Şahin',
    company: 'Yeni Dünya İnşaat',
    phone: '+90 536 421 78 90',
    email: 'f.sahin@yenidunyainsaat.com',
    lastContactAt: '2026-04-16T16:00:00+03:00',
  },
  {
    id: 'c-05',
    name: 'Can Öztürk',
    company: 'Aksu Mobilya',
    phone: '+90 553 219 55 77',
    email: 'can@aksumobilya.com',
    lastContactAt: '2026-04-16T10:15:00+03:00',
  },
  {
    id: 'c-06',
    name: 'Zeynep Arslan',
    company: 'Güneş Solar Enerji',
    phone: '+90 545 118 22 33',
    email: 'z.arslan@gunessolar.com.tr',
    lastContactAt: '2026-04-15T14:40:00+03:00',
  },
  {
    id: 'c-07',
    name: 'Emre Koç',
    company: 'Deniz Lojistik',
    phone: '+90 530 777 88 99',
    email: 'emre.koc@denizlojistik.com',
    lastContactAt: '2026-04-15T09:00:00+03:00',
  },
  {
    id: 'c-08',
    name: 'Seda Çelik',
    company: 'Atlas Teknoloji',
    phone: '+90 549 331 44 55',
    email: 's.celik@atlastech.com.tr',
    lastContactAt: null,
  },
];
