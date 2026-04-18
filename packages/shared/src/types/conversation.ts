import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

// LangChain/OpenAI standard conversation roles. `function` rows carry the result
// of an AI tool invocation (e.g. fill_report_template, create_customer) and
// `assistant` rows may carry a `function_call` to request one.
export const conversationRoleSchema = z.enum(['user', 'assistant', 'function']);
export type ConversationRole = z.infer<typeof conversationRoleSchema>;

export const conversationTurnSchema = z.object({
  role: conversationRoleSchema,
  content: z.string(),
  function_call: z
    .object({
      name: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })
    .nullable()
    .optional(),
  name: z.string().nullable().optional(),
  timestamp: isoDateTimeSchema,
});
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

export const conversationSchema = z.object({
  conversation_id: uuidSchema,
  user_id: uuidSchema,
  user_name: z.string(),
  company_id: uuidSchema,
  company_name: z.string(),
  active_report_id: uuidSchema.nullable().optional(),
  report_ids: z.array(uuidSchema),
  turns: z.array(conversationTurnSchema),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type Conversation = z.infer<typeof conversationSchema>;
