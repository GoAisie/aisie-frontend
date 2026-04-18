import { z } from 'zod';

// Backend emits UUIDs as strings over the wire (Python uuid.UUID -> JSON string).
// Validate format to catch drift early (e.g. gateway accidentally forwarding an int).
export const uuidSchema = z.string().uuid();

// Backend emits datetimes as ISO 8601 strings via Pydantic's default encoder.
// We keep them as strings on the client (do not coerce to Date here — let the caller do it).
export const isoDateTimeSchema = z.string().datetime({ offset: true });

// Generic paginated-list envelope used by list endpoints (reports, customers, calendar).
export const paginatedListSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    skip: z.number().int().nonnegative(),
  });

export type UUID = z.infer<typeof uuidSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
