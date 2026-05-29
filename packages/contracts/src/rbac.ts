import { z } from "zod";

export const roleScopeBasisSchema = z.enum([
  "GLOBAL",
  "ASSIGNED_DIVISIONS",
  "ASSIGNED_UNITS",
  "OWN_DIVISION",
  "SELF_ONLY",
]);

export const roleDivisionScopeModeSchema = z.enum([
  "NONE",
  "OWN_DIVISION",
  "ASSIGNED_DIVISIONS",
  "GLOBAL",
]);

export const roleUnitScopeModeSchema = z.enum([
  "NONE",
  "ASSIGNED_UNITS",
  "GLOBAL",
]);

export const permissionPlatformSchema = z.enum(["WEB", "MOBILE"]);

export const permissionAudienceSchema = z.enum(["SHARED", "WEB", "MOBILE"]);

export const roleScopePresetSchema = z.object({
  divisionMode: roleDivisionScopeModeSchema,
  divisionIds: z.array(z.number().int().positive()).max(200),
  unitMode: roleUnitScopeModeSchema,
  unitIds: z.array(z.string().trim().min(1).max(64)).max(200),
});

export const roleProfileSchema = z.object({
  roleLevel: z.number().int().min(0).max(999),
  scopeBasis: roleScopeBasisSchema,
  webEnabled: z.boolean(),
  mobileEnabled: z.boolean(),
  approvalRank: z.number().int().min(0).max(999).nullable(),
  notes: z.string().nullable(),
  scopePreset: roleScopePresetSchema.optional(),
});

export const createRoleRequestSchema = z.object({
  roleName: z.string().trim().min(1).max(50),
  description: z.string().trim().max(255).nullable().optional(),
  profile: roleProfileSchema.optional(),
});

export const updateRoleRequestSchema = z.object({
  roleName: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  profile: roleProfileSchema.partial().optional(),
});

export const updateRolePermissionsRequestSchema = z.object({
  permissionIds: z.array(z.number().int().positive()).max(200),
});

export const roleRecordSchema = z.object({
  id: z.number().int().positive(),
  roleName: z.string(),
  description: z.string().nullable(),
  userCount: z.number().int().nonnegative(),
  permissionCount: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  profile: roleProfileSchema.nullable().optional(),
});

export const permissionRecordSchema = z.object({
  id: z.number().int().positive(),
  permissionCode: z.string(),
  description: z.string().nullable(),
  moduleName: z.string().nullable(),
  platforms: z.array(permissionPlatformSchema).optional(),
  audience: permissionAudienceSchema.optional(),
});

export const roleReferenceOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const rolesEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    roles: z.array(roleRecordSchema),
  }),
});

export const permissionsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    permissions: z.array(permissionRecordSchema),
  }),
});

export const rolePermissionsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    roleId: z.number().int().positive(),
    permissionIds: z.array(z.number().int().positive()),
  }),
});

export const roleReferencesEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    divisions: z.array(roleReferenceOptionSchema),
    units: z.array(roleReferenceOptionSchema),
  }),
});

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type UpdateRolePermissionsRequest = z.infer<
  typeof updateRolePermissionsRequestSchema
>;
export type RoleRecord = z.infer<typeof roleRecordSchema>;
export type PermissionRecord = z.infer<typeof permissionRecordSchema>;
export type RoleProfile = z.infer<typeof roleProfileSchema>;
export type RoleScopeBasis = z.infer<typeof roleScopeBasisSchema>;
export type RoleDivisionScopeMode = z.infer<typeof roleDivisionScopeModeSchema>;
export type RoleUnitScopeMode = z.infer<typeof roleUnitScopeModeSchema>;
export type RoleScopePreset = z.infer<typeof roleScopePresetSchema>;
export type PermissionPlatform = z.infer<typeof permissionPlatformSchema>;
export type PermissionAudience = z.infer<typeof permissionAudienceSchema>;
export type RoleReferenceOption = z.infer<typeof roleReferenceOptionSchema>;
