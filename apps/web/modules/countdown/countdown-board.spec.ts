import { describe, expect, it } from "bun:test";
import type { AuthUser } from "@smsystem/contracts/auth";
import {
  buildCountdownScopeRedirect,
  buildCountdownDeadlineFilters,
  buildCountdownProgressFilters,
  countdownPriorityRank,
  countdownScopeFilters,
  readCountdownDeadlineRange,
  readCountdownProgressSelection,
  resolveCountdownDefaultSmartView,
  resolveCountdownPriority,
  resolveCountdownSmartView,
  shouldHideUnitColumn,
} from "./countdown-board";

function createUser(overrides: Partial<AuthUser> & { scope?: Partial<AuthUser["scope"]> }): AuthUser {
  const base: AuthUser = {
    employeeId: "SM-01.001",
    fullName: "Tester",
    email: null,
    roleId: 1,
    roleName: "MIS",
    divisionId: 10,
    divisionName: "BODY WORK",
    grade: null,
    permissions: [],
    scope: {
      canViewAllUnits: false,
      canViewAssignedUnits: false,
      divisionIds: [10],
      managedDivisionIds: [10],
      unitIds: ["UNIT-1", "UNIT-2"],
    },
  };

  return { ...base, ...overrides, scope: { ...base.scope, ...(overrides.scope ?? {}) } };
}

describe("countdown smart view", () => {
  it("defaults to scope and only accepts known views", () => {
    expect(resolveCountdownSmartView(null)).toBe("scope");
    expect(resolveCountdownSmartView("")).toBe("scope");
    expect(resolveCountdownSmartView("something")).toBe("scope");
    expect(resolveCountdownSmartView("all")).toBe("all");
    expect(resolveCountdownSmartView("custom")).toBe("custom");
  });

  it("gives KP every managed unit as scope filters", () => {
    expect(countdownScopeFilters(createUser({ roleName: "KP PRODUKSI" }))).toEqual([
      { field: "unitId", operator: "eq", value: "UNIT-1" },
      { field: "unitId", operator: "eq", value: "UNIT-2" },
    ]);
  });

  it("gives KD and QA their division scope", () => {
    const expected = [{ field: "divisionId", operator: "eq", value: "10" }];
    expect(countdownScopeFilters(createUser({ roleName: "KD BODY WORK" }))).toEqual(expected);
    expect(countdownScopeFilters(createUser({ roleName: "QA" }))).toEqual(expected);
  });

  it("keeps admin and unknown roles unscoped", () => {
    expect(countdownScopeFilters(createUser({
      roleName: "SUPER ADMIN",
      scope: { canViewAllUnits: true },
    }))).toEqual([]);
    expect(countdownScopeFilters(createUser({ roleName: "MEKANIK" }))).toEqual([]);
    expect(countdownScopeFilters(null)).toEqual([]);
  });

  it("redirects to the role scope only when the URL has no explicit view", () => {
    const scope = countdownScopeFilters(createUser({ roleName: "KD BODY WORK" }));

    expect(buildCountdownScopeRedirect({}, scope)).toBe("smartView=scope&filter=divisionId%3Aeq%3A10");
    expect(buildCountdownScopeRedirect({ page: "2" }, scope)).toBe("page=2&smartView=scope&filter=divisionId%3Aeq%3A10");
    expect(buildCountdownScopeRedirect({ smartView: "all" }, scope)).toBeNull();
    expect(buildCountdownScopeRedirect({ filter: "status:eq:PLAN" }, scope)).toBeNull();
    expect(buildCountdownScopeRedirect({}, [])).toBeNull();
  });

  it("defaults Admin without scope to All instead of My Scope", () => {
    const admin = countdownScopeFilters(createUser({
      roleName: "SUPER ADMIN",
      scope: { canViewAllUnits: true },
    }));

    expect(resolveCountdownDefaultSmartView(admin)).toBe("all");
    expect(resolveCountdownDefaultSmartView(countdownScopeFilters(createUser({ roleName: "KD BODY WORK" })))).toBe("scope");
    expect(resolveCountdownSmartView(null ?? resolveCountdownDefaultSmartView(admin))).toBe("all");
  });
});

describe("countdown board unit column", () => {
  const multiUnitScope = countdownScopeFilters(createUser({ roleName: "KP PRODUKSI" }));
  const singleUnitScope = countdownScopeFilters(createUser({
    roleName: "KP PRODUKSI",
    scope: { unitIds: ["UNIT-1"] },
  }));
  const divisionScope = countdownScopeFilters(createUser({ roleName: "KD BODY WORK" }));
  const adminScope = countdownScopeFilters(createUser({
    roleName: "SUPER ADMIN",
    scope: { canViewAllUnits: true },
  }));

  it("always shows Unit for multi unit KP, Admin, and All view", () => {
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "scope", scopeFilters: multiUnitScope })).toBe(false);
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "scope", scopeFilters: adminScope })).toBe(false);
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "all", scopeFilters: singleUnitScope })).toBe(false);
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "custom", scopeFilters: singleUnitScope })).toBe(false);
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "scope", scopeFilters: divisionScope })).toBe(false);
  });

  it("hides Unit only inside a single unit context", () => {
    expect(shouldHideUnitColumn({ singleUnitContext: true, smartView: "all", scopeFilters: adminScope })).toBe(true);
    expect(shouldHideUnitColumn({ singleUnitContext: false, smartView: "scope", scopeFilters: singleUnitScope })).toBe(true);
  });
});

describe("countdown filter mapping", () => {
  it("maps progress selections to server filters and back", () => {
    for (const selection of ["belum-mulai", "berjalan", "selesai"]) {
      expect(readCountdownProgressSelection(buildCountdownProgressFilters(selection))).toBe(selection);
    }
    expect(buildCountdownProgressFilters("")).toEqual([]);
    expect(readCountdownProgressSelection([])).toBe("");
  });

  it("maps deadline range to gte and lte filters and back", () => {
    const filters = buildCountdownDeadlineFilters("2026-09-01", "2026-09-30");
    expect(filters).toEqual([
      { field: "deadlineDate", operator: "gte", value: "2026-09-01" },
      { field: "deadlineDate", operator: "lte", value: "2026-09-30" },
    ]);
    expect(readCountdownDeadlineRange(filters)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(readCountdownDeadlineRange([])).toEqual({ from: "", to: "" });
  });
});

describe("countdown priority", () => {
  const today = "2026-09-18";

  it("flags late work when the deadline passed and progress is under 100", () => {
    expect(resolveCountdownPriority({
      deadlineDate: "2026-09-17",
      actualProgressPercent: 40,
      remainingHours: 12,
    }, today)).toBe("LATE");
  });

  it("flags attention when remaining hours are low", () => {
    expect(resolveCountdownPriority({
      deadlineDate: "2026-09-30",
      actualProgressPercent: 60,
      remainingHours: 6,
    }, today)).toBe("ATTENTION");
  });

  it("keeps finished or comfortable work normal", () => {
    expect(resolveCountdownPriority({
      deadlineDate: "2026-09-10",
      actualProgressPercent: 100,
      remainingHours: 0,
    }, today)).toBe("NORMAL");
    expect(resolveCountdownPriority({
      deadlineDate: "2026-09-30",
      actualProgressPercent: 20,
      remainingHours: 40,
    }, today)).toBe("NORMAL");
  });

  it("sorts late work first", () => {
    expect(countdownPriorityRank("LATE")).toBeLessThan(countdownPriorityRank("ATTENTION"));
    expect(countdownPriorityRank("ATTENTION")).toBeLessThan(countdownPriorityRank("NORMAL"));
  });
});
