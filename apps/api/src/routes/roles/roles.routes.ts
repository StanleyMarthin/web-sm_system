import {
  createRoleRequestSchema,
  updateRolePermissionsRequestSchema,
  updateRoleRequestSchema,
} from "@smsystem/contracts/rbac";
import { permissionCodes } from "@smsystem/permissions";
import { isSystemSuperadminEmployee } from "@smsystem/contracts/auth";
import { parseJsonBody } from "@/http/request";
import {
  errorResponse,
  successResponse,
} from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { RolesService } from "@/services/roles/roles.service";

async function requireRoleMatrixSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
  }

  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.manageUsers,
  );
  if ("response" in permissionResult) {
    return permissionResult;
  }

  if (!isSystemSuperadminEmployee(sessionResult.session.user.employeeId)) {
    return {
      response: errorResponse(
        request,
        "Role Matrix hanya tersedia untuk superadmin.",
        403,
        "SUPERADMIN_REQUIRED",
      ),
    };
  }

  return { session: sessionResult.session };
}

function mapRolesError(request: Request, error: unknown): Response {
  if (error instanceof Error) {
    if (error.message === "ROLE_NOT_FOUND") {
      return errorResponse(request, "Role tidak ditemukan.", 404, "ROLE_NOT_FOUND");
    }

    if (error.message === "SUPERADMIN_REQUIRED") {
      return errorResponse(request, "Role Matrix hanya tersedia untuk superadmin.", 403, "SUPERADMIN_REQUIRED");
    }

    if (error.message === "RESERVED_ROLE_NAME") {
      return errorResponse(request, "Nama role ini khusus untuk sistem dan tidak dapat dipakai.", 400, "RESERVED_ROLE_NAME");
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  ) {
    return errorResponse(
      request,
      "Nama role sudah dipakai.",
      409,
      "DUPLICATE_ROLE_NAME",
    );
  }

  return errorResponse(
    request,
    "Terjadi kesalahan internal pada role management.",
    500,
    "ROLE_MANAGEMENT_FAILED",
  );
}

export async function handleRolesListRoute(
  request: Request,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const roles = await rolesService.listRoles(sessionResult.session);
    return successResponse(request, "Roles loaded", { roles });
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handleRolesReferencesRoute(
  request: Request,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const references = await rolesService.listReferences(sessionResult.session);
    return successResponse(request, "Role references loaded", references);
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handleRolesCreateRoute(
  request: Request,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, createRoleRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const role = await rolesService.createRole(sessionResult.session, parsedBody.data);
    return successResponse(
      request,
      "Role berhasil dibuat.",
      {
        role,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handleRolesUpdateRoute(
  request: Request,
  roleId: number,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(request, updateRoleRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const role = await rolesService.updateRole(
      sessionResult.session,
      roleId,
      parsedBody.data,
    );
    return successResponse(request, "Role berhasil diupdate.", {
      role,
    });
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handlePermissionsListRoute(
  request: Request,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const permissions = await rolesService.listPermissions(sessionResult.session);
    return successResponse(request, "Permissions loaded", { permissions });
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handleRolePermissionsDetailRoute(
  request: Request,
  roleId: number,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  try {
    const permissionIds = await rolesService.getRolePermissionIds(
      sessionResult.session,
      roleId,
    );
    return successResponse(request, "Role permissions loaded", { roleId, permissionIds });
  } catch (error) {
    return mapRolesError(request, error);
  }
}

export async function handleRolePermissionsUpdateRoute(
  request: Request,
  roleId: number,
  authService: AuthService,
  rolesService: RolesService,
): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const parsedBody = await parseJsonBody(
    request,
    updateRolePermissionsRequestSchema,
  );
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const permissionIds = await rolesService.updateRolePermissions(
      sessionResult.session,
      roleId,
      parsedBody.data,
    );
    return successResponse(request, "Role permissions updated", {
      roleId,
      permissionIds,
    });
  } catch (error) {
    return mapRolesError(request, error);
  }
}
