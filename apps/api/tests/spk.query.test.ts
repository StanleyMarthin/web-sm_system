import { describe, expect, test } from "bun:test";
import { sanitizeSpkGridQuery } from "@/services/spk/query";

describe("sanitizeSpkGridQuery", () => {
  test("defaults to spkDate descending and preserves requested date", () => {
    const query = sanitizeSpkGridQuery(
      new URLSearchParams("date=2026-05-15&page=2&limit=10"),
    );

    expect(query.date).toBe("2026-05-15");
    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.sortBy).toBe("spkDate");
    expect(query.sortDirection).toBe("desc");
  });

  test("keeps supported sort and filter fields only", () => {
    const query = sanitizeSpkGridQuery(
      new URLSearchParams(
        "sortBy=unknown&sortDirection=asc&filter=status:eq:SUBMITTED&filter=hack:eq:1",
      ),
    );

    expect(query.sortBy).toBe("spkDate");
    expect(query.filters).toEqual([
      {
        field: "status",
        operator: "eq",
        value: "SUBMITTED",
      },
    ]);
  });
});
