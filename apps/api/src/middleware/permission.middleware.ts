import type { PermissionCode } from "@smsystem/permissions";
import { hasAnyPermission, hasPermission } from "@smsystem/permissions";
import { errorResponse } from "@/http/response";
import type { WebSession } from "@/services/auth/session.service";

export function requirePermission(
  request: Request,
  session: WebSession,
  permission: PermissionCode,
): { ok: true } | { response: Response } {
  if (hasPermission(session.user.permissions, permission)) {
    return { ok: true };
  }

  return {
    response: errorResponse(
      request,
      "Kamu tidak memiliki izin untuk mengakses resource ini.",
      403,
      "FORBIDDEN",
      {
        requiredPermission: permission,
      },
    ),
  };
}

export function requireAnyPermission(
  request: Request,
  session: WebSession,
  permissions: readonly PermissionCode[],
): { ok: true } | { response: Response } {
  if (hasAnyPermission(session.user.permissions, permissions)) {
    return { ok: true };
  }

  return {
    response: errorResponse(
      request,
      "Kamu tidak memiliki izin untuk mengakses resource ini.",
      403,
      "FORBIDDEN",
      {
        requiredPermissions: permissions,
      },
    ),
  };
}
