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
    const statements: Array<{ sql: string; params?: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => {
        statements.push({ sql });
        return [[{
          countdownId: "CD-1",
          carId: "UNIT-1",
          divisionId: 7,
          status: "PROSES",
          extensionRequestStatus: "MO_REVIEW",
          timeExtensionHours: 1,
          targetHoursInitial: 8,
          targetHoursRevised: 9,
          targetHours: 9,
          deadlineDate: "2026-08-18",
          picPlan: "PIC-1",
          requiredGrade: "SENIOR",
          revisionReason: "ADDITIONAL_DAMAGE",
        }]];
      },
      execute: async (sql: string, params?: unknown[]) => {
        statements.push({ sql, params });
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
    expect(statements.some(({ sql }) => sql.includes("pm_allocated_hours = pm_allocated_hours + ?"))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("target_hours = ?"))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes("approval_status"))).toBe(true);
    const auditInsert = statements.find(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"));
    expect(auditInsert?.sql).toContain("old_target_hours");
    expect(auditInsert?.params).toEqual([
      "CD-1", "EXTENSION", "ADDITIONAL_DAMAGE",
      9, 11, 2,
      "2026-08-18", "2026-08-20",
      "PIC-1", "PIC-1",
      "SENIOR", "SENIOR",
      "MO_APPROVAL", "CD-1", "ADDITIONAL_DAMAGE", "MO-1", "APPROVED",
    ]);
    expect(statements.some(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown_revisions"))).toBe(false);
    expect(statements.some(({ sql }) => sql.includes("DELETE FROM sm_jobdesc_countdown_revisions"))).toBe(false);
  });

  it("rolls back the approved revision when audit insert fails", async () => {
    let rollbackCalled = false;
    let commitCalled = false;
    const statements: string[] = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => { commitCalled = true; },
      rollback: async () => { rollbackCalled = true; },
      release: () => undefined,
      query: async () => [[{
        countdownId: "CD-1",
        carId: "UNIT-1",
        divisionId: 7,
        status: "PROSES",
        extensionRequestStatus: "MO_REVIEW",
        timeExtensionHours: 0,
        targetHoursInitial: 20,
        targetHoursRevised: 20,
        targetHours: 20,
        deadlineDate: "2026-08-18",
        revisionReason: "INPUT_ERROR",
      }]],
      execute: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("INSERT INTO sm_jobdesc_countdown_revisions")) {
          throw new Error("AUDIT_INSERT_FAILED");
        }
        return [{ affectedRows: sql.includes("UPDATE sm_unit_budgets") ? 1 : 0 }];
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
        input: { isApproved: true, approvedHours: -180, approvedDeadline: "2026-08-20" },
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("AUDIT_INSERT_FAILED");
    expect(rollbackCalled).toBe(true);
    expect(commitCalled).toBe(false);
    expect(statements.some((sql) => sql.includes("target_hours = ?"))).toBe(true);
    expect(statements.some((sql) => sql.includes("approval_status"))).toBe(true);
    expect(statements.some((sql) => sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"))).toBe(true);
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
        if (sql.includes("SUM(target_hours)")) return [[{ totalUsed: 5 }]];
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
    expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown_revisions") || sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"))).toBe(false);
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
        if (sql.includes("SUM(target_hours)")) return [[{ totalUsed: 0 }]];
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
    expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown_revisions") || sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"))).toBe(false);
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
    expect(statements.some((sql) => sql.includes("approval_status"))).toBe(false);
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

