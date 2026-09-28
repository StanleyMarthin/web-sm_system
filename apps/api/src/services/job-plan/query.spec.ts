import { describe, expect, it } from "bun:test";
import { sanitizeJobPlanGridQuery } from "./query";

describe("sanitizeJobPlanGridQuery", () => {
  it("uses workMode as the job plan mode filter", () => {
    const query = sanitizeJobPlanGridQuery(new URLSearchParams({
      date: "2026-09-25",
      workMode: "OVERTIME",
    }));

    expect(query.mode).toBe("overtime");
  });

  it("defaults to all when workMode is not selected", () => {
    const query = sanitizeJobPlanGridQuery(new URLSearchParams({
      date: "2026-09-25",
    }));

    expect(query.mode).toBe("all");
  });
});
