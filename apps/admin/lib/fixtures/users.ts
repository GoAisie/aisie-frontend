import type { AdminUserRow } from './types';

export const ADMIN_USERS_FIXTURE: AdminUserRow[] = [
  {
    id: 'u-01',
    name: 'Anıl Sale',
    email: 'anilsale94@gmail.com',
    role: 'COMPANY_ADMIN',
    reportCountThisMonth: 24,
    lastActiveAt: '2026-04-18T09:58:00+03:00',
  },
  {
    id: 'u-02',
    name: 'Mehmet Aksoy',
    email: 'm.aksoy@pilotfirma.com',
    role: 'SALES_REP',
    reportCountThisMonth: 18,
    lastActiveAt: '2026-04-17T15:42:00+03:00',
  },
  {
    id: 'u-03',
    name: 'Selin Yıldırım',
    email: 's.yildirim@pilotfirma.com',
    role: 'SALES_MANAGER',
    reportCountThisMonth: 11,
    lastActiveAt: '2026-04-16T16:22:00+03:00',
  },
  {
    id: 'u-04',
    name: 'Burak Çelik',
    email: 'b.celik@pilotfirma.com',
    role: 'SALES_REP',
    reportCountThisMonth: 9,
    lastActiveAt: '2026-04-14T11:41:00+03:00',
  },
];
