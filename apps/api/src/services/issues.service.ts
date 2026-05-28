import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  IssueAssignRequest,
  IssueCreateRequest,
  IssueEscalateRequest,
  IssueQuery,
  IssueRecord,
  IssueResolveRequest,
  IssueStatus,
  IssueWaiveRequest,
} from "@smsystem/contracts/issue";
import { buildGridMeta } from "@/services/grid/paginate";
import type { AuditService } from "@/services/audit/audit.service";
import { DefaultAuditService } from "@/services/audit/audit.service";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import {
  MySqlIssuesRepository,
  type IssuesRepository,
} from "@/repositories/issues.repo";
import type { WebSession } from "@/services/auth/session.service";
import { applyDefaultDivisionIdFilter } from "@/services/grid/division-default";
import { TtlCache } from "@/lib/ttl-cache";

interface IssueListResult {
  data: IssueRecord[];
  storageReady: boolean;
  meta: ReturnType<typeof buildGridMeta>;
  query: IssueQuery;
  references: Awaited<ReturnType<IssuesRepository["listReferences"]>>;
  summary: Awaited<ReturnType<IssuesRepository["list"]>>["summary"];
}

interface IssueDetailResult {
  issue: IssueRecord;
}

interface IssueMutationResult {
  issueId: string;
  status: IssueStatus;
}

function sanitizeIssueQuery(query: GridQueryState): IssueQuery {
  const allowedSorts = new Set(["createdAt", "updatedAt", "unitName", "status", "severity"]);
  const allowedFilters = new Set(["status", "severity", "divisionId", "carId"]);

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sortBy: allowedSorts.has(query.sortBy) ? query.sortBy : "createdAt",
    sortDirection: query.sortDirection,
    view: query.view,
    filters: query.filters.filter((filter) => allowedFilters.has(filter.field)),
  };
}

function ensureTransition(
  currentStatus: IssueStatus,
  allowedFrom: IssueStatus[],
): void {
  if (!allowedFrom.includes(currentStatus)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }
}

export interface IssuesService {
  list(session: WebSession, query: GridQueryState): Promise<IssueListResult>;
  listUrgent(session: WebSession): Promise<IssueRecord[]>;
  findDetail(session: WebSession, issueId: string): Promise<IssueDetailResult | null>;
  create(session: WebSession, input: IssueCreateRequest): Promise<IssueMutationResult>;
  acknowledge(session: WebSession, issueId: string): Promise<IssueMutationResult>;
  assign(session: WebSession, issueId: string, input: IssueAssignRequest): Promise<IssueMutationResult>;
  start(session: WebSession, issueId: string): Promise<IssueMutationResult>;
  markQcRecheck(session: WebSession, issueId: string): Promise<IssueMutationResult>;
  resolve(session: WebSession, issueId: string, input: IssueResolveRequest): Promise<IssueMutationResult>;
  escalate(session: WebSession, issueId: string, input: IssueEscalateRequest): Promise<IssueMutationResult>;
  waive(session: WebSession, issueId: string, input: IssueWaiveRequest): Promise<IssueMutationResult>;
  listByUnit(session: WebSession, carId: string): Promise<IssueRecord[]>;
}

const ISSUE_AUTO_SYNC_TTL_MS = 60_000;
const issueAutoSyncCache = new TtlCache<void>(ISSUE_AUTO_SYNC_TTL_MS);

export class DefaultIssuesService implements IssuesService {
  constructor(
    private readonly repository: IssuesRepository = new MySqlIssuesRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async list(session: WebSession, query: GridQueryState): Promise<IssueListResult> {
    await this.syncAutoSources();
    const normalized = applyDefaultDivisionIdFilter(
      session,
      sanitizeIssueQuery(query),
    );
    const [payload, references] = await Promise.all([
      this.repository.list({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        query: normalized,
      }),
      this.repository.listReferences({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
      }),
    ]);

    return {
      data: payload.rows,
      storageReady: payload.storageReady,
      meta: buildGridMeta(payload.total, normalized.page, normalized.limit),
      query: normalized,
      references,
      summary: payload.summary,
    };
  }

  async listUrgent(session: WebSession): Promise<IssueRecord[]> {
    await this.syncAutoSources();
    return this.repository.listUrgent({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
    });
  }

  async findDetail(
    session: WebSession,
    issueId: string,
  ): Promise<IssueDetailResult | null> {
    await this.syncAutoSources();
    const issue = await this.repository.findById({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      issueId,
    });
    return issue ? { issue } : null;
  }

  async create(
    session: WebSession,
    input: IssueCreateRequest,
  ): Promise<IssueMutationResult> {
    const result = await this.repository.create(
      {
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
      },
      {
        ...input,
        divisionId: input.divisionId ?? session.user.divisionId ?? null,
      },
    );

    const created = await this.repository.list({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: sanitizeIssueQuery({
        page: 1,
        limit: 1,
        search: "",
        sortBy: "createdAt",
        sortDirection: "desc",
        view: null,
        filters: [],
      }),
    });
    const issueId = created.rows[0]?.issueId ?? result.issueId;

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "issues.create",
      module: "issues",
      recordId: issueId,
      newValue: input,
    });

