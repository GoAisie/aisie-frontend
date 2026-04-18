import { z } from 'zod';
import { uuidSchema } from './common';

// CustomerContact is the embedded document inside `CustomerList.customers`.
// Email is optional (Pydantic EmailStr → nullable on wire).
export const customerContactSchema = z.object({
  name: z.string().min(1),
  phone_number: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});
export type CustomerContact = z.infer<typeof customerContactSchema>;

export const customerListSchema = z.object({
  company_id: uuidSchema,
  company_name: z.string(),
  customers: z.array(customerContactSchema),
});
export type CustomerList = z.infer<typeof customerListSchema>;

// Request body for POST /manage/companies/{id}/customers. Server assigns no id
// today; if PUT/DELETE endpoints are added in Faz 2, the embedded docs will
// need stable ids — note this for that work.
export const createCustomerRequestSchema = customerContactSchema;
export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
