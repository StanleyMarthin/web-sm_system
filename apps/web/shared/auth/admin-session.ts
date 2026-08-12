import "server-only";
import { cache } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";

// ─── SPF Role type ────────────────────────────────────────────────────────────
const SPF_ROLES = ["ADMIN", "APPROVER", "PUBLISHER"] as const;
export type SpfRole = (typeof SPF_ROLES)[number];

// ─── Session shape for SPF module ─────────────────────────────────────────────
export type AdminSession = Readonly<{
  employeeId: string;
  role: SpfRole;
  canAdmin: boolean;
  canApprove: boolean;
  canPublish: boolean;
  user: AuthUser;
}>;

// ─── Permission → SPF role mapping ───────────────────────────────────────────
// Backend smsystem memegang otoritas akhir pada setiap mode.
// Mapping ini mencegah UI dan BFF membuat claim berbeda.
export type SpfCapabilities = Pick<AdminSession, "canAdmin" | "canApprove" | "canPublish">;

function deriveSpfCapabilities(permissions: readonly string[], roleName?: string): SpfCapabilities {
  const isMis = roleName?.trim().toLowerCase() === "mis";
  return {
    canAdmin: isMis || permissions.includes(permissionCodes.spfAdmin),
    canApprove: isMis || permissions.includes(permissionCodes.spfApprove),
    canPublish: isMis || permissions.includes(permissionCodes.spfPublish),
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

    const capabilities = deriveSpfCapabilities(user.permissions, user.roleName);
    if (!capabilities.canAdmin && !capabilities.canApprove && !capabilities.canPublish) {
      return null;
    }

    const role: SpfRole = capabilities.canPublish ? "PUBLISHER" : capabilities.canApprove ? "APPROVER" : "ADMIN";
    return { employeeId, role, ...capabilities, user };
  },
);
