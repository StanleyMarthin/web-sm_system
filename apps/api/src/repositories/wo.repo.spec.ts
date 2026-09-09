import { describe, expect, it } from "bun:test";
import { MySqlWoRepository } from "./wo.repo";

function createRepositoryMock(options: {
  masterPanel?: { id: number; panelName: string | null; namePart: string | null } | null;
} = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => undefined,
    commit: async () => undefined,
    rollback: async () => undefined,
    release: () => undefined,
    query: async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes("FROM sm_jobdesc_wo")) {
        return [[{ total: 0 }]];
      }
      if (sql.includes("FROM master_panels")) {
        return [options.masterPanel ? [options.masterPanel] : []];
      }
      return [[]];
    },
    execute: async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      return [{}];
    },
  };

  return {
    repository: new MySqlWoRepository(() => ({
      getConnection: async () => connection,
    }) as never),
    statements,
  };
}

describe("MySqlWoRepository master panel relation", () => {
  it("stores master_panel_id when WO is created from a valid master panel", async () => {
    const { repository, statements } = createRepositoryMock({
      masterPanel: {
        id: 12397,
        panelName: "91 DRIVER'S SEAT 2",
        namePart: "Locking Bracket",
      },
    });

    await repository.create(
      { actorId: "EMP-1", fromDivisionId: 1 },
      {
        carId: "220S",
        masterPanelId: 12397,
        toDivisionId: 2,
        requestDate: "2026-09-09",
        isPriority: false,
        panelName: null,
        jobDetail: "Repair bracket",
        estimatedHours: 2,
        notes: null,
        items: [],
      },
    );

    const insert = statements.find(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_wo"));
    expect(insert?.sql).toContain("master_panel_id");
    expect(insert?.params[4]).toBe(12397);
    expect(insert?.params[5]).toBe(1);
  });

  it("rejects a master panel that does not belong to the WO unit", async () => {
    const { repository } = createRepositoryMock({ masterPanel: null });

    let errorMessage = "";
    try {
      await repository.create(
        { actorId: "EMP-1", fromDivisionId: 1 },
        {
          carId: "UNIT-A",
          masterPanelId: 999,
          toDivisionId: 2,
          requestDate: "2026-09-09",
          isPriority: false,
          panelName: null,
          jobDetail: "Cross unit",
          estimatedHours: null,
          notes: null,
          items: [],
        },
      );
    } catch (error) {
      errorMessage = (error as Error).message;
    }

    expect(errorMessage).toBe("WO_MASTER_PANEL_NOT_FOUND");
  });

  it("keeps legacy WO creation by panelName with master_panel_id null", async () => {
    const { repository, statements } = createRepositoryMock();

    await repository.create(
      { actorId: "EMP-1", fromDivisionId: 1 },
      {
        carId: "LEGACY-UNIT",
        toDivisionId: 2,
        requestDate: "2026-09-09",
        isPriority: false,
        panelName: "BODY DEPAN",
        jobDetail: "Legacy WO",
        estimatedHours: null,
        notes: null,
        items: [],
      },
    );

    const insert = statements.find(({ sql }) => sql.includes("INSERT INTO sm_jobdesc_wo"));
    expect(insert?.params[4]).toBe(null);
    expect(insert?.params).toContain("BODY DEPAN");
  });

  it("does not resolve create requests through master panel names", async () => {
    const { repository, statements } = createRepositoryMock();

    await repository.create(
      { actorId: "EMP-1", fromDivisionId: 1 },
      {
        carId: "LEGACY-UNIT",
        toDivisionId: 2,
        requestDate: "2026-09-09",
        isPriority: false,
        panelName: "BODY DEPAN",
        jobDetail: "No name lookup",
        estimatedHours: null,
        notes: null,
        items: [],
      },
    );

    const createSql = statements.map(({ sql }) => sql).join("\n");
    expect(createSql.includes("WHERE name = ?")).toBe(false);
    expect(createSql.includes("WHERE panel_name = ?")).toBe(false);
  });
});
