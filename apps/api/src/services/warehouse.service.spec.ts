import * as bunTest from "bun:test";

const { describe, expect, it } = bunTest;
const mock = (bunTest as unknown as {
  mock: ((implementation: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown) & {
    module: (name: string, factory: () => unknown) => void;
  };
}).mock;
const notifications: unknown[][] = [];
const notifyMobileEmployees = mock(async (...args: unknown[]) => { notifications.push(args); });
mock.module("@/services/mobile-notification.service", () => ({
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission: mock(async () => []),
}));

const { DefaultWarehouseService } = await import("./warehouse.service");

describe("DefaultWarehouseService mobile notification", () => {
  it("notifies the requester only after an item is marked ready", async () => {
    const repository = {
      findTransactionById: mock(async () => ({
        transactionId: "WH-1",
        employeeId: "EMP-1",
        itemName: "Filter Oli",
        approvalStatus: "APPROVED",
        itemStatus: "OPEN",
      })),
      markReady: mock(async () => ({
        transactionId: "WH-1",
        approvalStatus: "APPROVED",
        itemStatus: "READY",
        transactionType: "PENGAMBILAN",
      })),
    };
    const auditService = { log: mock(async () => {}) };
    const service = new DefaultWarehouseService(
      repository as never,
      auditService as never,
      {} as never,
    );

    await service.ready({
      user: { employeeId: "PIC-1", fullName: "Petugas", scope: {} },
    } as never, { transactionId: "WH-1", notes: null });

    expect(notifications).toEqual([[
      ["EMP-1"],
      {
        title: "Barang Siap Diambil",
        body: "Barang Filter Oli pada request WH-1 sudah siap diambil di gudang.",
        data: { logId: "WH-1", itemStatus: "READY", module: "warehouse" },
      },
      "sm_warehouse",
    ]]);
  });
});
