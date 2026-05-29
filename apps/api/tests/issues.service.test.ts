import type { AuthUser } from "@smsystem/contracts/auth";
import { describe, expect, test } from "bun:test";
import { DefaultIssuesService } from "@/services/issues.service";
import type { AuditService } from "@/services/audit/audit.service";
import type { IssuesRepository } from "@/repositories/issues.repo";
import type { WebSession } from "@/services/auth/session.service";

const sampleUser: AuthUser = {
  employeeId: "SM-08.005",
  fullName: "Yudha Agustiana",
  email: null,
  roleId: 19,
  roleName: "kepala_produksi",
  divisionId: 12,
  divisionName: "INTERIOR",
  grade: "KP",
  permissions: ["QC_VIEW", "QC_SUBMIT", "QC_VALIDATE", "LIST_CAR_PROGRESS"],
  scope: {
    canViewAllUnits: false,
    canViewAssignedUnits: true,
    divisionIds: [12],
    managedDivisionIds: [12],
    unitIds: [],
  },
};

const sampleSession: WebSession = {
  sessionId: "issue-session-1",
  sessionKey: "session:issue-1",
  employeeId: sampleUser.employeeId,
  refreshToken: "refresh-1",
  mobileSessionKey: "session:SM-08.005",
  deviceId: "web-device-1",
  user: sampleUser,
  createdAt: "2026-05-14T00:00:00.000Z",
};

class InMemoryIssuesRepository implements IssuesRepository {
  records = new Map<string, {
    issueId: string;
    issueNumber: string;
    sourceType: "QC_REJECT" | "WORK_LEDGER" | "MANUAL";
    sourceRefId: string | null;
    carId: string;
    unitName: string;
    customerName: string | null;
    divisionId: number | null;
    divisionName: string | null;
    countdownId: string | null;
    planId: string | null;
    qcId: string | null;
    ledgerId: string | null;
    issueType: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    title: string;
    description: string;
    status: "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "QC_RECHECK" | "RESOLVED" | "ESCALATED" | "WAIVED";
    isUrgent: boolean;
    assignedTo: string | null;
    assignedToName: string | null;
    reportedBy: string | null;
    reportedByName: string | null;
    createdAt: string;
    updatedAt: string;
    resolutionNotes: string | null;
  }>();

  qcRejects = [
    {
      sourceRefId: "QC-1",
      carId: "CAR-1",
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      divisionId: 12,
      divisionName: "INTERIOR",
      countdownId: "CD-1",
      planId: "PLAN-1",
      qcId: "QC-1",
      issueType: "QC_REJECT",
      severity: "HIGH" as const,
      title: "QC reject dashboard",
      description: "Belang di panel dashboard",
    },
  ];

  async list() {
    return {
      rows: [...this.records.values()],
      total: this.records.size,
      summary: {
        openCount: [...this.records.values()].filter((row) => row.status !== "RESOLVED").length,
        urgentCount: [...this.records.values()].filter((row) => row.isUrgent).length,
        escalatedCount: [...this.records.values()].filter((row) => row.status === "ESCALATED").length,
      },
      storageReady: true,
    };
  }

  async listUrgent() {
    return [...this.records.values()].filter((row) => row.isUrgent);
  }

  async listReferences() {
    return {
      units: [],
      divisions: [],
      statuses: [],
      severities: [],
      employees: [],
    };
  }

  async findById(_params: { issueId: string }) {
    return this.records.get(_params.issueId) ?? null;
  }

  async create(_params: { actorId: string }, input: { carId: string; issueType: string; severity: "LOW" | "MEDIUM" | "HIGH"; title: string; description: string }) {
    const issueId = `ISSUE-${this.records.size + 1}`;
    this.records.set(issueId, {
      issueId,
      issueNumber: `ISS-20260514-00${this.records.size + 1}`,
      sourceType: "MANUAL",
      sourceRefId: null,
      carId: input.carId,
      unitName: "MB 500 SEL",
      customerName: "Mr. Silmy",
      divisionId: 12,
      divisionName: "INTERIOR",
      countdownId: null,
      planId: null,
      qcId: null,
      ledgerId: null,
      issueType: input.issueType,
      severity: input.severity,
      title: input.title,
      description: input.description,
      status: "OPEN",
      isUrgent: input.severity === "HIGH",
      assignedTo: null,
      assignedToName: null,
      reportedBy: sampleUser.employeeId,
      reportedByName: sampleUser.fullName,
      createdAt: "2026-05-14 10:00:00",
      updatedAt: "2026-05-14 10:00:00",
      resolutionNotes: null,
    });
    return { issueId };
  }

