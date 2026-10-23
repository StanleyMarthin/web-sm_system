import { describe, expect, test } from "bun:test";
import { closestApprovalBlueprint, resolveApprovalBlueprintKey } from "./approval-mapping";

describe("approval mapping", () => {
  test("marks mismatched legacy values as unmapped and suggests the closest standard stage", () => {
    const legacy = { roleLevel: "300", approvalRank: "3" };
    expect(resolveApprovalBlueprintKey(legacy)).toBe("legacy");
    expect(closestApprovalBlueprint(legacy).key).toBe("project_head");
  });

  test("keeps a standard MIS profile mapped", () => {
    expect(resolveApprovalBlueprintKey({ roleLevel: "900", approvalRank: "9" })).toBe("global_management");
  });
});
