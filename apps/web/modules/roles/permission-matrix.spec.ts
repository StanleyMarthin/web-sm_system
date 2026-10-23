import { describe, expect, test } from "bun:test";
import { describeHistoryChange, permissionAction, permissionChanges, permissionLabel } from "./permission-matrix";
import { permissionCatalog } from "@smsystem/permissions";
import { permissionPresentation } from "./permission-registry";

describe("permission matrix presentation", () => {
  test("groups action names with different separators", () => {
    expect(permissionAction("PR_VIEW")).toBe("View");
    expect(permissionAction("bubut_invoice.cancel")).toBe("Other");
    expect(permissionAction("APPROVE_WO_ADVISOR")).toBe("Approve");
    expect(permissionAction("warehouse.stock.create")).toBe("Create");
  });

  test("labels the QA approval correctly", () => {
    expect(permissionLabel({ id: 1, permissionCode: "APPROVE_WO_ADVISOR", description: "Advisor", moduleName: "WO" })).toBe("Approve WO - tahap QA");
  });

  test("reports additions and removals independently of order", () => {
    expect(permissionChanges([1, 2], [2, 3])).toEqual({ added: [3], removed: [1] });
    expect(permissionChanges([1, 2], [2, 1])).toEqual({ added: [], removed: [] });
  });

  test("all known permissions have presentation metadata", () => {
    expect(permissionCatalog.filter((code) => !permissionPresentation(code))).toEqual([]);
  });

  test("history distinguishes missing old data from a real permission diff", () => {
    const permissions = [{ id: 1, permissionCode: "PR_VIEW", description: null, moduleName: "PR" }];
    expect(describeHistoryChange(null, { permissionIds: [1] }, permissions)).toContain("Daftar izin disimpan; data sebelumnya tidak tersedia.");
    expect(describeHistoryChange(JSON.stringify({ permissionIds: [] }), JSON.stringify({ permissionIds: [1] }), permissions)).toContain("+ PR_VIEW");
  });
});
