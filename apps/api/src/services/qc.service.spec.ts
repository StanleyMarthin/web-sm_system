import * as bunTest from "bun:test";
import { permissionCodes } from "@smsystem/permissions";

const { beforeEach, describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;

const notifications: unknown[][] = [];
const notifyMobileEmployees = mock(async (...args: unknown[]) => {
  notifications.push(args);
});
const resolveEmployeeIdsByPermission = mock(async () => []);

mock.module("@/services/mobile-notification.service", () => ({
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
}));

const { DefaultQcService } = await import("./qc.service");

describe("DefaultQcService QC parity", () => {
  beforeEach(() => {
    notifications.length = 0;
  });

  it("sends KD pass to the assigned advisor and keeps the work waiting for QA", async () => {
    const repository = {
      findByCoreId: async () => ({
        coreId: "CD-1",
        carId: "CAR-1",
        unitName: "Unit A",
        customerName: null,
        divisionId: 7,
        divisionName: "Divisi A",
        panelId: 11,
        panelName: "Panel A",
        taskCategory: "BODY",
        jobName: "Las panel",
        countdownStatus: "READY_QC",
        qcLastStatus: null,
        qcLevel: null,
        latestQcId: null,
        refWoId: null,
        waitingHours: 1,
        remainingHours: 1,
        targetHours: 1,
        deadlineDate: "2026-09-03",
        latestInspectionDate: null,
        latestInspectionNotes: null,
        photoBeforeUrl: null,
        evidencePhotoUrl: null,
        reworkPlanId: null,
        reworkTaskDate: null,
        reworkAssignedUserId: null,
        reworkAssignedUserName: null,
        reworkPlanStatus: null,
        linkedIssueId: null,
        openIssueCount: 0,
      }),
      passInspection: async () => ({
        qcId: "QC-1",
        coreId: "CD-1",
        resultStatus: "LOLOS" as const,
        issueId: null,
        reworkPlanId: null,
      }),
      findAssignedEmployeeIds: async () => ["PIC-1"],
      findUnitApprovers: async () => ({
        advisorId: "ADV-1",
        kpId: "KP-1",
        kdId: "KD-1",
      }),
    };
    const service = new DefaultQcService(
      repository as never,
      { updateStatus: async () => undefined } as never,
      { log: async () => undefined } as never,
    );

    await service.pass({
      user: {
        employeeId: "KD-1",
        fullName: "KD",
        permissions: [permissionCodes.qcSubmit],
        scope: {
          canViewAllUnits: false,
          canViewAssignedUnits: false,
          divisionIds: [],
          managedDivisionIds: [],
          unitIds: [],
        },
      },
    } as never, "CD-1", {
      notes: null,
      inspectionDurationMinutes: null,
      photoBeforeUrl: null,
      evidencePhotoUrl: null,
    });

    expect(notifications).toEqual([[
      ["ADV-1"],
      {
        title: "QC Lolos",
        body: "QC KD menyatakan Unit A - Panel A lolos dan menunggu QC QA.",
        data: {
          coreId: "CD-1",
          qcId: "QC-1",
          resultStatus: "LOLOS",
          qcLevel: "QC_KD",
          module: "qc",
        },
      },
      "sm_job_qc",
    ]]);
  });

  it("sends QA pass to workers and marks the work as done", async () => {
    const repository = {
      findByCoreId: async () => ({
        coreId: "CD-1",
        carId: "CAR-1",
        unitName: "Unit A",
        customerName: null,
        divisionId: 7,
        divisionName: "Divisi A",
        panelId: 11,
        panelName: "Panel A",
        taskCategory: "BODY",
        jobName: "Las panel",
        countdownStatus: "READY_QC",
        qcLastStatus: "LOLOS" as const,
        qcLevel: "QC_KD" as const,
        latestQcId: null,
        refWoId: null,
        waitingHours: 1,
        remainingHours: 1,
        targetHours: 1,
        deadlineDate: "2026-09-03",
        latestInspectionDate: null,
        latestInspectionNotes: null,
        photoBeforeUrl: null,
        evidencePhotoUrl: null,
        reworkPlanId: null,
        reworkTaskDate: null,
        reworkAssignedUserId: "PIC-2",
        reworkAssignedUserName: "Teknisi 2",
        reworkPlanStatus: null,
        linkedIssueId: null,
        openIssueCount: 0,
      }),
      passInspection: async () => ({
        qcId: "QC-2",
        coreId: "CD-1",
        resultStatus: "LOLOS" as const,
        issueId: null,
        reworkPlanId: null,
      }),
      findAssignedEmployeeIds: async () => ["PIC-1"],
      findUnitApprovers: async () => ({
        advisorId: "ADV-1",
        kpId: "KP-1",
        kdId: "KD-1",
      }),
    };
    const service = new DefaultQcService(
      repository as never,
      { updateStatus: async () => undefined } as never,
      { log: async () => undefined } as never,
    );

    await service.pass({
      user: {
        employeeId: "ADV-1",
        fullName: "Advisor",
        permissions: [permissionCodes.qcValidate],
        scope: {
          canViewAllUnits: false,
          canViewAssignedUnits: true,
          divisionIds: [],
          managedDivisionIds: [7],
          unitIds: [],
        },
      },
    } as never, "CD-1", {
      notes: null,
      inspectionDurationMinutes: null,
      photoBeforeUrl: null,
      evidencePhotoUrl: null,
    });

    expect(notifications).toEqual([[
      ["PIC-1", "PIC-2"],
      {
        title: "QC Lolos",
        body: "QC ADVISOR menyatakan Unit A - Panel A lolos. Pekerjaan selesai.",
        data: {
          coreId: "CD-1",
          qcId: "QC-2",
          resultStatus: "LOLOS",
          qcLevel: "QC_ADVISOR",
          module: "qc",
        },
      },
      "sm_job_qc",
    ]]);
  });
});
