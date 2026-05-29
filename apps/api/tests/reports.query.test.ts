import { describe, expect, test } from "bun:test";
import { sanitizeReportQuery } from "@/services/reports/query";

describe("sanitizeReportQuery", () => {
  test("keeps only allowed sort and filter fields per report", () => {
    const query = sanitizeReportQuery(
      "delivery-accuracy",
      new URLSearchParams([
        ["page", "2"],
        ["limit", "50"],
        ["sortBy", "delayDays"],
        ["sortDirection", "desc"],
        ["dateFrom", "2026-05-01"],
        ["dateTo", "2026-05-15"],
        ["filter", "deliveryStatus:eq:DELAYED"],
        ["filter", "badField:eq:ignored"],
      ]),
    );

    expect(query.page).toBe(2);
    expect(query.limit).toBe(50);
    expect(query.sortBy).toBe("delayDays");
    expect(query.filters.length).toBe(1);
    expect(query.filters[0]?.field).toBe("deliveryStatus");
    expect(query.dateFrom).toBe("2026-05-01");
    expect(query.dateTo).toBe("2026-05-15");
  });

  test("falls back to report default sort for unknown field", () => {
    const query = sanitizeReportQuery(
      "wo-aging",
      new URLSearchParams([
        ["sortBy", "unknown"],
        ["sortDirection", "asc"],
      ]),
    );

    expect(query.sortBy).toBe("ageDays");
  });
});