describe("CountdownRepository update mapping", () => {
  it("writes every clearable column and stores note on the keterangan column", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const detailRow = {
      countdownId: "CD-1", carId: "UNIT-1", unitName: "Unit 1", customerName: null,
      divisionId: 10, divisionName: "Body Work", panelId: 457, panelName: "Panel A",
      sectionName: "BODY WORK", taskCategory: "MAIN", prerequisiteCoreId: null, refWoId: null,
      picPlan: null, requiredGrade: null, kpName: null, kdName: null, picName: null,
      note: null, temuanAwal: null, keterangan: null, jobTypeId: null, jobTypeName: "Fitting",
      targetHoursInitial: 8, timeExtensionHours: 0, targetHoursRevised: 8,
      totalActualHours: 0, remainingHours: 8, actualProgressPercent: 0, status: "PLAN",
      extensionRequestStatus: null, requestedExtensionHours: 0, requestedDeadline: null,
      revisionReason: null, countRevision: 0, startDate: null, deadlineDate: "2026-09-30",
      createdAt: null, updatedAt: null, isOverdue: 0,
    };
    const queryRows = async (sql: string) => {
      if (sql.includes("FOR UPDATE")) {
        return [[{
          targetHours: 8,
          targetHoursInitial: 8,
          deadlineDate: "2026-09-30",
          picPlan: null,
          requiredGrade: null,
        }]];
      }
      if (sql.includes("FROM cars")) return [[{ id: "UNIT-1" }]];
      if (sql.includes("COALESCE(parent_id, id)")) return [[{ workDivisionId: 10 }]];
      if (sql.includes("FROM sm_jobdesc_countdown_detail")) return [[]];
      if (sql.includes("sm_work_photos_temp")) return [[]];
      return [[detailRow]];
    };
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: queryRows,
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new CountdownRepository(() => ({
      query: queryRows,
      getConnection: async () => connection,
    }) as never);

    await repository.updateCountdown(
      {
        employeeId: "EMP-1",
        scope: { canViewAllUnits: true, canViewAssignedUnits: false, divisionIds: [], managedDivisionIds: [], unitIds: [] },
      },
      "CD-1",
      {
        carId: "UNIT-1",
        divisionId: 10,
        sectionName: "BODY WORK",
        taskCategory: "MAIN",
        targetHoursInitial: 8,
        deadlineDate: "2026-09-30",
        status: "PLAN",
        panelId: 457,
        jobTypeId: null,
        startDate: null,
        prerequisiteCoreId: null,
        refWoId: null,
        picPlan: null,
        requiredGrade: null,
        temuanAwal: null,
        note: "catatan dari form",
      },
    );

    const update = executed[0];
    if (!update) throw new Error("UPDATE statement was not executed");
    for (const column of [
      "panel_id",
      "job_type_id",
      "start_date",
      "prerequisite_core_id",
      "ref_taks_id",
      "pic_plan",
      "required_grade",
      "temuan_awal",
      "keterangan",
    ]) {
      expect(update.sql).toContain(`${column} = ?`);
    }
    expect(update.params[3]).toBe(null);
    expect(update.params[4]).toBe(null);
    expect(update.params[7]).toBe(null);
    expect(update.params[15]).toBe(null);
    expect(update.params[19]).toBe(null);
    expect(update.params[20]).toBe("catatan dari form");
    expect(update.params[21]).toBe("CD-1");
  });
});

describe("CountdownRepository board filters", () => {
  it("maps smart view filters, search, and multi unit scope into SQL", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        statements.push({ sql, params });
        return sql.includes("COUNT(*)") ? [[{ total: 0 }]] : [[]];
      },
    };
    const repository = new CountdownRepository(() => pool as never);

    await repository.findCountdownBoard({
      employeeId: "EMP-1",
      scope: {
        canViewAllUnits: true,
        canViewAssignedUnits: false,
        divisionIds: [],
        managedDivisionIds: [],
        unitIds: [],
      },
      query: {
        page: 1,
        limit: 25,
        search: "asep",
        sortBy: "updatedAt",
        sortDirection: "desc",
        view: null,
        filters: [
          { field: "picPlan", operator: "eq", value: "SM-09.001" },
          { field: "requiredGrade", operator: "eq", value: "TK. II" },
          { field: "deadlineDate", operator: "gte", value: "2026-09-01" },
          { field: "deadlineDate", operator: "lte", value: "2026-09-30" },
          { field: "actualProgressPercent", operator: "gt", value: "0" },
          { field: "actualProgressPercent", operator: "lt", value: "100" },
          { field: "unitId", operator: "eq", value: "UNIT-1" },
          { field: "unitId", operator: "eq", value: "UNIT-2" },
          { field: "divisionId", operator: "eq", value: "10" },
          { field: "divisionId", operator: "eq", value: "11" },
        ],
      },
    });

    const boardQuery = statements[1];
    if (!boardQuery) throw new Error("board query was not executed");

    expect(boardQuery.sql).toContain("COALESCE(pic.full_name, cd.pic_plan, '') LIKE ?");
    expect(boardQuery.sql).toContain("cd.pic_plan = ?");
    expect(boardQuery.sql).toContain("cd.required_grade = ?");
    expect(boardQuery.sql).toContain("cd.deadline_date >= ?");
    expect(boardQuery.sql).toContain("cd.deadline_date <= ?");
    expect(boardQuery.sql).toContain("COALESCE(cd.actual_progress_percent, 0) > ?");
    expect(boardQuery.sql).toContain("COALESCE(cd.actual_progress_percent, 0) < ?");
    expect(boardQuery.sql).toContain("cd.car_id IN (?, ?)");
    expect(boardQuery.sql).toContain("selected_division.parent_id = cd.division_id");

    // 12 nilai search, lalu filter, lalu scope unit/divisi, diakhiri limit + offset.
    expect(boardQuery.params[0]).toBe("%asep%");
    expect(boardQuery.params[12]).toBe("SM-09.001");
    expect(boardQuery.params[13]).toBe("TK. II");
    expect(boardQuery.params[14]).toBe("2026-09-01");
    expect(boardQuery.params[15]).toBe("2026-09-30");
    expect(boardQuery.params[16]).toBe(0);
    expect(boardQuery.params[17]).toBe(100);
    expect(boardQuery.params.slice(18, 20)).toEqual(["UNIT-1", "UNIT-2"]);
    expect(boardQuery.params.slice(20, 24)).toEqual(["10", "10", "11", "11"]);
    expect(boardQuery.params.slice(-2)).toEqual([25, 0]);
  });
});
