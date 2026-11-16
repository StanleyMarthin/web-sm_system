import { describe, expect, it } from "bun:test";
import type { QcGridQuery } from "@smsystem/contracts/qc";
import { MySqlQcRepository } from "./qc.repo";
import { parseQcNotes, qcNotesTextSql, readQcNotesText } from "./qc-notes";

const query: QcGridQuery = {
  page: 1,
  limit: 20,
  search: "",
  sortBy: "waitingHours",
  sortDirection: "desc",
  view: null,
  filters: [],
};

const scope = {
  canViewAllUnits: true,
  canViewAssignedUnits: false,
  divisionIds: [],
  managedDivisionIds: [],
  unitIds: [],
};

describe("MySqlQcRepository mobile parity", () => {
  it("lists only technical countdown rows in QC queue", async () => {
    const statements: string[] = [];
    const repository = new MySqlQcRepository(() => ({
      query: async (sql: string) => {
        statements.push(sql);
        if (sql.includes("COUNT(*) AS total")) return [[{ total: 0 }]];
        return [[]];
      },
    }) as never);

    await repository.listQueue({
      employeeId: "EMP-1",
      scope,
      query,
    });

    expect(statements.some((sql) => sql.includes("COALESCE(jt.is_teknis, 1) = 1"))).toBe(true);
  });

  it("keeps KD pass in READY_QC until QA approves it", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        coreId: "CD-1",
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 1,
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.passInspection(
      { actorId: "KD-1", qcLevel: "QC_KD" },
      {
        coreId: "CD-1",
        payload: {
          notes: null,
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
        },
      },
    );

    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));
    expect(Array.isArray(countdownUpdate?.params)).toBe(true);
    expect(typeof countdownUpdate?.params[1]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      "READY_QC",
      countdownUpdate?.params[1],
      "QC_KD",
      1,
      "KD-1",
      "CD-1",
    ]);
  });

  it("marks countdown DONE only after QA pass", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async () => [[{
        coreId: "CD-1",
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 1,
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.passInspection(
      { actorId: "ADV-1", qcLevel: "QC_QA" },
      {
        coreId: "CD-1",
        payload: {
          notes: null,
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
        },
      },
    );

    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));
    expect(Array.isArray(countdownUpdate?.params)).toBe(true);
    expect(typeof countdownUpdate?.params[1]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      "DONE",
      countdownUpdate?.params[1],
      "QC_QA",
      0,
      "ADV-1",
      "CD-1",
    ]);
  });

  it("extends the same countdown when QC rework needs more hours", async () => {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined,
      commit: async () => undefined,
      rollback: async () => undefined,
      release: () => undefined,
      query: async (sql: string) => sql.includes("FROM sm_employee WHERE")
        ? [[{ employeeId: "SM-1", fullName: "Worker", divisionId: 7, isActive: 1 }]] : [[{
        coreId: "CD-1", divisionId: 7, panelId: 11,
        jobName: "Las panel",
        panelName: "Panel A",
        reworkPlanId: null,
        remainingHours: 0.5,
        targetHours: 10,
        deadlineDate: "2026-10-02",
        isTechnicalJob: 1,
        workCompleted: 1,
      }]],
      execute: async (sql: string, params: unknown[]) => {
        executed.push({ sql, params });
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({
      getConnection: async () => connection,
    }) as never);

    await repository.rejectInspection(
      { actorId: "QA-1", qcLevel: "QC_QA" },
      {
        coreId: "CD-1",
        payload: {
          notes: "ulang las",
          inspectionDurationMinutes: null,
          photoBeforeUrl: null,
          evidencePhotoUrl: null,
          reworkDate: "2026-10-03",
          reworkAssignedUser: "SM-1",
          reworkDailyHours: "01:00",
          reworkStartTime: "08:00",
          reworkFinishTime: "09:00",
          reworkDescription: "Rework las",
          reworkIsOvertime: false,
          reworkIsPriority: false,
        },
      },
    );

    const revisionInsert = executed.find(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown_revisions"));
    const countdownUpdate = executed.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));

    expect(revisionInsert?.params.slice(0, 6)).toEqual(["CD-1", 10, 10.5, 0.5, "2026-10-02", "2026-10-02"]);
    expect(countdownUpdate?.sql).toContain("SET status = 'PROSES'");
    expect(typeof countdownUpdate?.params[0]).toBe("string");
    expect(countdownUpdate?.params).toEqual([
      countdownUpdate?.params[0],
      countdownUpdate?.params[1],
      "QC_QA",
      10.5,
      1,
      "QA-1",
      "CD-1",
    ]);
  });
});

