import { z } from 'zod';
import { uuidSchema } from './common';

// Roles mirror main-service `CompanyUserRole` enum. The `role` claim is added to
// the JWT in Faz 2.5; frontend receives it as part of the login response.
export const userRoleSchema = z.enum(['COMPANY_ADMIN', 'SALES_REP']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Matches the `UserDto` returned by main-service login/refresh/validate and the
// identity fields the gateway injects as headers (publicId, email, fullName,
// companyPublicId, companyName).
export const userSchema = z.object({
  publicId: uuidSchema,
  email: z.string().email(),
  fullName: z.string(),
  companyPublicId: uuidSchema,
  companyName: z.string(),
  role: userRoleSchema.optional(),
});
export type User = z.infer<typeof userSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Login response shape from main-service `AuthController.login`.
// main-service uses @JsonProperty snake_case on the wire; we normalise to
// camelCase here so the rest of the frontend never sees the backend naming.
export const loginResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number().int().positive(),
    user: userSchema,
  })
  .transform((d) => ({
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresIn: d.expires_in,
    user: d.user,
  }));
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

// Company + admin onboarding request — single shot at `/auth/register-company-and-admin`.
// Mirrors `CompanyAdminRegistrationRequest` DTO in main-service.
export const companyAdminRegistrationSchema = z.object({
  companyName: z.string().min(1),
  companyCode: z.string().min(1),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});
export type CompanyAdminRegistration = z.infer<typeof companyAdminRegistrationSchema>;
