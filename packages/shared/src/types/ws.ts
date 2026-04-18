import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';
import { reportDataSchema, reportStatusSchema } from './report';

// WebSocket message protocol shared between PWA and report-service hands-free
// streaming session. Final shape locked in Faz 2. For Faz 1 (mock backend)
// only a subset is emitted; the rest will flow once streaming is wired.

// ===== Server → Client =====
export const wsReadySchema = z.object({ type: z.literal('ready') });

export const wsPartialTranscriptSchema = z.object({
  type: z.literal('partial_transcript'),
  text: z.string(),
});
export const wsFinalTranscriptSchema = z.object({
  type: z.literal('final_transcript'),
  text: z.string(),
});
export const wsAiTextSchema = z.object({
  type: z.literal('ai_text'),
  text: z.string(),
});
export const wsTtsChunkStartSchema = z.object({
  type: z.literal('tts_chunk_start'),
  format: z.literal('pcm'),
  sample_rate: z.number().int().positive(),
});
export const wsTtsEndSchema = z.object({ type: z.literal('tts_end') });

export const wsTurnCompleteSchema = z.object({
  type: z.literal('turn_complete'),
  report_id: uuidSchema.nullable().optional(),
  report_data: reportDataSchema.nullable().optional(),
  report_status: reportStatusSchema.nullable().optional(),
});

export const wsTemplateActivatedSchema = z.object({
  type: z.literal('template_activated'),
  template_id: z.string(),
  template_name: z.string(),
});
export const wsTemplateSwitchedSchema = z.object({
  type: z.literal('template_switched'),
  new_template_id: z.string(),
  new_template_name: z.string(),
});
export const wsCustomerCreatedSchema = z.object({
  type: z.literal('customer_created'),
  customer_name: z.string(),
});
// Emitted when filling a date field marked `entity_type="followup_date"`
// triggers calendar_auto to create/update a CalendarEvent. The PWA uses it
// to nudge the user ("Takip 22 Nis 14:00'e eklendi") without requiring a
// separate LLM tool call.
export const wsFollowupScheduledSchema = z.object({
  type: z.literal('followup_scheduled'),
  event_id: uuidSchema,
  title: z.string(),
  start_at: isoDateTimeSchema,
});
export const wsErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const wsServerMessageSchema = z.discriminatedUnion('type', [
  wsReadySchema,
  wsPartialTranscriptSchema,
  wsFinalTranscriptSchema,
  wsAiTextSchema,
  wsTtsChunkStartSchema,
  wsTtsEndSchema,
  wsTurnCompleteSchema,
  wsTemplateActivatedSchema,
  wsTemplateSwitchedSchema,
  wsCustomerCreatedSchema,
  wsFollowupScheduledSchema,
  wsErrorSchema,
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;

// ===== Client → Server =====
export const wsEndOfUtteranceSchema = z.object({ type: z.literal('end_of_utterance') });
export const wsBargeInSchema = z.object({ type: z.literal('barge_in') });
export const wsPingSchema = z.object({ type: z.literal('ping') });
export const wsPongSchema = z.object({ type: z.literal('pong') });

export const wsClientMessageSchema = z.discriminatedUnion('type', [
  wsEndOfUtteranceSchema,
  wsBargeInSchema,
  wsPingSchema,
  wsPongSchema,
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;
