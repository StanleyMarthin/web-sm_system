import type { AuthUser } from "@smsystem/contracts/auth";
import type { CountdownBoardRow } from "@smsystem/contracts/countdown";
import { encodeGridFilterToken, type GridFilter } from "@smsystem/contracts/grid";

export type CountdownSmartView = "scope" | "all" | "custom";
export type CountdownPriority = "LATE" | "ATTENTION" | "NORMAL";

export const countdownStatusOptions = [
  { value: "PLAN", label: "Rencana" },
  { value: "PROSES", label: "Proses" },
  { value: "QC_READY", label: "Siap QC" },
  { value: "DONE", label: "Selesai" },
];

export const countdownProgressOptions = [
  { value: "", label: "Semua progress" },
  { value: "belum-mulai", label: "Belum mulai" },
  { value: "berjalan", label: "Sedang berjalan" },
  { value: "selesai", label: "Selesai" },
];

export const countdownSmartViewOptions: Array<{ value: CountdownSmartView; label: string }> = [
  { value: "scope", label: "My Scope" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom Filter" },
];

export const countdownPriorityLabels: Record<CountdownPriority, string> = {
  LATE: "Terlambat",
  ATTENTION: "Perhatian",
  NORMAL: "Normal",
};

// 8 jam = 1 hari kerja, mengikuti konvensi workday alias pada data countdown.
export const COUNTDOWN_ATTENTION_REMAINING_HOURS = 8;

export function resolveCountdownSmartView(value: string | null | undefined): CountdownSmartView {
  if (value === "all" || value === "custom") return value;
  return "scope";
}

/** Tanpa scope peran (Admin/Super Admin) Default Smart View adalah All, bukan My Scope. */
export function resolveCountdownDefaultSmartView(scopeFilters: GridFilter[]): CountdownSmartView {
  return scopeFilters.length > 0 ? "scope" : "all";
}

/**
 * Default scope per peran (UX saja). Backend tetap otoritas: user di luar scope
 * tidak pernah menerima barisnya walau smart view diset "All".
 */
export function countdownScopeFilters(user: AuthUser | null | undefined): GridFilter[] {
  if (!user || user.scope.canViewAllUnits) return [];

  const role = (user.roleName ?? "").toUpperCase();
  if (role.includes("KP") && user.scope.unitIds.length > 0) {
    return user.scope.unitIds.map((unitId) => ({ field: "unitId", operator: "eq" as const, value: unitId }));
  }

  if (role.includes("KD") || role.includes("QA")) {
    const divisionIds = user.scope.divisionIds.length > 0
      ? user.scope.divisionIds
      : user.divisionId === null || user.divisionId === undefined
        ? []
        : [user.divisionId];
    return divisionIds.map((divisionId) => ({
      field: "divisionId",
      operator: "eq" as const,
      value: String(divisionId),
    }));
  }

  return [];
}

/**
 * Board dibuka pada scope bawaan peran saat URL belum punya pilihan smart view.
 * Mengembalikan query string baru, atau null kalau tidak perlu diarahkan.
 */
export function buildCountdownScopeRedirect(
  searchParams: Record<string, string | string[] | undefined>,
  scopeFilters: GridFilter[],
): string | null {
  if (scopeFilters.length === 0) return null;
  if (searchParams.smartView || searchParams.filter) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else for (const item of value ?? []) params.append(key, item);
  }
  params.set("smartView", "scope");
  params.delete("filter");
  for (const filter of scopeFilters) params.append("filter", encodeGridFilterToken(filter));
  return params.toString();
}

export function buildCountdownProgressFilters(selection: string): GridFilter[] {
  if (selection === "belum-mulai") {
    return [{ field: "actualProgressPercent", operator: "eq", value: "0" }];
  }
  if (selection === "berjalan") {
    return [
      { field: "actualProgressPercent", operator: "gt", value: "0" },
      { field: "actualProgressPercent", operator: "lt", value: "100" },
    ];
  }
  if (selection === "selesai") {
    return [{ field: "actualProgressPercent", operator: "eq", value: "100" }];
  }
  return [];
}

export function readCountdownProgressSelection(filters: GridFilter[]): string {
  const progress = filters.filter((filter) => filter.field === "actualProgressPercent");
  if (progress.length === 1 && progress[0]?.operator === "eq") {
    if (progress[0].value === "0") return "belum-mulai";
    if (progress[0].value === "100") return "selesai";
  }
  if (
    progress.some((filter) => filter.operator === "gt" && filter.value === "0")
    && progress.some((filter) => filter.operator === "lt" && filter.value === "100")
  ) {
    return "berjalan";
  }
  return "";
}

export function buildCountdownDeadlineFilters(from: string, to: string): GridFilter[] {
  const filters: GridFilter[] = [];
  if (from) filters.push({ field: "deadlineDate", operator: "gte", value: from });
  if (to) filters.push({ field: "deadlineDate", operator: "lte", value: to });
  return filters;
}

export function readCountdownDeadlineRange(filters: GridFilter[]): { from: string; to: string } {
  const deadline = filters.filter((filter) => filter.field === "deadlineDate");
  return {
    from: deadline.find((filter) => filter.operator === "gte")?.value ?? "",
    to: deadline.find((filter) => filter.operator === "lte")?.value ?? "",
  };
}

export function resolveCountdownFilterValue(filters: GridFilter[], field: string): string {
  return filters.find((filter) => filter.field === field)?.value ?? "";
}

/**
 * Kolom Unit hanya disembunyikan bila konteksnya memang satu unit: tab Countdown
 * di Unit Workspace, atau scope peran yang berisi tepat satu unit.
 * Multi-unit (KP), Smart View All, dan Admin selalu menampilkan kolom Unit.
 */
export function shouldHideUnitColumn(input: {
  singleUnitContext: boolean;
  smartView: CountdownSmartView;
  scopeFilters: GridFilter[];
}): boolean {
  if (input.singleUnitContext) return true;
  if (input.smartView !== "scope") return false;
  return input.scopeFilters.filter((filter) => filter.field === "unitId").length === 1;
}

export function todayIso(value = new Date()): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export function resolveCountdownPriority(
  row: Pick<CountdownBoardRow, "deadlineDate" | "actualProgressPercent" | "remainingHours">,
  today = todayIso(),
): CountdownPriority {
  const progress = Number(row.actualProgressPercent ?? 0);
  const remainingHours = Number(row.remainingHours ?? 0);
  const deadline = row.deadlineDate ?? null;

  if (progress < 100 && deadline !== null && deadline < today) return "LATE";
  if (progress < 100 && remainingHours <= COUNTDOWN_ATTENTION_REMAINING_HOURS) return "ATTENTION";
  return "NORMAL";
}

export function countdownPriorityRank(priority: CountdownPriority): number {
  if (priority === "LATE") return 0;
  if (priority === "ATTENTION") return 1;
  return 2;
}
