import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

// Mirrors `report-service/app/models/calendar_event.py`. Kept in shared so the
// admin panel and PWA share one source of truth — the Faz 3 real-client
// reads from these schemas to validate backend responses.

export const calendarEventKindSchema = z.enum(['follow-up', 'meeting', 'custom']);
export type CalendarEventKind = z.infer<typeof calendarEventKindSchema>;

export const calendarEventStatusSchema = z.enum([
  'scheduled',
  'notified',
  'completed',
  'cancelled',
]);
export type CalendarEventStatus = z.infer<typeof calendarEventStatusSchema>;

export const calendarEventSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  company_id: uuidSchema,
  customer_id: uuidSchema.nullable().optional(),
  report_id: uuidSchema.nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  start_at: isoDateTimeSchema,
  end_at: isoDateTimeSchema.nullable().optional(),
  kind: calendarEventKindSchema,
  status: calendarEventStatusSchema,
  reminder_sent_at: isoDateTimeSchema.nullable().optional(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start_at: isoDateTimeSchema,
  end_at: isoDateTimeSchema.optional(),
  kind: calendarEventKindSchema.default('follow-up'),
  customer_id: uuidSchema.optional(),
  report_id: uuidSchema.optional(),
});
export type CalendarEventCreate = z.infer<typeof calendarEventCreateSchema>;

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial().extend({
  status: calendarEventStatusSchema.optional(),
});
export type CalendarEventUpdate = z.infer<typeof calendarEventUpdateSchema>;