it("reads QC history with examiner, duration and photos within the user's division scope", async () => {
  let sql = "";
  let bound: unknown[] = [];
  const repository = new MySqlQcRepository(() => ({
    query: async (query: string, params: unknown[]) => {
      sql = query; bound = params;
      return [[{ qcId: "QC-1", qcLevel: "QC_KD", resultStatus: "LOLOS",
        inspectionDate: "2026-10-02 08:00:00", inspectorId: "KD-1", inspectorName: "Haris",
        inspectionDurationMinutes: "42", notes: "rapi", photoBeforeUrl: "https://example.com/1.jpg",
        evidencePhotoUrl: "https://example.com/2.jpg" }]];
    },
  }) as never);
  const history = await repository.listInspectionHistory({ employeeId: "KD-1", coreId: "CD-1",
    scope: { ...scope, canViewAllUnits: false, divisionIds: [12], managedDivisionIds: [12] } });
  expect(sql).toContain("cd.division_id IN");
  expect(sql).toContain("ORDER BY q.inspection_date DESC");
  expect(bound).toEqual(["CD-1", 12]);
  expect(history[0]?.inspectorName).toBe("Haris");
  expect(history[0]?.inspectionDurationMinutes).toBe(42);
  expect(history[0]?.evidencePhotoUrl).toBe("https://example.com/2.jpg");
});

