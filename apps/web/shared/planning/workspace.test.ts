import { describe, expect, it } from "bun:test";
import {
  buildPlanningWorkspaceHref,
  resolvePlanningWorkspaceState,
} from "@/shared/planning/workspace";

describe("planning workspace helpers", () => {
  it("resolves a single planning workspace state with sane defaults", () => {
    const state = resolvePlanningWorkspaceState({}, "2026-05-19");

    expect(state).toEqual({
      asOfDate: "2026-05-19",
      startDate: "2026-05-19",
      endDate: "2026-05-25",
      includeOvertime: false,
      weekStartDate: "2026-05-18",
    });
  });

  it("keeps explicit workspace query values", () => {
    const state = resolvePlanningWorkspaceState(
      {
        asOfDate: "2026-05-21",
        startDate: "2026-05-19",
        endDate: "2026-05-24",
        includeOvertime: "true",
        weekStart: "2026-05-19",
      },
      "2026-05-19",
    );

    expect(state.asOfDate).toBe("2026-05-21");
    expect(state.startDate).toBe("2026-05-19");
    expect(state.endDate).toBe("2026-05-24");
    expect(state.includeOvertime).toBe(true);
    expect(state.weekStartDate).toBe("2026-05-19");
  });

  it("builds a unified planning route while preserving search params", () => {
    const href = buildPlanningWorkspaceHref({
      asOfDate: "2026-05-19",
      includeOvertime: "true",
      weekStart: "2026-05-18",
    });

    expect(href).toBe(
      "/planning?asOfDate=2026-05-19&includeOvertime=true&weekStart=2026-05-18",
    );
  });
});
