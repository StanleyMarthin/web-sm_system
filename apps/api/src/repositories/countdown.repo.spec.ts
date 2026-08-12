import { describe, expect, it } from "bun:test";
import { CountdownRepository } from "./countdown.repo";

describe("CountdownRepository detail documentation", () => {
  it("loads work photos in one scoped query and groups them by actual", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        statements.push({ sql, params });
        if (sql.includes("LIMIT 1")) {
          return [[{
            countdownId: "CD-1", carId: "UNIT-1", unitName: "Unit 1", customerName: null,
            divisionId: 7, divisionName: "Mekanik", panelId: null, panelName: null,
            sectionName: "Mesin", taskCategory: "WO", prerequisiteCoreId: null, refWoId: null,
            note: null, temuanAwal: null, keterangan: null, jobTypeId: null, jobTypeName: null,
            targetHoursInitial: 8, timeExtensionHours: 0, targetHoursRevised: 8,
            totalActualHours: 2, remainingHours: 6, actualProgressPercent: 25, status: "PROSES",
            extensionRequestStatus: null, requestedExtensionHours: 0, requestedDeadline: null,
            revisionReason: null, countRevision: 0, startDate: null, deadlineDate: null,
            createdAt: null, updatedAt: null, isOverdue: 0,
          }]];
        }
        if (sql.includes("FROM sm_jobdesc_countdown_detail")) {
          return [[{
            detailId: "DETAIL-1", actualId: "ACTUAL-1", entryType: "ACTUAL",
            employeeId: "EMP-1", employeeName: "Teknisi", employeeRole: "PIC",
            workDate: "2026-08-10", startTime: "08:00", finishTime: "10:00",
            billedHours: 2, progressPercent: 25, taskStatus: "PROSES",
            dailyNotes: "Membersihkan dudukan kondensor.",
          }]];
        }
        return [[{
          actualId: "ACTUAL-1", photoId: "PHOTO-1", type: "AFTER", url: "/work/after.jpg",
          caption: "Hasil", uploader: "Teknisi", time: "2026-08-10 10:00:00",
        }]];
      },
    };
    const repository = new CountdownRepository(() => pool as never);

    const result = await repository.findCountdownDetail({
      employeeId: "EMP-1",
      scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
      countdownId: "CD-1",
    });

    expect(result?.details[0]?.actualId).toBe("ACTUAL-1");
    expect(result?.details[0]?.dailyNotes).toBe("Membersihkan dudukan kondensor.");
    expect(result?.details[0]?.photos).toEqual([{
      photoId: "PHOTO-1", type: "AFTER", url: "/work/after.jpg",
      caption: "Hasil", uploader: "Teknisi", time: "2026-08-10 10:00:00",
    }]);
    expect(statements.length).toBe(3);
    expect(statements[1]?.sql).toContain("actual.daily_notes");
    expect(statements[2]?.sql).toContain("sm_work_photos_temp");
    expect(statements[2]?.sql).toContain("sm_work_ledger_photos");
    expect(statements[2]?.params).toEqual(["CD-1", "CD-1"]);
  });
});

