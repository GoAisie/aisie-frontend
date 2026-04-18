import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

// ReportStatus enum values match backend `Report.status` literal (hyphenated on
// the wire). Approval-related values exist in backend but are NOT used in v1
// per plan decision ("Report approval: Mekanizma v1'de yok").
export const reportStatusSchema = z.enum([
  'in-progress',
  'completed',
  'archived',
  'pending-approval',
  'approved',
  'rejected',
]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

// Report `data` is an open record keyed by `FieldSchema.name`. Values come from
// the LLM extraction and can be string / number / boolean / ISO date string / null.
// Backend stores `Dict[str, Any]`; we keep it loose here and validate per-template
// on submit/edit (Faz 2 adds field-level validation on PUT /reports/{id}).
export const reportDataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type ReportData = z.infer<typeof reportDataSchema>;

export const reportSchema = z.object({
  report_id: uuidSchema,
  base_report_id: uuidSchema,
  version: z.number().int().positive(),

  user_id: uuidSchema,
  user_name: z.string(),
  company_id: uuidSchema,
  company_name: z.string(),

  template_version_id: z.string(), // Mongo ObjectId of ReportTemplate version
  template_name: z.string(),

  data: reportDataSchema,
  status: reportStatusSchema,

  is_approved: z.boolean(),
  is_email_sent: z.boolean(),
  email_sent_at: isoDateTimeSchema.nullable().optional(),

  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Report = z.infer<typeof reportSchema>;

// PUT /api/v1/reports/{id} body. Field-level validation (key-set vs template
// fields, type coercion) is enforced server-side in Faz 2.
export const updateReportRequestSchema = z.object({
  data: reportDataSchema,
});
export type UpdateReportRequest = z.infer<typeof updateReportRequestSchema>;
