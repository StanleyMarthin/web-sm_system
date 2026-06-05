import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CreateUnitRequest,
  UnitBoardRow,
  UnitWorkspace,
  UpdateUnitRequest,
} from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type {
  CreateUnitPanelRequest,
  UnitPanelCollection,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
import { MySqlAuditRepository } from "@/repositories/audit.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import { UnitsRepository } from "@/repositories/units.repo";
import { DefaultAuditService, type AuditService } from "@/services/audit/audit.service";
import { sanitizeUnitGridQuery } from "@/services/units/query";

export interface UnitBoardListResult {
  data: UnitBoardRow[];
  meta: ReturnType<typeof buildGridMeta>;
  query: ReturnType<typeof sanitizeUnitGridQuery>;
}

export interface UnitsService {
  listUnits(session: WebSession, query: GridQueryState): Promise<UnitBoardListResult>;
  getUnitSummary(session: WebSession, unitId: string): Promise<UnitBoardRow | null>;
  getUnitWorkspace(session: WebSession, unitId: string): Promise<UnitWorkspace | null>;
  getUnitBom(session: WebSession, unitId: string): Promise<UnitBomWorkspace | null>;
  createUnit(session: WebSession, input: CreateUnitRequest): Promise<UnitBoardRow>;
  updateUnit(session: WebSession, unitId: string, input: UpdateUnitRequest): Promise<UnitBoardRow>;
  deleteUnit(session: WebSession, unitId: string): Promise<{ deletedUnitId: string }>;
  getUnitPanels(session: WebSession, unitId: string): Promise<UnitPanelCollection | null>;
  createUnitPanel(session: WebSession, unitId: string, input: CreateUnitPanelRequest): Promise<UnitPanelRecord>;
  updateUnitPanel(session: WebSession, unitId: string, panelId: number, input: UpdateUnitPanelRequest): Promise<UnitPanelRecord>;
  deleteUnitPanel(session: WebSession, unitId: string, panelId: number): Promise<{ deletedId: number }>;
}

export class DefaultUnitsService implements UnitsService {
  constructor(
    private readonly repository: UnitsRepository = new UnitsRepository(),
    private readonly auditService: AuditService = new DefaultAuditService(
      new MySqlAuditRepository(),
    ),
  ) {}

  async listUnits(session: WebSession, query: GridQueryState): Promise<UnitBoardListResult> {
    const normalized = sanitizeUnitGridQuery(query);
    const payload = await this.repository.findUnitBoard({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      query: normalized,
    });

    return {
      data: payload.rows,
      meta: buildGridMeta(payload.total, normalized.page, normalized.limit),
      query: normalized,
    };
  }

  async getUnitSummary(session: WebSession, unitId: string): Promise<UnitBoardRow | null> {
    return this.repository.findUnitSummary({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  async getUnitWorkspace(session: WebSession, unitId: string): Promise<UnitWorkspace | null> {
    return this.repository.findUnitWorkspace({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  async getUnitBom(session: WebSession, unitId: string): Promise<UnitBomWorkspace | null> {
    return this.repository.findUnitBom({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  async createUnit(session: WebSession, input: CreateUnitRequest): Promise<UnitBoardRow> {
    const unit = await this.repository.createUnit({
      actorId: session.user.employeeId,
      input,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit.create",
      module: "unit",
      recordId: unit.unitId,
      newValue: unit,
    });

    return unit;
  }

  async updateUnit(
    session: WebSession,
    unitId: string,
    input: UpdateUnitRequest,
  ): Promise<UnitBoardRow> {
    const result = await this.repository.updateUnit({
      actorId: session.user.employeeId,
      unitId,
      input,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit.update",
      module: "unit",
      recordId: unitId,
      oldValue: result.before,
      newValue: result.after,
    });

    return result.after;
  }

  async deleteUnit(session: WebSession, unitId: string): Promise<{ deletedUnitId: string }> {
    const deleted = await this.repository.deleteUnit({
      actorId: session.user.employeeId,
      unitId,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit.delete",
      module: "unit",
      recordId: unitId,
      oldValue: deleted,
      newValue: { deletedUnitId: unitId },
    });

    return { deletedUnitId: unitId };
  }

  async getUnitPanels(session: WebSession, unitId: string): Promise<UnitPanelCollection | null> {
    return this.repository.findUnitPanels({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  async createUnitPanel(
    session: WebSession,
    unitId: string,
    input: CreateUnitPanelRequest,
  ): Promise<UnitPanelRecord> {
    const record = await this.repository.createUnitPanel({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
      actorId: session.user.employeeId,
      input,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit_panel.create",
      module: "unit_panel",
      recordId: String(record.id),
      newValue: {
        unitId,
        record,
      },
    });

    return record;
  }

  async updateUnitPanel(
    session: WebSession,
    unitId: string,
    panelId: number,
    input: UpdateUnitPanelRequest,
  ): Promise<UnitPanelRecord> {
    const result = await this.repository.updateUnitPanel({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
      panelId,
      actorId: session.user.employeeId,
      input,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit_panel.update",
      module: "unit_panel",
      recordId: String(panelId),
      oldValue: result.before,
      newValue: result.after,
    });

    return result.after;
  }

  async deleteUnitPanel(
    session: WebSession,
    unitId: string,
    panelId: number,
  ): Promise<{ deletedId: number }> {
    const deleted = await this.repository.deleteUnitPanel({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
      panelId,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit_panel.delete",
      module: "unit_panel",
      recordId: String(panelId),
      oldValue: deleted,
      newValue: {
        deletedId: panelId,
        unitId,
      },
    });

    return { deletedId: panelId };
  }
}
