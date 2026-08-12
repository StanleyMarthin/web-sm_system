import * as bunTest from "bun:test";

const { beforeEach, describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;

const notifications: unknown[][] = [];
const permissionLookups: unknown[][] = [];
let throwOnPermissionLookup = false;
const notifyMobileEmployees = mock(async (...args: unknown[]) => { notifications.push(args); });
const resolveEmployeeIdsByPermission = mock(async (...args: unknown[]) => {
  if (throwOnPermissionLookup) {
    throw new Error("notification unavailable");
  }
  permissionLookups.push(args);
  return ["PLANNER-1"];
});

mock.module("@/services/mobile-notification.service", () => ({
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
}));

const { DefaultCountdownService } = await import("./countdown.service");
const { loadWorkbookFromBuffer } = await import("./excel");

const detail = {
  countdownId: "CD-1",
  carId: "CAR-1",
  unitName: "Unit A",
  divisionId: 7,
  panelName: "Panel A",
  sectionName: null,
  status: "PLAN",
};

describe("DefaultCountdownService mobile notification", () => {
  beforeEach(() => {
    notifications.length = 0;
    permissionLookups.length = 0;
    throwOnPermissionLookup = false;
  });

  it("notifies division planners after countdown create", async () => {
    const repository = {
      createCountdown: mock(async () => detail),
    };
    const service = new DefaultCountdownService(repository as never);

    await service.create({ user: { employeeId: "ACTOR-1", fullName: "Planner", scope: {} } } as never, {} as never);

    expect(permissionLookups).toEqual([["UPDATE_PLAN", 7]]);
    expect(notifications).toEqual([[
      ["PLANNER-1"],
      {
        title: "Countdown Baru",
        body: "Unit A - Panel A dibuat oleh Planner.",
        data: { module: "countdown", countdownId: "CD-1", carId: "CAR-1", status: "PLAN" },
      },
      "sm_countdown",
    ]]);
  });

  it("keeps a committed create successful when notification delivery fails", async () => {
    throwOnPermissionLookup = true;
    const repository = { createCountdown: mock(async () => detail) };
    const service = new DefaultCountdownService(repository as never);
    const originalError = console.error;
    console.error = mock(() => undefined) as never;

    try {
      expect(await service.create(
        { user: { employeeId: "ACTOR-1", fullName: "Planner", scope: {} } } as never,
        {} as never,
      )).toBe(detail);
    } finally {
      console.error = originalError;
    }
  });

  it("notifies division planners after countdown delete succeeds", async () => {
    const repository = {
      findCountdownDetail: mock(async () => detail),
      deleteCountdown: mock(async () => true),
    };
    const service = new DefaultCountdownService(repository as never);

    await service.remove({ user: { employeeId: "ACTOR-1", fullName: "Planner", scope: {} } } as never, "CD-1");

    expect(notifications[0]).toEqual([
      ["PLANNER-1"],
      {
        title: "Countdown Dihapus",
        body: "Unit A - Panel A dihapus oleh Planner.",
        data: { module: "countdown", countdownId: "CD-1", carId: "CAR-1", status: "DELETED" },
      },
      "sm_countdown",
    ]);
  });
});

describe("DefaultCountdownService download", () => {
  it("exports every scoped row with human-readable headers", async () => {
    let repositoryParams: unknown;
    const repository = {
      findCountdownDownload: mock(async (params: unknown) => {
        repositoryParams = params;
        return [{
          unitName: "Unit A",
          customerName: "Customer A",
          divisionName: "Interior",
          panelName: "Dashboard",
          sectionName: "Panel",
          taskCategory: "MAIN",
          jobTypeName: "Pasang",
          targetHoursInitial: 8,
          targetHoursRevised: 10,
          totalActualHours: 4,
          remainingHours: 6,
          actualProgressPercent: 40,
          status: "PROSES",
          startDate: "2026-08-01",
          deadlineDate: "2026-08-12",
          temuanAwal: "Retak",
          keterangan: "Perbaiki",
        }];
      }),
    };
    const service = new DefaultCountdownService(repository as never);
    const scope = { canViewAllUnits: false, unitIds: ["UNIT-1"] };

    const buffer = await service.download(
      { user: { employeeId: "EMP-1", scope } } as never,
      { unitId: "UNIT-1", status: "PROSES" },
    );
    const workbook = await loadWorkbookFromBuffer(buffer);
    const sheet = workbook.worksheets[0]!;

    expect(repositoryParams).toEqual({
      employeeId: "EMP-1",
      scope,
      query: { unitId: "UNIT-1", status: "PROSES" },
    });
    expect(sheet.getRow(1).values).toContain("Nama Unit");
    expect(sheet.getRow(2).getCell(1).value).toBe("Unit A");
  });
});

describe("DefaultCountdownService import unit guard", () => {
  it("rejects rows for another unit without writing", async () => {
    const { default: ExcelJS } = await import("exceljs");
    const { addRowsWorksheet, writeWorkbookBuffer } = await import("./excel");
    const workbook = new ExcelJS.Workbook();
    addRowsWorksheet(workbook, "Countdown", [
      ["Kode Unit/Mobil", "Kode Divisi", "Nama Section", "Target Jam Awal"],
      ["UNIT-OTHER", "7", "Panel", 8],
      ["UNIT-1", "7", "Panel 2", 4],
    ]);
    let called = false;
    const service = new DefaultCountdownService({
      createCountdownImports: async () => { called = true; return { inserted: 1, updated: 0, rejected: 0, issues: [] }; },
    } as never);

    const result = await service.importWorkbook(
      { user: { employeeId: "EMP-1", scope: {}, fullName: "Planner" } } as never,
      "countdown.xlsx",
      await writeWorkbookBuffer(workbook),
      "UNIT-1",
    );

    expect(called).toBe(false);
    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      rejected: 2,
      issues: [{ rowNumber: 2, field: "carId", message: "Unit pada file tidak sesuai; seluruh import dibatalkan.", value: "UNIT-OTHER" }],
    });
  });
});

