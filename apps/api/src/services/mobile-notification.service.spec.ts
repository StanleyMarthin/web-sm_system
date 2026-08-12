import { describe, expect, it } from "bun:test";
import {
  notifyMobileEmployees,
  resolveEmployeeIdsByPermission,
} from "./mobile-notification.service";

describe("mobile notification producer", () => {
  it("publishes the notification contract with normalized recipients", async () => {
    const calls: unknown[][] = [];
    const redisFactory = async () => ({
      xAdd: async (...args: unknown[]) => calls.push(args),
    });

    await notifyMobileEmployees(
      [" EMP-2 ", "", "EMP-1", "EMP-2"],
      { title: " Approval ", body: " Job plan baru ", data: { module: "job-plan" } },
      " smsystem-web ",
      redisFactory,
    );

    expect(calls.length).toBe(1);
    expect(calls[0]?.slice(0, 3)).toEqual([
      "notif:requests",
      "*",
      {
        payload: JSON.stringify({
          target: { type: "employee", employeeIds: ["EMP-2", "EMP-1"] },
          notification: {
            title: "Approval",
            body: "Job plan baru",
            data: { module: "job-plan" },
          },
          source: "smsystem-web",
        }),
      },
    ]);
  });

  it("does nothing for empty recipients or invalid content", async () => {
    let calls = 0;
    const redisFactory = async () => ({ xAdd: async () => { calls += 1; } });

    await notifyMobileEmployees([], { title: "Title", body: "Body" }, "web", redisFactory);
    await notifyMobileEmployees(["EMP-1"], { title: " ", body: "Body" }, "web", redisFactory);
    await notifyMobileEmployees(
      ["EMP-1"],
      { title: "x".repeat(256), body: "Body" },
      "web",
      redisFactory,
    );

    expect(calls).toBe(0);
  });

  it("never lets Redis failure break the business action", async () => {
    const redisFactory = async () => ({
      xAdd: async () => { throw new Error("redis down"); },
    });

    await notifyMobileEmployees(
      ["EMP-1"],
      { title: "Title", body: "Body" },
      "web",
      redisFactory,
    );
  });
});

describe("notification recipients", () => {
  it("resolves active employees by permission and optional division", async () => {
    const queries: Array<[string, unknown[]]> = [];
    const poolFactory = () => ({
      query: async (sql: string, params: unknown[]) => {
        queries.push([sql, params]);
        return [[{ employeeId: "EMP-2" }, { employeeId: " EMP-1 " }, { employeeId: "EMP-2" }]];
      },
    });

    expect(await resolveEmployeeIdsByPermission(" WO_APPROVE ", 7, poolFactory)).toEqual([
      "EMP-2",
      "EMP-1",
    ]);
    expect(queries[0]?.[1]).toEqual(["WO_APPROVE", 7, 7]);
    expect(queries[0]?.[0]).toContain("emd.division_id = ?");
  });
});
