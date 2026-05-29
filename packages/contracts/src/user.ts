import { roleScopeBasisSchema } from "@smsystem/contracts/rbac";
import { gridMetaSchema, gridQueryStateSchema } from "@smsystem/contracts/grid";
import { z } from "zod";

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const userReferenceOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  scopeBasis: roleScopeBasisSchema.optional(),
  approvalRank: z.number().int().min(0).max(999).nullable().optional(),
  webEnabled: z.boolean().optional(),
  mobileEnabled: z.boolean().optional(),
});

export const createUserRequestSchema = z.object({
  employeeId: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(255),
  email: z.string().email().nullable().optional(),
  password: z.string().trim().min(8).max(255),
  roleId: z.number().int().positive(),
  divisionId: z.number().int().positive(),
  grade: z.string().trim().max(50).nullable().optional(),
  managedDivisionIds: z.array(z.number().int().positive()).max(50).optional(),
});

export const updateUserRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().nullable().optional(),
  roleId: z.number().int().positive().optional(),
  divisionId: z.number().int().positive().optional(),
  grade: z.string().trim().max(50).nullable().optional(),
  managedDivisionIds: z.array(z.number().int().positive()).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string().trim().min(8).max(255),
});

export const userRecordSchema = z.object({
  employeeId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  roleId: z.number().int().nullable(),
  roleName: z.string(),
  divisionId: z.number().int().nullable(),
  divisionName: z.string(),
  grade: z.string().nullable(),
  status: userStatusSchema,
  lastLoginAt: z.string().nullable(),
  deviceCount: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  managedDivisionIds: z.array(z.number().int().positive()),
  managedDivisionNames: z.array(z.string()),
  activeUnitIds: z.array(z.string()),
});

export const userEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    user: userRecordSchema,
  }),
});

export const userGridReferenceSchema = z.object({
  roles: z.array(userReferenceOptionSchema),
  divisions: z.array(userReferenceOptionSchema),
});

export const userGridEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(userRecordSchema),
  meta: gridMetaSchema,
  references: userGridReferenceSchema,
  query: gridQueryStateSchema,
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type UserRecord = z.infer<typeof userRecordSchema>;
export type UserGridReference = z.infer<typeof userGridReferenceSchema>;
