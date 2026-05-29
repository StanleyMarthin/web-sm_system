import type { WebSession } from "@/services/auth/session.service";

function normalizeRoleName(roleName: string | null | undefined): string {
  return roleName?.trim().toLowerCase().replace(/[\s-]+/gu, "_") ?? "";
}

function isTechnicalDivisionLead(session: WebSession): boolean {
  const roleName = normalizeRoleName(session.user.roleName);
  return roleName === "ketua_divisi" || session.user.roleProfile?.approvalRank === 1;
}

function isAdvisor(session: WebSession): boolean {
  const roleName = normalizeRoleName(session.user.roleName);
  return roleName.includes("advisor") || session.user.roleProfile?.approvalRank === 2;
}

export function applyRequestsVisibilityScope(session: WebSession): WebSession {
  if (isTechnicalDivisionLead(session) || isAdvisor(session)) {
    return session;
  }

  return {
    ...session,
    user: {
      ...session.user,
      scope: {
        ...session.user.scope,
        canViewAllUnits: true,
        canViewAssignedUnits: true,
      },
    },
  };
}
