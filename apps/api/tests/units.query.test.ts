import { describe, expect, test } from "bun:test";
import { sanitizeUnitGridQuery } from "@/services/units/query";

describe("sanitizeUnitGridQuery", () => {
  test("keeps only supported sort and filter fields", () => {
    const query = sanitizeUnitGridQuery({
      page: 2,
      limit: 250,
      search: "mb",
      sortBy: "unknown",
      sortDirection: "desc",
      view: "risk-only",
      filters: [
        { field: "riskLevel", operator: "eq", value: "RED" },
        { field: "status", operator: "eq", value: "In_Progress" },
        { field: "notAllowed", operator: "eq", value: "x" },
      ],
    });

    expect(query.page).toBe(2);
    expect(query.limit).toBe(100);
    expect(query.sortBy).toBe("targetDeliveryDate");
    expect(query.filters).toEqual([
      { field: "riskLevel", operator: "eq", value: "RED" },
      { field: "status", operator: "eq", value: "In_Progress" },
    ]);
  });
});
