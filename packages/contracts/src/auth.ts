import { z } from "zod";
import { roleProfileSchema } from "@smsystem/contracts/rbac";

export const SESSION_COOKIE_NAME = "sm_session";
export const REFRESH_COOKIE_NAME = "sm_refresh";
export const DEVICE_COOKIE_NAME = "sm_device_id";

export const loginRequestSchema = z.object({
  employeeId: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(255),
  force: z.boolean().optional().default(false),
});

export const authScopeSchema = z.object({
  canViewAllUnits: z.boolean(),
  canViewAssignedUnits: z.boolean(),
  divisionIds: z.array(z.number().int().nonnegative()),
  managedDivisionIds: z.array(z.number().int().nonnegative()),
  unitIds: z.array(z.string()),
});

export const authUserSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  photoUrl: z.string().nullable().optional(),
  roleId: z.number().int().nullable(),
  roleName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  grade: z.string().nullable(),
  permissions: z.array(z.string()),
  roleProfile: roleProfileSchema.nullable().optional(),
  scope: authScopeSchema,
});

export const authEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    user: authUserSchema,
  }),
});

export const permissionEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    permissions: z.array(z.string()),
  }),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthScope = z.infer<typeof authScopeSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