it("records KD pass and reject without overriding a QA result or creating rework", async () => {
  const statements: string[] = [];
  const connection = {
    beginTransaction: async () => undefined, commit: async () => undefined,
    rollback: async () => undefined, release: () => undefined,
    query: async () => [[{ coreId: "CD-1", isTechnicalJob: 1,
      workCompleted: 1, qaQcId: "QA-1", qaResult: "LOLOS" }]],
    execute: async (sql: string) => { statements.push(sql); return [{}]; },
  };
  const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
  await repository.passInspection({ actorId: "KD", qcLevel: "QC_KD" }, {
    coreId: "CD-1", payload: { notes: null, inspectionDurationMinutes: null, photoBeforeUrl: null, evidencePhotoUrl: null },
  });
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_qc_inspections"))).toBe(true);
  expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown"))).toBe(false);
  statements.length = 0;
  const rejected = await repository.rejectInspection({ actorId: "KD", qcLevel: "QC_KD" }, {
    coreId: "CD-1", payload: { notes: "KD tidak lolos", inspectionDurationMinutes: null,
      photoBeforeUrl: null, evidencePhotoUrl: null, reworkAssignedUser: "" } as never,
  });
  expect(rejected.applied).toBe(false);
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_qc_inspections"))).toBe(true);
  expect(statements.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown"))).toBe(false);
  expect(statements.some((sql) => sql.includes("INSERT INTO sm_jobdesc_plan"))).toBe(false);
});

it("blocks inspection for unfinished actual work", async () => {
  const connection = {
    beginTransaction: async () => undefined, rollback: async () => undefined, release: () => undefined,
    query: async () => [[{ isTechnicalJob: 1, workCompleted: 0 }]],
  };
  const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
  const error = await repository.passInspection({ actorId: "QA", qcLevel: "QC_QA" }, {
    coreId: "CD-1", payload: { notes: null, inspectionDurationMinutes: null, photoBeforeUrl: null, evidencePhotoUrl: null },
  }).then(() => null, (error: Error) => error.message);
  expect(error).toBe("QC_WORK_NOT_COMPLETED");
});

describe("QC rework Job Plan draft", () => {
  const payload = {
    notes: "Perbaiki sambungan las", inspectionDurationMinutes: null,
    photoBeforeUrl: null, evidencePhotoUrl: null, reworkDate: "2026-11-14",
    reworkAssignedUser: "PIC-1", reworkDailyHours: "01:00",
    reworkStartTime: "08:00", reworkFinishTime: "09:00",
    reworkDescription: "Perbaikan sambungan las", reworkIsOvertime: false,
    reworkIsPriority: false,
  };

  for (const [remainingHours, extensionHours, nextRemaining] of [[2, 0, 2], [0.5, 0.5, 1], [0, 1, 1]]) {
    it(`uses ${remainingHours} remaining hours and extends only by ${extensionHours}`, async () => {
      const writes: Array<{ sql: string; params: unknown[] }> = [];
      const connection = {
        beginTransaction: async () => undefined, commit: async () => undefined,
        rollback: async () => undefined, release: () => undefined,
        query: async (sql: string) => sql.includes("FROM sm_employee WHERE")
          ? [[{ employeeId: "PIC-1", fullName: "Worker", divisionId: 7, isActive: 1 }]] : [[{ coreId: "CD-1", carId: "CAR-1", unitName: "Unit A",
          divisionId: 7, divisionName: "BODY", panelId: 11, panelName: "Panel A",
          jobName: "Las", jobTypeId: "JOB-1", latestActualId: "ACT-1",
          remainingHours, targetHours: 10, isTechnicalJob: 1, workCompleted: 1 }]],
        execute: async (sql: string, params: unknown[]) => { writes.push({ sql, params }); return [{}]; },
      };
      const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
      const result = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, { coreId: "CD-1", payload });
      const qcWrite = writes.find(({ sql }) => sql.includes("INSERT INTO sm_qc_inspections"));
      const envelope = JSON.parse(String(qcWrite?.params[2]));
      expect(envelope.notes).toBe(payload.notes);
      expect(envelope.workActualId).toBe("ACT-1");
      expect(envelope.jobPlanDraftState).toBe("DRAFT");
      expect(envelope.jobPlanDraft).toMatchObject({
        draftItemId: `qc-rework:${result.qcId}`, sourceType: "COUNTDOWN", coreId: "CD-1",
        carId: "CAR-1", divisionId: 7, panelId: 11, assignedUserId: "PIC-1",
        taskDate: "2026-11-14", targetHours: 1, isRework: true,
      });
      expect(qcWrite?.params[5]).toBe(null);
      expect(result.reworkPlanId).toBe(null);
      expect(result.extensionHours).toBe(extensionHours);
      expect(writes.filter(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_countdown_revisions")).length).toBe(extensionHours > 0 ? 1 : 0);
      expect(writes.some(({ sql }) => /INSERT INTO sm_jobdesc_(plan|countdown)\s*\(/u.test(sql))).toBe(false);
      const countdown = writes.find(({ sql }) => sql.includes("UPDATE sm_jobdesc_countdown"));
      expect(countdown?.sql).toContain("status = 'PROSES'");
      expect(countdown?.params.slice(3, 5)).toEqual([10 + extensionHours, nextRemaining]);
      expect(writes.some(({ sql }) => sql.includes("UPDATE sm_jobdesc_actual"))).toBe(false);
    });
  }

  it("reuses the same QA rejection for one actual even after its draft was submitted", async () => {
    const writes: string[] = [];
    const connection = {
      beginTransaction: async () => undefined, commit: async () => undefined,
      rollback: async () => undefined, release: () => undefined,
      query: async () => [[{ isTechnicalJob: 1, workCompleted: 1,
        latestActualId: "ACT-1", reworkQcId: "QC-1", reworkPlanId: null,
        reworkQcNotes: JSON.stringify({ notes: "ulang", workActualId: "ACT-1",
          jobPlanDraftState: "SUBMITTED", extensionHours: 0.5,
          jobPlanDraft: { draftItemId: "qc-rework:QC-1" } }) }]],
      execute: async (sql: string) => { writes.push(sql); return [{}]; },
    };
    const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
    const result = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, { coreId: "CD-1", payload });
    expect(result).toMatchObject({ qcId: "QC-1", coreId: "CD-1", reworkPlanId: null,
      draftItemId: "qc-rework:QC-1", extensionHours: 0.5, reused: true });
    expect(writes).toEqual([]);
  });

  it("waits for a new completed actual before QA can pass rejected work", async () => {
    const writes: string[] = [];
    const connection = {
      beginTransaction: async () => undefined, commit: async () => undefined,
      rollback: async () => undefined, release: () => undefined,
      query: async () => [[{ isTechnicalJob: 1, workCompleted: 1,
        latestActualId: "ACT-1", reworkQcNotes: JSON.stringify({ workActualId: "ACT-1",
          jobPlanDraftState: "SUBMITTED", jobPlanDraft: { draftItemId: "qc-rework:QC-1" } }) }]],
      execute: async (sql: string) => { writes.push(sql); return [{}]; },
    };
    const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
    const error = await repository.passInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, {
      coreId: "CD-1", payload: { notes: null, inspectionDurationMinutes: null, photoBeforeUrl: null, evidencePhotoUrl: null },
    }).then(() => null, (error: Error) => error.message);
    expect(error).toBe("QC_WORK_NOT_COMPLETED");
    expect(writes).toEqual([]);
  });

  it("creates another draft for the next completed actual without resetting old work", async () => {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const connection = {
      beginTransaction: async () => undefined, commit: async () => undefined,
      rollback: async () => undefined, release: () => undefined,
      query: async (sql: string) => sql.includes("FROM sm_employee WHERE")
        ? [[{ employeeId: "PIC-1", fullName: "Worker", divisionId: 7, isActive: 1 }]] : [[{ divisionId: 7, panelId: 11, isTechnicalJob: 1, workCompleted: 1, remainingHours: 2, targetHours: 10,
        latestActualId: "ACT-2", reworkQcId: "QC-1", reworkQcNotes: JSON.stringify({ workActualId: "ACT-1",
          jobPlanDraftState: "SUBMITTED", jobPlanDraft: { draftItemId: "qc-rework:QC-1" } }) }]],
      execute: async (sql: string, params: unknown[]) => { writes.push({ sql, params }); return [{}]; },
    };
    const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
    const result = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, { coreId: "CD-1", payload });
    expect(result.qcId === "QC-1").toBe(false);
    const qcWrite = writes.find(({ sql }) => sql.includes("INSERT INTO sm_qc_inspections"));
    expect(JSON.parse(String(qcWrite?.params[2])).workActualId).toBe("ACT-2");
    expect(writes.some(({ sql }) => sql.includes("UPDATE sm_jobdesc_actual"))).toBe(false);
  });

  it("rolls back the extension if the durable draft cannot be saved", async () => {
    let committed = 0;
    let rolledBack = 0;
    const writes: string[] = [];
    const connection = {
      beginTransaction: async () => undefined, commit: async () => { committed += 1; },
      rollback: async () => { rolledBack += 1; }, release: () => undefined,
      query: async (sql: string) => sql.includes("FROM sm_employee WHERE")
        ? [[{ employeeId: "PIC-1", fullName: "Worker", divisionId: 7, isActive: 1 }]] : [[{ divisionId: 7, panelId: 11, latestActualId: "ACT-1", remainingHours: 0,
        targetHours: 10, isTechnicalJob: 1, workCompleted: 1 }]],
      execute: async (sql: string) => {
        writes.push(sql);
        if (sql.includes("INSERT INTO sm_qc_inspections")) throw new Error("WRITE_FAILED");
        return [{}];
      },
    };
    const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
    const error = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, { coreId: "CD-1", payload })
      .then(() => null, (error: Error) => error.message);
    expect(error).toBe("WRITE_FAILED");
    expect(committed).toBe(0);
    expect(rolledBack).toBe(1);
    expect(writes.some((sql) => sql.includes("UPDATE sm_jobdesc_countdown"))).toBe(false);
  });

  for (const [label, worker, panelId, expected] of [
    ["missing worker", null, 11, "QC_REWORK_WORKER_INVALID"],
    ["inactive worker", { employeeId: "PIC-1", divisionId: 7, isActive: 0 }, 11, "QC_REWORK_WORKER_INVALID"],
    ["different division", { employeeId: "PIC-1", divisionId: 8, isActive: 1 }, 11, "QC_REWORK_WORKER_INVALID"],
    ["missing panel", { employeeId: "PIC-1", divisionId: 7, isActive: 1 }, null, "QC_REWORK_PANEL_REQUIRED"],
  ] as const) {
    it(`rejects ${label} before reopening Countdown or saving a draft`, async () => {
      const writes: string[] = [];
      const reads: Array<{ sql: string; params: unknown[] }> = [];
      let rolledBack = false;
      const connection = {
        beginTransaction: async () => undefined, commit: async () => undefined,
        rollback: async () => { rolledBack = true; }, release: () => undefined,
        query: async (sql: string, params: unknown[]) => {
          reads.push({ sql, params });
          return sql.includes("FROM sm_employee WHERE") ? [worker ? [worker] : []] : [[{
            coreId: "CD-1", carId: "CAR-1", divisionId: 7, panelId,
            remainingHours: 0, targetHours: 10, latestActualId: "ACT-1",
            isTechnicalJob: 1, workCompleted: 1,
          }]];
        },
        execute: async (sql: string) => { writes.push(sql); return [{}]; },
      };
      const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
      const result = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, { coreId: "CD-1", payload })
        .then(() => null, (error: Error) => error.message);
      expect(result).toBe(expected);
      expect(writes).toEqual([]);
      expect(rolledBack).toBe(true);
      if (panelId) expect(reads.at(-1)?.params).toEqual(["PIC-1"]);
    });
  }

  for (const duration of ["00:00", "00:99", "13:00", "NaN:00"]) {
    it(`rejects unusable rework duration ${duration} without writes`, async () => {
      const writes: string[] = [];
      const connection = {
        beginTransaction: async () => undefined, commit: async () => undefined,
        rollback: async () => undefined, release: () => undefined,
        query: async () => [[{ isTechnicalJob: 1, workCompleted: 1 }]],
        execute: async (sql: string) => { writes.push(sql); return [{}]; },
      };
      const repository = new MySqlQcRepository(() => ({ getConnection: async () => connection }) as never);
      const error = await repository.rejectInspection({ actorId: "QA-1", qcLevel: "QC_QA" }, {
        coreId: "CD-1", payload: { ...payload, reworkDailyHours: duration },
      }).then(() => null, (error: Error) => error.message);
      expect(error).toBe("QC_REWORK_HOURS_INVALID");
      expect(writes).toEqual([]);
    });
  }
});

