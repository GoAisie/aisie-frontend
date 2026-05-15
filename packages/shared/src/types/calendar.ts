import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

// Mirrors `report-service/app/models/calendar_event.py`. Kept in shared so the
// admin panel and PWA share one source of truth.
//
// `kind` and `status` fields were removed in May 2026 — see backend model
// docstring. Cancellation flows through soft-delete (`to_be_deleted`)
// consistent with reports and customer contacts.

export const calendarEventSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  company_id: uuidSchema,
  customer_id: uuidSchema.nullable().optional(),
  report_id: uuidSchema.nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  start_at: isoDateTimeSchema,
  reminder_sent_at: isoDateTimeSchema.nullable().optional(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: isoDateTimeSchema,
  customer_id: uuidSchema.optional(),
  report_id: uuidSchema.optional(),
});
export type CalendarEventCreate = z.infer<typeof calendarEventCreateSchema>;

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial();
export type CalendarEventUpdate = z.infer<typeof calendarEventUpdateSchema>;
