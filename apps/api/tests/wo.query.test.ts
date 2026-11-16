import { describe, expect, test } from "bun:test";
import { sanitizeWoGridQuery } from "@/services/wo/query";

describe("sanitizeWoGridQuery", () => {
  test("defaults to requestDate descending with active view", () => {
    const query = sanitizeWoGridQuery(
      new URLSearchParams("page=2&limit=10"),
    );

    expect(query.page).toBe(2);
    expect(query.limit).toBe(10);
    expect(query.sortBy).toBe("requestDate");
    expect(query.sortDirection).toBe("desc");
    expect(query.viewMode).toBe("active");
  });

  test("keeps only supported filters and sorts", () => {
    const query = sanitizeWoGridQuery(
      new URLSearchParams(
        "sortBy=hack&sortDirection=asc&viewMode=done&filter=status:eq:APPROVED&filter=abc:eq:1",
      ),
    );

    expect(query.sortBy).toBe("requestDate");
    expect(query.viewMode).toBe("done");
    expect(query.filters).toEqual([
      {
        field: "status",
        operator: "eq",
        value: "APPROVED",
      },
    ]);
  });
});
