import { describe, expect, it } from "bun:test";
import * as workflowModule from "./period-workflow-actions";

type PermissionSet = Readonly<{
  canAdmin: boolean;
  canApprove: boolean;
  canPublish: boolean;
}>;

type WorkflowAction = "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "UNPUBLISH";
type PeriodStatus = "DRAFT" | "WAITING_APPROVAL" | "APPROVED" | "PUBLISHED" | "REJECTED";

describe("SPF period workflow", () => {
  it("exposes each action granted to MIS at the matching status", () => {
    const getAllowedActions = (
      workflowModule as unknown as {
        getAllowedActions?: (permissions: PermissionSet, status: PeriodStatus) => WorkflowAction[];
      }
    ).getAllowedActions;
    const misPermissions = { canAdmin: true, canApprove: true, canPublish: true };

    expect(typeof getAllowedActions).toBe("function");
    expect(getAllowedActions?.(misPermissions, "DRAFT")).toEqual(["SUBMIT"]);
    expect(getAllowedActions?.(misPermissions, "REJECTED")).toEqual(["SUBMIT"]);
    expect(getAllowedActions?.(misPermissions, "WAITING_APPROVAL")).toEqual(["APPROVE", "REJECT"]);
    expect(getAllowedActions?.(misPermissions, "APPROVED")).toEqual(["PUBLISH"]);
    expect(getAllowedActions?.(misPermissions, "PUBLISHED")).toEqual(["UNPUBLISH"]);
  });
});
