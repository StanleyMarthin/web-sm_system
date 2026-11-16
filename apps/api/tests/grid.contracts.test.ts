import { describe, expect, test } from "bun:test";
import {
  parseGridQueryParams,
  validateBulkGridInput,
} from "@smsystem/contracts/grid";

describe("grid contracts", () => {
  test("parses default query params for server-side grid state", () => {
    const query = parseGridQueryParams(new URLSearchParams());

    expect(query).toEqual({
      page: 1,
      limit: 25,
      search: "",
      sortBy: "employeeId",
      sortDirection: "asc",
      view: null,
      filters: [],
    });
  });

  test("parses search, sort, filters, and saved view from query params", () => {
    const query = parseGridQueryParams(
      new URLSearchParams([
        ["page", "2"],
        ["limit", "50"],
        ["search", "yudha"],
        ["sortBy", "fullName"],
        ["sortDirection", "desc"],
        ["view", "active-only"],
        ["filter", "status:eq:active"],
        ["filter", "divisionId:eq:29"],
      ]),
    );

    expect(query.page).toBe(2);
    expect(query.limit).toBe(50);
    expect(query.search).toBe("yudha");
    expect(query.sortBy).toBe("fullName");
    expect(query.sortDirection).toBe("desc");
    expect(query.view).toBe("active-only");
    expect(query.filters).toEqual([
      { field: "status", operator: "eq", value: "active" },
      { field: "divisionId", operator: "eq", value: "29" },
    ]);
  });

  test("validates pasted bulk rows using required columns", () => {
    const validation = validateBulkGridInput(
      [
        "employeeId\tfullName\tdivisionId",
        "SM-08.050\tDemo User\t29",
        "SM-08.051\t\t29",
      ].join("\n"),
      {
        requiredColumns: ["employeeId", "fullName", "divisionId"],
      },
    );

    expect(validation.isValid).toBe(false);
    expect(validation.rowCount).toBe(2);
    expect(validation.issues).toEqual([
      {
        rowNumber: 3,
        field: "fullName",
        message: "Value is required.",
      },
    ]);
  });
});
