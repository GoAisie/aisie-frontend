// Narrow UI types for admin list/detail views. Faz 3a swaps these for
// schemas imported from @aisie/shared once the real backend flow is wired.

export type AdminReportStatus = 'in-progress' | 'completed' | 'archived';

export type AdminReportRow = {
  id: string;
  customerName: string;
  templateName: string;
  repName: string;
  status: AdminReportStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminReportField = {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'time' | 'boolean' | 'single-select';
  required: boolean;
  options?: string[];
};

export type AdminReportDetail = AdminReportRow & {
  templateFields: AdminReportField[];
  data: Record<string, string | number | boolean | null>;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'SALES_REP' | 'SALES_MANAGER';
  reportCountThisMonth: number;
  lastActiveAt: string | null;
};

export type AdminTemplateRow = {
  id: string;
  name: string;
  baseId: string;
  version: number;
  fieldCount: number;
  lastUsedAt: string | null;
};

export type AdminDashboard = {
  reportsThisWeek: number;
  reportsLastWeek: number;
  activeReps: number;
  completionRate: number;
  averageTurnsPerReport: number;
  pendingFollowups: number;
};