describe("DefaultCountdownService revision authority", () => {
  const decision = { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" };
  const baseSession = {
    user: {
      employeeId: "EMP-1",
      permissions: ["COUNTDOWN_SUBMIT_APPROVAL"],
      scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [7], managedDivisionIds: [7], unitIds: [] },
    },
  } as never;

  it("routes REQUESTED decisions through KP authority", async () => {
    let params: unknown;
    const service = new DefaultCountdownService({
      findCountdownDetail: async () => ({ extensionRequestStatus: "REQUESTED" }),
      isCountdownKp: async () => true,
      decideCountdownRevision: async (value: unknown) => {
        params = value;
        return { countdownId: "CD-1", status: "APPROVED", carId: "UNIT-1", divisionId: 7 };
      },
    } as never);

    await service.decideRevision(baseSession, "CD-1", decision);
    expect((params as { isMo: boolean }).isMo).toBe(false);
  });

  it("requires global MO authority for MO_REVIEW", async () => {
    const repository = {
      findCountdownDetail: async () => ({ extensionRequestStatus: "MO_REVIEW" }),
      isCountdownKp: async () => false,
      decideCountdownRevision: async () => ({ countdownId: "CD-1", status: "APPROVED", carId: "UNIT-1", divisionId: 7 }),
    };
    const service = new DefaultCountdownService(repository as never);

    let forbidden = "";
    try {
      await service.decideRevision(baseSession, "CD-1", decision);
    } catch (error) {
      forbidden = (error as Error).message;
    }
    expect(forbidden).toBe("COUNTDOWN_REVISION_FORBIDDEN");
    expect(await service.decideRevision({
      user: { ...(baseSession as never as { user: object }).user, scope: { canViewAllUnits: true } },
    } as never, "CD-1", decision)).toMatchObject({ status: "APPROVED" });
  });

  it("notifies global approvers when KP forwards to MO_REVIEW", async () => {
    const service = new DefaultCountdownService({
      findCountdownDetail: async () => ({ extensionRequestStatus: "REQUESTED" }),
      isCountdownKp: async () => true,
      decideCountdownRevision: async () => ({ countdownId: "CD-1", status: "MO_REVIEW", carId: "UNIT-1", divisionId: 7 }),
    } as never);

    await service.decideRevision(baseSession, "CD-1", decision);
    expect(permissionLookups.at(-1)).toEqual(["COUNTDOWN_SUBMIT_APPROVAL", undefined]);
  });
});