it("keeps plain QC notes readable and hides the draft envelope", () => {
  const stored = JSON.stringify({ notes: "las ulang", jobPlanDraftState: "DRAFT", jobPlanDraft: { draftItemId: "qc-rework:QC-1" } });
  expect(parseQcNotes(stored)?.jobPlanDraftState).toBe("DRAFT");
  expect(readQcNotesText(stored)).toBe("las ulang");
  expect(readQcNotesText("catatan lama")).toBe("catatan lama");
  expect(readQcNotesText('{"example":1}')).toBe('{"example":1}');
  expect(readQcNotesText(null)).toBe(null);
  expect(qcNotesTextSql("q.qc_notes")).toContain("JSON_VALID(q.qc_notes)");
});

it("resolves active KD by division, KP by unit or managed division, and PM by role", async () => {
  let sql = "";
  let values: unknown[] = [];
  const repository = new MySqlQcRepository(() => ({ query: async (query: string, params: unknown[]) => {
    sql = query; values = params;
    return [[{ employeeId: "KD-7", recipientType: "KD" },
      { employeeId: "KP-1", recipientType: "KP_PM" }, { employeeId: "PM-1", recipientType: "KP_PM" }]];
  } }) as never);
  const recipients = await repository.findNotificationRecipients("CD-1");
  expect(values).toEqual(["CD-1"]);
  expect(sql).toContain("COALESCE(e.is_active, 1) = 1");
  expect(sql).toContain("emd.division_id = cd.division_id");
  expect(sql).toContain("cpa.car_id = cd.car_id AND cpa.kp_id = e.employee_id AND cpa.ended_at IS NULL");
  expect(recipients).toEqual({ kdIds: ["KD-7"], kpPmIds: ["KP-1", "PM-1"] });
});

