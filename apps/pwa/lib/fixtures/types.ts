// UI-shaped types used by the Faz 1 fixtures and the tab list pages.
//
// Kept deliberately narrow — pages display a subset of the full backend
// models. When Faz 3 swaps fixtures for real data the mapping from the
// wire types in @aisie/shared to these UI types lives alongside the
// relevant TanStack Query hooks.

export type ReportStatusUi = 'in-progress' | 'completed';

export type ReportListItem = {
  id: string;
  customerName: string;
  templateName: string;
  repName: string;
  status: ReportStatusUi;
  createdAt: string;
};

export type CustomerListItem = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  lastContactAt: string | null;
};

export type CalendarEventKind = 'follow-up' | 'meeting' | 'custom';

export type CalendarListItem = {
  id: string;
  title: string;
  startAt: string;
  kind: CalendarEventKind;
  customerName: string | null;
  note: string | null;
};

export type AnalyticsSummary = {
  reportsThisWeek: number;
  reportsLastWeek: number;
  activeCustomers: number;
  completionRate: number;
  pendingFollowups: number;
  callsThisMonth: number;
};
