import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

// Two-state lifecycle. The May 2026 cleanup removed approval / archival
// statuses — backend auto-flips IN_PROGRESS → COMPLETED on all-required-
// fields-filled (see report-service core/utils.check_report_completion).
export const reportStatusSchema = z.enum(['in-progress', 'completed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

// Report `data` is an open record keyed by `FieldSchema.name`. Values come from
// the LLM extraction and can be string / number / boolean / ISO date string / null.
// Server validates per-template on PUT (see reports.py::_validate_report_payload).
export const reportDataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type ReportData = z.infer<typeof reportDataSchema>;

export const reportSchema = z.object({
  report_id: uuidSchema,

  user_id: uuidSchema,
  user_name: z.string(),
  company_id: uuidSchema,
  company_name: z.string(),

  template_base_id: z.string().nullable().optional(),
  template_version_id: z.string(),
  template_name: z.string(),

  // Per-instance disambiguation keys (composite identity).
  subject_customer_name: z.string().nullable().optional(),
  report_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),

  data: reportDataSchema,
  status: reportStatusSchema,

  // Email delivery + dedup markers (Faz 6 — kept loose since admin UI only reads them).
  is_email_sent: z.boolean(),
  email_sent_at: isoDateTimeSchema.nullable().optional(),
  email_send_count: z.number().int().nonnegative().optional(),
  last_data_edit_at: isoDateTimeSchema.nullable().optional(),

  // Pipeline visibility + soft-delete flags. The list endpoint already
  // filters these out server-side; we declare them so direct GET-by-id
  // responses validate.
  is_visible: z.boolean().optional(),
  to_be_deleted: z.boolean().optional(),
  pc_created: z.boolean().optional(),
  source_conversation_id: uuidSchema.nullable().optional(),

  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Report = z.infer<typeof reportSchema>;

// PUT /api/v1/reports/{id} body. Field-level validation (key-set vs template
// fields, type coercion) is enforced server-side in reports.py.
export const updateReportRequestSchema = z.object({
  data: reportDataSchema,
});
export type UpdateReportRequest = z.infer<typeof updateReportRequestSchema>;
