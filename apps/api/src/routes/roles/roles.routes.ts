import {
  createRoleRequestSchema,
  updateRolePermissionsRequestSchema,
  updateRoleRequestSchema,
} from "@smsystem/contracts/rbac";
import { isSystemSuperadminEmployee } from "@smsystem/contracts/auth";
import { parseJsonBody } from "@/http/request";
import {
  errorResponse,
  successResponse,
} from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import type { RolesService } from "@/services/roles/roles.service";
import { SessionSynchronizationError } from "@/services/auth/session-synchronizer";

async function requireRoleMatrixSession(
  request: Request,
  authService: AuthService,
) {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult;
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

export async function handleRoleHistoryRoute(request: Request, roleId: number, authService: AuthService, rolesService: RolesService): Promise<Response> {
  const sessionResult = await requireRoleMatrixSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  try {
    const history = await rolesService.getRoleHistory(sessionResult.session, roleId);
    return successResponse(request, "Role history loaded", { history });
  } catch (error) {
    return mapRolesError(request, error);
  }
}

function mapRolesError(request: Request, error: unknown): Response {
  if (error instanceof SessionSynchronizationError) {
    return errorResponse(request, "Perubahan role sudah tersimpan, tetapi sesi aktif belum tersinkron. Muat ulang data dan coba sinkronkan kembali.", 503, "SESSION_SYNCHRONIZATION_FAILED");
  }

  if (error instanceof Error) {
    if (error.message === "ROLE_NOT_FOUND") {
      return errorResponse(request, "Role tidak ditemukan.", 404, "ROLE_NOT_FOUND");
    }
    if (error.message === "ROLE_PERMISSIONS_CHANGED") {
      return errorResponse(request, "Izin role berubah di sesi lain. Muat ulang sebelum menyimpan.", 409, "ROLE_PERMISSIONS_CHANGED");
    }
    if (error.message === "ROLE_SCOPE_STORAGE_UNAVAILABLE") {
      return errorResponse(request, "Pengaturan cakupan khusus belum tersedia di database. Perubahan tidak disimpan.", 409, "ROLE_SCOPE_STORAGE_UNAVAILABLE");
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
        ...(parsedBody.data.permissionIds === undefined ? {} : { permissionIds: await rolesService.getRolePermissionIds(sessionResult.session, role.id) }),
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
      ...(parsedBody.data.permissionIds === undefined ? {} : { permissionIds: await rolesService.getRolePermissionIds(sessionResult.session, role.id) }),
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
