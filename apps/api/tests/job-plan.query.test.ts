import { describe, expect, test } from "bun:test";
import { sanitizeJobPlanGridQuery } from "@/services/job-plan/query";

describe("sanitizeJobPlanGridQuery", () => {
  test("keeps editable weekly range within 2-7 days", () => {
    const query = sanitizeJobPlanGridQuery(
      new URLSearchParams(
        "date=2026-05-14&window=weekly&dateStart=2026-05-19&dateEnd=2026-05-23&page=2&limit=10",
      ),
      "normal",
    );

    expect(query.date).toBe("2026-05-14");
    expect(query.window).toBe("weekly");
    expect(query.mode).toBe("normal");
    expect(query.dateStart).toBe("2026-05-19");
    expect(query.dateEnd).toBe("2026-05-23");
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
  });

  test("defaults daily mode to the requested date only", () => {
    const query = sanitizeJobPlanGridQuery(
      new URLSearchParams("date=2026-05-14"),
      "overtime",
    );

    expect(query.window).toBe("daily");
    expect(query.mode).toBe("overtime");
    expect(query.dateStart).toBe("2026-05-14");
    expect(query.dateEnd).toBe("2026-05-14");
  });

  test("accepts all mode for one-page normal and overtime view", () => {
    const query = sanitizeJobPlanGridQuery(
      new URLSearchParams("date=2026-05-14&mode=all"),
      "all",
    );

    expect(query.mode).toBe("all");
    expect(query.window).toBe("daily");
    expect(query.dateStart).toBe("2026-05-14");
    expect(query.dateEnd).toBe("2026-05-14");
  });
});
