import type { PermissionRecord } from "@smsystem/contracts/rbac";
import { permissionPresentation } from "./permission-registry";

export type PermissionAction = "View" | "Create" | "Approve" | "Process" | "Other";

export function permissionAction(permissionCode: string): PermissionAction {
  const presentation = permissionPresentation(permissionCode);
  if (presentation) return presentation[1];
  const code = permissionCode.toUpperCase();
  if (/(^|[_:.])(VIEW|LIST|PROFILE)([_:.]|$)/.test(code)) return "View";
  if (/(^|[_:.])CREATE([_:.]|$)/.test(code)) return "Create";
  if (/(APPROVE|VALIDATE)/.test(code)) return "Approve";
  if (/(UPDATE|SUBMIT|ASSIGN|EXECUTE|CHECKPOINT|BREAK|RECEIVE|ISSUE|RETURN|ORDER|RELEASE|PUBLISH|REQUEST|MANAGE)/.test(code)) return "Process";
  return "Other";
}

export function permissionLabel(permission: PermissionRecord): string {
  return permissionPresentation(permission.permissionCode)?.[2] || permission.description?.trim() || permission.permissionCode.replace(/[_.:]+/g, " ").toLowerCase();
}

export function permissionModule(permission: PermissionRecord): string {
  return permissionPresentation(permission.permissionCode)?.[0] || permission.moduleName?.trim() || "Lainnya";
}

export function permissionChanges(original: number[], draft: number[]) {
  return {
    added: draft.filter((id) => !original.includes(id)),
    removed: original.filter((id) => !draft.includes(id)),
  };
}

function auditObject(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function describeHistoryChange(oldValue: unknown, newValue: unknown, permissions: PermissionRecord[]): string[] {
  const before = auditObject(oldValue);
  const after = auditObject(newValue);
  if (!after) return ["Rincian perubahan tidak tersedia."];
  const oldRole = auditObject(before?.role) ?? before;
  const newRole = auditObject(after.role) ?? after;
  const lines: string[] = [];
  if (oldRole && newRole) {
    if (oldRole.roleName !== newRole.roleName) lines.push("Nama role diubah");
    if (oldRole.description !== newRole.description) lines.push("Keterangan diubah");
    if (JSON.stringify(oldRole.profile) !== JSON.stringify(newRole.profile)) lines.push("Pengaturan atau cakupan diubah");
  }
  const oldIds = before?.permissionIds;
  const newIds = after.permissionIds;
  if (Array.isArray(oldIds) && Array.isArray(newIds)) {
    const changes = permissionChanges(oldIds, newIds);
    const name = (id: number) => permissions.find((permission) => permission.id === id)?.permissionCode ?? String(id);
    lines.push(...changes.added.map((id) => `+ ${name(id)}`), ...changes.removed.map((id) => `- ${name(id)}`));
  } else if (Array.isArray(newIds)) {
    lines.push("Daftar izin disimpan; data sebelumnya tidak tersedia.");
  }
  return lines.length ? lines : [before ? "Perubahan role disimpan." : "Role dibuat."];
}
