import * as bunTest from "bun:test";

const { beforeEach, describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;

const notifications: unknown[][] = [];
const notifyMobileEmployees = mock(async (...args: unknown[]) => { notifications.push(args); });

mock.module("@/services/mobile-notification.service", () => ({
  notifyMobileEmployees,
}));

const { DefaultMonitoringService } = await import("./monitoring.service");

describe("DefaultMonitoringService mobile notification", () => {
  beforeEach(() => {
    notifications.length = 0;
  });

  it("notifies the assigned employee after actual task submit", async () => {
    const repository = {
      createActual: mock(async () => ({ planId: "PLAN-1", actualId: "ACT-1" })),
    };
    const service = new DefaultMonitoringService(repository as never);

    await service.createActual({
      user: { employeeId: "LEAD-1", fullName: "Lead", scope: {} },
    } as never, {
      date: "2026-08-10",
      employeeId: "PIC-1",
      divisionId: 3,
      planId: "PLAN-1",
      carId: "CAR-1",
      jobDescription: "Wiring",
      resultNote: null,
      startTime: "08:00",
      finishTime: "10:00",
      breakMinutes: 0,
      progressPercent: 100,
      taskStatus: "DONE",
      location: null,
      isOvertime: false,
    });

    expect(notifications).toEqual([[
      ["PIC-1"],
      {
        title: "Update Task",
        body: "Lead memperbarui task Wiring menjadi DONE.",
        data: {
          module: "task",
          taskId: "PLAN-1",
          plandailyId: "PLAN-1",
          actualId: "ACT-1",
          status: "DONE",
        },
      },
      "sm_tasks",
    ]]);
  });

  it("submits one actual to the immutable ledger", async () => {
    const ledgerCalls: unknown[][] = [];
    const submitActualToLedger = mock(async (...args: unknown[]) => {
      ledgerCalls.push(args);
      return { ledgerId: "LEDGER-1", alreadySubmitted: false };
    });
    const service = new DefaultMonitoringService({ submitActualToLedger } as never);
    const result = await service.submitActualToLedger({
      user: { employeeId: "KD-1", fullName: "Kepala Divisi", scope: {} },
    } as never, "ACT-1");

    expect(result).toEqual({ ledgerId: "LEDGER-1", alreadySubmitted: false });
    expect(ledgerCalls.length).toBe(1);
  });
});
