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

mock.module("@/services/notifications/mobile-notification.service", () => ({
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
      findNotificationRecipients: async () => ({ kdIds: ["KD-1"], kpPmIds: ["KP-1", "PM-1"] }),
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
        roleName: "KETUA_DIVISI",
        permissions: [permissionCodes.qcSubmit, permissionCodes.qcValidate],
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
      ["KD-1", "ADV-1"],
      {
        title: "QC Lolos",
        body: "QC KD menyatakan Unit A - Panel A lolos dan menunggu QC QA.",
        data: {
          coreId: "CD-1",
          qcId: "QC-1",
          eventId: "QC-1:result",
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
      findNotificationRecipients: async () => ({ kdIds: ["KD-1"], kpPmIds: ["KP-1", "PM-1"] }),
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
      ["KD-1", "PIC-1", "PIC-2"],
      {
        title: "QC Lolos",
        body: "QC QA menyatakan Unit A - Panel A lolos. Pekerjaan selesai.",
        data: {
          coreId: "CD-1",
          qcId: "QC-2",
          eventId: "QC-2:result",
          resultStatus: "LOLOS",
          qcLevel: "QC_QA",
          module: "qc",
        },
      },
      "sm_job_qc",
    ]]);
  });

  for (const extensionHours of [0, 0.5, 1]) {
    it(`notifies KD of QA rejection and notifies KP/PM only for ${extensionHours} extra hours`, async () => {
      const repository = {
        findByCoreId: async () => ({ coreId: "CD-1", carId: "CAR-1", unitName: "Unit A",
          divisionId: 7, panelName: "Panel A", qcLastStatus: null }),
        rejectInspection: async () => ({ qcId: "QC-3", coreId: "CD-1", resultStatus: "TIDAK_LOLOS",
          reworkPlanId: null, draftItemId: "qc-rework:QC-3", extensionHours }),
        findNotificationRecipients: async () => ({ kdIds: ["KD-1"], kpPmIds: ["KP-1", "PM-1"] }),
      };
      const service = new DefaultQcService(repository as never,
        { upsertAutoIssue: async () => "ISSUE-1" } as never,
        { log: async () => undefined } as never);
      const result = await service.reject({ user: { employeeId: "QA-1", fullName: "QA",
        roleName: "QA", permissions: [permissionCodes.qcValidate], scope: { canViewAllUnits: true } } } as never,
        "CD-1", { notes: "ulang" } as never);
      expect(result.reworkPlanId).toBe(null);
      expect(notifications.length).toBe(extensionHours > 0 ? 2 : 1);
      expect(notifications[0]?.[0]).toEqual(["KD-1"]);
      expect(notifications[0]?.[1]).toMatchObject({ title: "QC Tidak Lolos",
        data: { eventId: "QC-3:result", coreId: "CD-1", qcId: "QC-3", resultStatus: "TIDAK_LOLOS", qcLevel: "QC_QA", module: "job_plan", draftItemId: "qc-rework:QC-3" } });
      if (extensionHours > 0) {
        expect(notifications[1]?.[0]).toEqual(["KP-1", "PM-1"]);
        expect(notifications[1]?.[1]).toMatchObject({ title: "Penambahan Waktu Rework QC",
          data: { eventId: "QC-3:extension", extensionHours: String(extensionHours),
            coreId: "CD-1", qcId: "QC-3", module: "job_plan", draftItemId: "qc-rework:QC-3" } });
      }
    });
  }

  it("does not repeat issue creation or notifications when a QA rejection is replayed", async () => {
    let issues = 0;
    const service = new DefaultQcService({
      findByCoreId: async () => ({ coreId: "CD-1", carId: "CAR-1" }),
      rejectInspection: async () => ({ qcId: "QC-3", coreId: "CD-1", resultStatus: "TIDAK_LOLOS",
        reworkPlanId: null, extensionHours: 1, reused: true }),
    } as never, { upsertAutoIssue: async () => { issues += 1; return "ISSUE-1"; } } as never,
    { log: async () => undefined } as never);
    await service.reject({ user: { employeeId: "QA-1", roleName: "QA", permissions: [], scope: {} } } as never,
      "CD-1", {} as never);
    expect(issues).toBe(0);
    expect(notifications.length).toBe(0);
  });
});
