import "server-only";
import { cache } from "react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { fetchCurrentUser } from "@/shared/auth/server";

// ─── SPF Role type ────────────────────────────────────────────────────────────
const SPF_ROLES = ["ADMIN", "APPROVER", "PUBLISHER"] as const;
export type SpfRole = (typeof SPF_ROLES)[number];

// ─── Session shape for SPF module ─────────────────────────────────────────────
export type AdminSession = Readonly<{
  employeeId: string;
  role: SpfRole;
  user: AuthUser;
}>;

// ─── Permission → SPF role mapping ───────────────────────────────────────────
// Backend smsystem memegang otoritas akhir pada setiap mode.
// Mapping ini mencegah UI dan BFF membuat claim berbeda.
const PERMISSION_TO_ROLE: Record<string, SpfRole> = {
  // Hak publish laporan SPF ke portal klien
  "spf:publish": "PUBLISHER",
  // Hak menyetujui atau menolak laporan SPF
  "spf:approve": "APPROVER",
  // Hak membuat, mengedit, dan mengirim laporan SPF
  "spf:admin": "ADMIN",
};

function deriveSpfRole(permissions: string[], roleName?: string): SpfRole {
  // Prioritas: PUBLISHER > APPROVER > ADMIN
  for (const perm of ["spf:publish", "spf:approve", "spf:admin"] as const) {
    if (permissions.includes(perm)) {
      return PERMISSION_TO_ROLE[perm]!;
    }
  }
  // Fallback: Jika user terautentikasi di ERP namun claim 'spf:*' spesifik belum
  // ditambahkan ke database RBAC, berikan akses ADMIN secara default agar
  // pengguna yang terverifikasi tidak terpental.
  return "ADMIN";
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

    const role = deriveSpfRole(user.permissions, user.roleName);
    return { employeeId, role, user };
  },
);
