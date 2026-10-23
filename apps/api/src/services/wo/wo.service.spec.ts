import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import type { WoRecord } from "@smsystem/contracts/wo";
import type { WebSession } from "@/services/auth/session.service";
import { DefaultWoService } from "./wo.service";

function wo(overrides: Partial<WoRecord>): WoRecord {
  return {
    woId: "WO-1",
    woNumber: "WO-1",
    carId: "UNIT-1",
    unitName: "UNIT-1",
    customerName: "-",
    fromDivisionId: 1,
    fromDivisionName: "INTERIOR",
    toDivisionId: 2,
    toDivisionName: "BODY PAINT",
    masterPanelId: null,
    panelName: "PANEL",
    jobDetail: "REPAIR",
    estimatedHours: null,
    isPriority: false,
    status: "PENDING_TARGET_KD_APPROVAL",
    requestDate: "2026-10-06",
    approvalDate: null,
    createdAt: "2026-10-06 08:00:00",
    notes: null,
    issueNote: null,
    mediaUrl: null,
    mediaType: null,
    picId: null,
    picName: null,
    approverId: null,
    linkedCountdownId: null,
    linkedCountdownStatus: null,
    agingHours: 0,
    agingScore: 0,
    isUrgent: false,
    ...overrides,
  };
}

function session(divisionId: number): WebSession {
  return {
    sessionId: "S-1",
    sessionKey: "S-1",
    employeeId: "KD-1",
    refreshToken: "R-1",
    mobileSessionKey: "M-1",
    deviceId: "D-1",
    user: {
      employeeId: "KD-1",
      fullName: "KD",
      email: null,
      roleId: null,
      roleName: "KD",
      divisionId,
      divisionName: "DIV",
      grade: null,
      permissions: [permissionCodes.woApprove],
      roleProfile: null,
      scope: {
        canViewAllUnits: false,
        canViewAssignedUnits: false,
        divisionIds: [divisionId],
        managedDivisionIds: [],
        unitIds: [],
      },
    },
    createdAt: "2026-10-06T00:00:00.000Z",
  };
}

describe("DefaultWoService target KD queue", () => {
  it("hides target-KD approval rows from the source division KD", async () => {
    const repository = {
      list: async () => ({
        rows: [
          wo({ woId: "SOURCE", fromDivisionId: 1, toDivisionId: 2 }),
          wo({ woId: "TARGET", fromDivisionId: 2, toDivisionId: 1 }),
          wo({
            woId: "LATER",
            fromDivisionId: 1,
            toDivisionId: 2,
            status: "PENDING_ADVISOR_APPROVAL",
          }),
        ],
        total: 3,
        summary: { pendingApproval: 3, approvedOpen: 0, urgentCount: 0 },
      }),
      listReferences: async () => ({ units: [], divisions: [], statuses: [] }),
    };
    const service = new DefaultWoService(repository as never, {
      log: async () => undefined,
    });

    const result = await service.list(session(1), {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "requestDate",
      sortDirection: "desc",
      view: null,
      filters: [],
      viewMode: "active",
    });

    expect(result.data.map((row) => row.woId)).toEqual(["TARGET", "LATER"]);
  });
});
