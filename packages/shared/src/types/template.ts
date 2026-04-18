import { z } from 'zod';
import { uuidSchema } from './common';

// Field types match backend `report_template.FieldSchema.type` literal. When the
// backend adds a new type, update this enum AND the field rendering in the PWA.
export const fieldTypeSchema = z.enum([
  'string',
  'number',
  'date',
  'time',
  'boolean',
  'single-select',
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

// `entity_type = "customer"` marks a field for special matching (AI checks the
// company's CustomerList before inventing a new customer). Extensible: backend
// may add other entity types later.
export const fieldEntityTypeSchema = z.enum(['customer']);
export type FieldEntityType = z.infer<typeof fieldEntityTypeSchema>;

export const fieldSchemaSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: fieldTypeSchema,
  description: z.string().nullable().optional(),
  required: z.boolean().default(true),
  options: z.array(z.string()).nullable().optional(),
  entity_type: fieldEntityTypeSchema.nullable().optional(),
});
export type FieldSchema = z.infer<typeof fieldSchemaSchema>;

export const reportTemplateSchema = z.object({
  _id: z.string().optional(), // Mongo ObjectId; surfaced by backend on read
  base_id: z.string().min(1),
  version: z.number().int().positive(),
  is_latest: z.boolean(),
  name: z.string().min(1),
  company_id: uuidSchema,
  company_name: z.string(),
  fields: z.array(fieldSchemaSchema),
  needs_approval: z.boolean().default(false),
});
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;
