import type { SpfClient } from "@/shared/api/spf-contracts";
import type { UnitBoardRow } from "@smsystem/contracts/unit";
import { describe, expect, it } from "bun:test";
import { buildClientWorkspaceRows, clientUnitsFromBoard, clientWorkspaceCapabilities, findClientProfile, unitClientsFromBoard } from "./client-workspace";

const profile: SpfClient = {
  id: "account-1",
  client_id: "account-1",
  display_name: "  mr.   adrian ",
  unit_count: 1,
  status: "ACTIVE",
  updated_at: "2026-08-05T10:00:00.000Z",
  vehicles: [],
  timeline: [],
  reports: [],
};

describe("SPF client workspace", () => {
  it("matches an exact normalized client profile", () => {
    expect(findClientProfile("Mr. ADRIAN", [profile])?.id).toBe("account-1");
    expect(buildClientWorkspaceRows([{ name: "Mr. ADRIAN", unitCount: 2 }], [profile])[0]).toMatchObject({
      id: "account-1",
      display_name: "Mr. ADRIAN",
      unit_count: 2,
      portalConfigured: true,
    });
  });

  it("does not attach portal credentials when a client name is ambiguous", () => {
    const duplicate = { ...profile, id: "account-2", client_id: "account-2" };

    expect(findClientProfile("Mr. ADRIAN", [profile, duplicate])).toBeUndefined();
    expect(buildClientWorkspaceRows([{ name: "Mr. ADRIAN", unitCount: 2 }], [profile, duplicate])[0]).toMatchObject({
      display_name: "Mr. ADRIAN",
      portalConfigured: false,
      status: "NOT_CONFIGURED",
    });
  });

  it("builds distinct clients from the complete Unit fallback and keeps human unit names", () => {
    const rows = [
      { unitId: "CAR-001", unitName: "Porsche 930 Turbo", customerName: "Mr. Adrian", status: "In_Progress" },
      { unitId: "CAR-002", unitName: "Mercedes 220S", customerName: "  MR. ADRIAN ", status: "Done" },
    ] as UnitBoardRow[];

    expect(unitClientsFromBoard(rows)).toEqual([{ name: "Mr. Adrian", unitCount: 2 }]);
    expect(clientUnitsFromBoard("mr. adrian", rows)).toEqual([
      { unitId: "CAR-001", unitName: "Porsche 930 Turbo", status: "In_Progress" },
      { unitId: "CAR-002", unitName: "Mercedes 220S", status: "Done" },
    ]);
  });

  it("separates client workspace access from admin-only editing", () => {
    expect(clientWorkspaceCapabilities({ canAdmin: false, canApprove: false, canPublish: true })).toEqual({
      canOpen: true,
      canEditClient: false,
      canManageAccess: true,
      canGenerateUrl: true,
      canPreview: false,
    });
    expect(clientWorkspaceCapabilities({ canAdmin: true, canApprove: false, canPublish: false })).toEqual({
      canOpen: true,
      canEditClient: true,
      canManageAccess: true,
      canGenerateUrl: false,
      canPreview: true,
    });
    expect(clientWorkspaceCapabilities({ canAdmin: false, canApprove: true, canPublish: false })).toEqual({
      canOpen: false,
      canEditClient: false,
      canManageAccess: false,
      canGenerateUrl: false,
      canPreview: false,
    });
  });
});