describe("CountdownRepository revision decision", () => {
  it("allows a child team to request revision on its centralized parent countdown", async () => {
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("FROM sm_divisi")) return [[{ id: "11" }]];
        return [[{
          countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
          extensionRequestStatus: null, timeExtensionHours: 0, targetHoursInitial: 8,
        }]];
      },
      execute: async () => [{}],
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);

    const result = await repository.requestCountdownRevision({
      employeeId: "KD-1",
      scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [11], managedDivisionIds: [], unitIds: [] },
      countdownId: "CD-1",
      input: { requestedHours: 2, requestedDeadline: "2026-08-20", reason: "Tambahan" },
    });

    expect(result.status).toBe("REQUESTED");
    expect(statements.some((sql) => sql.includes("parent_id = ?"))).toBe(true);
  });

  it("expands both unit budgets and applies an MO-approved revision atomically", async () => {
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push(sql);
        return [[{
          countdownId: "CD-1",
          carId: "UNIT-1",
          divisionId: 7,
          status: "PROSES",
          extensionRequestStatus: "MO_REVIEW",
          timeExtensionHours: 1,
          targetHoursInitial: 8,
        }]];
      },
      execute: async (sql: string) => {
        statements.push(sql);
        return [{ affectedRows: sql.includes("UPDATE sm_unit_budgets") ? 1 : 0 }];
      },
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);

    const result = await repository.decideCountdownRevision({
      employeeId: "MO-1",
      scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
      countdownId: "CD-1",
      isMo: true,
      input: { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" },
    });

    expect(result.status).toBe("APPROVED");
    expect(statements.some((sql) => sql.includes("pm_allocated_hours = pm_allocated_hours + ?"))).toBe(true);
    expect(statements.some((sql) => sql.includes("extension_request_status = 'APPROVED'"))).toBe(true);
  });

  it("forwards a KP approval to MO_REVIEW when the revised total exceeds budget", async () => {
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("pm_allocated_hours AS allocatedHours")) return [[{ allocatedHours: 10 }]];
        if (sql.includes("SUM(target_hours_revised)")) return [[{ totalUsed: 5 }]];
        return [[{
          countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
          extensionRequestStatus: "REQUESTED", timeExtensionHours: 0, targetHoursInitial: 8,
        }]];
      },
      execute: async (sql: string) => { statements.push(sql); return [{}]; },
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);

    const result = await repository.decideCountdownRevision({
      employeeId: "KP-1",
      scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [7], managedDivisionIds: [7], unitIds: [] },
      countdownId: "CD-1",
      isMo: false,
      input: { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" },
    });

    expect(result.status).toBe("MO_REVIEW");
    expect(statements.some((sql) => sql.includes("LIMIT 1 FOR UPDATE"))).toBe(true);
    expect(statements.some((sql) => sql.includes("extension_request_status = 'MO_REVIEW'"))).toBe(true);
    expect(statements.some((sql) => sql.includes("extension_request_status = 'APPROVED'"))).toBe(false);
  });

  it("forwards KP approval to MO when the unit budget row is missing", async () => {
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("pm_allocated_hours AS allocatedHours")) return [[]];
        if (sql.includes("SUM(target_hours_revised)")) return [[{ totalUsed: 0 }]];
        return [[{
          countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
          extensionRequestStatus: "REQUESTED", timeExtensionHours: 0, targetHoursInitial: 8,
        }]];
      },
      execute: async (sql: string) => { statements.push(sql); return [{}]; },
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);

    const result = await repository.decideCountdownRevision({
      employeeId: "KP-1",
      scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
      countdownId: "CD-1",
      isMo: false,
      input: { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" },
    });

    expect(result.status).toBe("MO_REVIEW");
    expect(statements.some((sql) => sql.includes("extension_request_status = 'APPROVED'"))).toBe(false);
  });

  it("does not approve an MO revision when its unit budget row is missing", async () => {
    let rollbackCalled = false;
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => { rollbackCalled = true; },
      release: () => undefined,
      query: async () => [[{
        countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
        extensionRequestStatus: "MO_REVIEW", timeExtensionHours: 0, targetHoursInitial: 8,
      }]],
      execute: async (sql: string) => {
        statements.push(sql);
        return [{ affectedRows: 0 }];
      },
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);

    let message = "";
    try {
      await repository.decideCountdownRevision({
        employeeId: "MO-1",
        scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
        countdownId: "CD-1",
        isMo: true,
        input: { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" },
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("COUNTDOWN_UNIT_BUDGET_NOT_FOUND");
    expect(rollbackCalled).toBe(true);
    expect(statements.some((sql) => sql.includes("extension_request_status = 'APPROVED'"))).toBe(false);
  });

  it("blocks a new request while MO review is pending", async () => {
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
        extensionRequestStatus: "MO_REVIEW", timeExtensionHours: 0, targetHoursInitial: 8,
      }]],
      execute: async () => [{}],
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);
    let message = "";
    try {
      await repository.requestCountdownRevision({
        employeeId: "KD-1",
        scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
        countdownId: "CD-1",
        input: { requestedHours: 2, requestedDeadline: "2026-08-20", reason: "Tambahan" },
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("COUNTDOWN_REVISION_ALREADY_REQUESTED");
  });

  it("rejects KP approval when the actor is not the active assigned KP", async () => {
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => sql.includes("FROM car_project_assignment")
        ? [[]]
        : [[{
            countdownId: "CD-1", carId: "UNIT-1", divisionId: 7, status: "PROSES",
            extensionRequestStatus: "REQUESTED", timeExtensionHours: 0, targetHoursInitial: 8,
          }]],
      execute: async () => [{}],
    };
    const repository = new CountdownRepository(() => ({ getConnection: async () => connection }) as never);
    let message = "";
    try {
      await repository.decideCountdownRevision({
        employeeId: "KP-OTHER",
        scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [7], managedDivisionIds: [7], unitIds: [] },
        countdownId: "CD-1",
        isMo: false,
        input: { isApproved: false, approvedHours: 0, approvedDeadline: "2026-08-20" },
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("COUNTDOWN_REVISION_FORBIDDEN");
  });
});