  async updateStatus(issueId: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "QC_RECHECK" | "RESOLVED" | "ESCALATED" | "WAIVED", input?: { resolutionNotes?: string | null }) {
    const row = this.records.get(issueId);
    if (!row) {
      throw new Error("ISSUE_NOT_FOUND");
    }
    this.records.set(issueId, {
      ...row,
      status,
      resolutionNotes: input?.resolutionNotes ?? row.resolutionNotes,
      updatedAt: "2026-05-14 12:00:00",
    });
  }

  async assign(issueId: string, input: { assignedTo: string; assignedToName: string | null }) {
    const row = this.records.get(issueId);
    if (!row) {
      throw new Error("ISSUE_NOT_FOUND");
    }
    this.records.set(issueId, {
      ...row,
      assignedTo: input.assignedTo,
      assignedToName: input.assignedToName,
      updatedAt: "2026-05-14 11:00:00",
    });
  }

  async listByUnit(_params: { carId: string }) {
    return [...this.records.values()];
  }

  async listAutoQcRejectSources() {
    return this.qcRejects;
  }

  async listAutoLedgerIssueSources() {
    return [];
  }

  async upsertAutoIssue(input: {
    sourceType: "QC_REJECT" | "WORK_LEDGER";
    sourceRefId: string;
    carId: string;
    unitName: string;
    customerName: string | null;
    divisionId: number | null;
    divisionName: string | null;
    countdownId: string | null;
    planId: string | null;
    qcId?: string | null;
    ledgerId?: string | null;
    issueType: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    title: string;
    description: string;
  }) {
    const existing = [...this.records.values()].find(
      (row) => row.sourceType === input.sourceType && row.sourceRefId === input.sourceRefId,
    );
    if (existing) {
      return existing.issueId;
    }
    const issueId = `AUTO-${this.records.size + 1}`;
    this.records.set(issueId, {
      issueId,
      issueNumber: `ISS-20260514-AUTO${this.records.size + 1}`,
      sourceType: input.sourceType,
      sourceRefId: input.sourceRefId,
      carId: input.carId,
      unitName: input.unitName,
      customerName: input.customerName,
      divisionId: input.divisionId,
      divisionName: input.divisionName,
      countdownId: input.countdownId,
      planId: input.planId,
      qcId: input.qcId ?? null,
      ledgerId: input.ledgerId ?? null,
      issueType: input.issueType,
      severity: input.severity,
      title: input.title,
      description: input.description,
      status: "OPEN",
      isUrgent: input.severity === "HIGH",
      assignedTo: null,
      assignedToName: null,
      reportedBy: null,
      reportedByName: null,
      createdAt: "2026-05-14 09:00:00",
      updatedAt: "2026-05-14 09:00:00",
      resolutionNotes: null,
    });
    return issueId;
  }
}

describe("DefaultIssuesService", () => {
  test("syncs QC reject into issue log only once", async () => {
    const repository = new InMemoryIssuesRepository();
    const service = new DefaultIssuesService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    const firstResult = await service.list(sampleSession, {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      view: null,
      filters: [],
    });
    const secondResult = await service.list(sampleSession, {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      view: null,
      filters: [],
    });

    expect(firstResult.data.length).toBe(1);
    expect(secondResult.data.length).toBe(1);
    expect(secondResult.data[0]?.sourceType).toBe("QC_REJECT");
  });

  test("resolves issue with resolution notes", async () => {
    const repository = new InMemoryIssuesRepository();
    const service = new DefaultIssuesService(
      repository,
      {
        async log() {
          return;
        },
      } satisfies AuditService,
    );

    await service.list(sampleSession, {
      page: 1,
      limit: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      view: null,
      filters: [],
    });

    const issueId = repository.records.keys().next().value as string;
    const result = await service.resolve(sampleSession, issueId, {
      resolutionNotes: "Rework selesai dan lolos pengecekan.",
    });

    expect(result.status).toBe("RESOLVED");
    expect(repository.records.get(issueId)?.resolutionNotes).toBe(
      "Rework selesai dan lolos pengecekan.",
    );
  });
});
