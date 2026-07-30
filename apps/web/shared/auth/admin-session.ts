import "server-only";
import { cache } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";

// ─── SPF Role type ────────────────────────────────────────────────────────────
export type SpfAccess = Readonly<{
  canAdmin: boolean;
  canApprove: boolean;
  canPublish: boolean;
}>;

// ─── Session shape for SPF module ─────────────────────────────────────────────
export type AdminSession = Readonly<{
  employeeId: string;
  access: SpfAccess;
  user: AuthUser;
}>;

// ─── Permission → SPF role mapping ───────────────────────────────────────────
// Backend smsystem memegang otoritas akhir pada setiap mode.
// Mapping ini mencegah UI dan BFF membuat claim berbeda.
function deriveSpfAccess(permissions: string[]): SpfAccess {
  return {
    canAdmin: permissions.includes(permissionCodes.spfAdmin),
    canApprove: permissions.includes(permissionCodes.spfApprove),
    canPublish: permissions.includes(permissionCodes.spfPublish),
  };
}

// ─── requireAdminSession ──────────────────────────────────────────────────────
// Wrapped dengan React cache() agar layout + page dalam satu render pass
// hanya memanggil /api/auth/me sekali.
export const requireAdminSession = cache(
  async (cookieHeader: string): Promise<AdminSession | null> => {
    const { user, status } = await fetchCurrentUser(cookieHeader);

    if (!user || status !== 200) {
      return null;
    }

    const employeeId = user.employeeId;
    if (!employeeId) {
      return null;
    }

    const access = deriveSpfAccess(user.permissions);
    if (!access.canAdmin && !access.canApprove && !access.canPublish) {
      return null;
    }
    return { employeeId, access, user };
  },
);