    return {
      issueId,
      status: "OPEN",
    };
  }

  async acknowledge(
    session: WebSession,
    issueId: string,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["OPEN"]);
    await this.repository.updateStatus(issueId, "ACKNOWLEDGED", {
      actorId: session.user.employeeId,
    });
    return {
      issueId,
      status: "ACKNOWLEDGED",
    };
  }

  async assign(
    session: WebSession,
    issueId: string,
    input: IssueAssignRequest,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["OPEN", "ACKNOWLEDGED", "ESCALATED"]);
    await this.repository.assign(issueId, {
      assignedTo: input.assignedTo,
      assignedToName: input.assignedToName ?? null,
    });
    const nextStatus = detail.issue.status === "OPEN" ? "ACKNOWLEDGED" : detail.issue.status;
    if (detail.issue.status === "OPEN") {
      await this.repository.updateStatus(issueId, "ACKNOWLEDGED", {
        actorId: session.user.employeeId,
      });
    }

    return {
      issueId,
      status: nextStatus,
    };
  }

  async start(session: WebSession, issueId: string): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["OPEN", "ACKNOWLEDGED", "ESCALATED"]);
    await this.repository.updateStatus(issueId, "IN_PROGRESS", {
      actorId: session.user.employeeId,
    });
    return {
      issueId,
      status: "IN_PROGRESS",
    };
  }

  async markQcRecheck(
    session: WebSession,
    issueId: string,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["IN_PROGRESS", "RESOLVED"]);
    await this.repository.updateStatus(issueId, "QC_RECHECK", {
      actorId: session.user.employeeId,
    });
    return {
      issueId,
      status: "QC_RECHECK",
    };
  }

  async resolve(
    session: WebSession,
    issueId: string,
    input: IssueResolveRequest,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, [
      "OPEN",
      "ACKNOWLEDGED",
      "IN_PROGRESS",
      "QC_RECHECK",
      "ESCALATED",
    ]);
    await this.repository.updateStatus(issueId, "RESOLVED", {
      actorId: session.user.employeeId,
      resolutionNotes: input.resolutionNotes,
    });
    return {
      issueId,
      status: "RESOLVED",
    };
  }

  async escalate(
    session: WebSession,
    issueId: string,
    input: IssueEscalateRequest,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["OPEN", "ACKNOWLEDGED"]);
    await this.repository.updateStatus(issueId, "ESCALATED", {
      actorId: session.user.employeeId,
      note: input.note,
    });
    return {
      issueId,
      status: "ESCALATED",
    };
  }

  async waive(
    session: WebSession,
    issueId: string,
    input: IssueWaiveRequest,
  ): Promise<IssueMutationResult> {
    const detail = await this.requireIssue(session, issueId);
    ensureTransition(detail.issue.status, ["OPEN"]);
    await this.repository.updateStatus(issueId, "WAIVED", {
      actorId: session.user.employeeId,
      note: input.note,
    });
    return {
      issueId,
      status: "WAIVED",
    };
  }

  async listByUnit(session: WebSession, carId: string): Promise<IssueRecord[]> {
    await this.syncAutoSources();
    return this.repository.listByUnit({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      carId,
    });
  }

  private async requireIssue(
    session: WebSession,
    issueId: string,
  ): Promise<IssueDetailResult> {
    const detail = await this.findDetail(session, issueId);
    if (!detail) {
      throw new Error("ISSUE_NOT_FOUND");
    }
    return detail;
  }

  private async syncAutoSources(): Promise<void> {
    await issueAutoSyncCache.getOrCreate("issues:auto-sync", async () => {
      const [qcRejects, ledgerIssues] = await Promise.all([
        this.repository.listAutoQcRejectSources(),
        this.repository.listAutoLedgerIssueSources(),
      ]);

      await Promise.all([
        ...qcRejects.map((row) =>
          this.repository.upsertAutoIssue({
            ...row,
            sourceType: "QC_REJECT",
          }),
        ),
        ...ledgerIssues.map((row) =>
          this.repository.upsertAutoIssue({
            ...row,
            sourceType: "WORK_LEDGER",
          }),
        ),
      ]);
    });
  }
}
