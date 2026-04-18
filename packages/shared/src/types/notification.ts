import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

export const notificationKindSchema = z.enum([
  'calendar_reminder',
  'report_completed',
  'generic',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

// payload is intentionally open — each `kind` defines its own shape. The PWA
// does a type-narrowed parse per kind when rendering rich cards; until then
// a passthrough record keeps the contract from breaking on new kinds.
export const notificationSchema = z.object({
  notification_id: uuidSchema,
  user_id: uuidSchema,
  company_id: uuidSchema,
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable().optional(),
  payload: z.record(z.string(), z.unknown()),
  read_at: isoDateTimeSchema.nullable().optional(),
  created_at: isoDateTimeSchema,
});
export type Notification = z.infer<typeof notificationSchema>;