it("shows durable and submitted drafts in the QC rework list before SQL plan projection", async () => {
  const statements: string[] = [];
  const repository = new MySqlQcRepository(() => ({ query: async (sql: string) => {
    statements.push(sql);
    if (sql.includes("LIMIT ? OFFSET ?")) return [[{
      coreId: "CD-1", carId: "CAR-1", unitName: "Unit A", divisionId: 7, panelId: 11,
      countdownStatus: "PROSES", reworkPlanId: null, reworkPlanStatus: "DRAFT",
      reworkTaskDate: "2026-11-14", reworkAssignedUserId: "PIC-1",
      latestInspectionNotes: JSON.stringify({ notes: "las ulang", jobPlanDraftState: "DRAFT", jobPlanDraft: { coreId: "CD-1" } }),
    }]];
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
    return [[]];
  } }) as never);
  const result = await repository.listRework({ employeeId: "QA-1", scope, query });
  expect(result.rows[0]?.reworkPlanStatus).toBe("DRAFT");
  expect(result.rows[0]?.latestInspectionNotes).toBe("las ulang");
  const listSql = statements.find((sql) => sql.includes("LIMIT ? OFFSET ?")) ?? "";
  expect(listSql).toContain("IN ('DRAFT', 'SUBMITTED')");
  expect(listSql).toContain("$.jobPlanDraft.linkedPlanId");
  expect(listSql).toContain("AND rework_plan.core_id = cd.id");
  expect(listSql).toContain("WHEN 'SUBMITTED' THEN 'PENDING_APPROVAL'");
  const summarySql = statements.find((sql) => sql.includes("AS activeReworkCount")) ?? "";
  expect(summarySql).toContain("IN ('DRAFT', 'SUBMITTED')");
});
