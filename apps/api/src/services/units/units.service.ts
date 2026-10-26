import type { GridQueryState } from "@smsystem/contracts/grid";
import type {
  CreateUnitMediaFolderRequest,
  CreateUnitMediaRequest,
  CreateUnitRequest,
  UnitBoardRow,
  UnitMedia,
  UnitMediaFolder,
  UnitReferenceOption,
  UnitWorkspace,
  UpdateUnitMediaRequest,
  UpdateUnitMediaFolderRequest,
  UpdateUnitRequest,
  UnitClient,
  UnitClientUnit,
} from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type {
  CreateUnitPanelRequest,
  RenameUnitPanelCategoryRequest,
  UnitPanelCollection,
  UnitPanelDetail,
  UnitPanelGeneralCollection,
  UnitPanelRecord,
  UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
import { MySqlAuditRepository } from "@/repositories/audit/audit.repo";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import { UnitsRepository } from "@/repositories/units/units.repo";
import { DefaultAuditService, type AuditService } from "@/services/audit/audit.service";
import { sanitizeUnitGridQuery } from "@/services/units/query";

export interface UnitBoardListResult {
  data: UnitBoardRow[];
  meta: ReturnType<typeof buildGridMeta>;
  query: ReturnType<typeof sanitizeUnitGridQuery>;
}

export interface UnitsService {
  listUnits(session: WebSession, query: GridQueryState): Promise<UnitBoardListResult>;
  listUnitClients(session: WebSession, query: { search?: string; selected?: string }): Promise<{ clients: UnitClient[]; selectedClient: { name: string; units: UnitClientUnit[] } | null }>;
  getUnitSummary(session: WebSession, unitId: string): Promise<UnitBoardRow | null>;
  getUnitWorkspace(session: WebSession, unitId: string): Promise<UnitWorkspace | null>;
  getUnitBom(session: WebSession, unitId: string): Promise<UnitBomWorkspace | null>;
  createUnit(session: WebSession, input: CreateUnitRequest): Promise<UnitBoardRow>;
  updateUnit(session: WebSession, unitId: string, input: UpdateUnitRequest): Promise<UnitBoardRow>;
  deleteUnit(session: WebSession, unitId: string): Promise<{ deletedUnitId: string }>;
  getUnitReferences(session: WebSession): Promise<{ customers: UnitReferenceOption[]; kps: UnitReferenceOption[]; kds: UnitReferenceOption[]; qa: UnitReferenceOption | null }>;
  getUnitMedia(session: WebSession, unitId: string): Promise<{ folders: UnitMediaFolder[]; media: UnitMedia[] }>;
  createUnitMediaFolder(session: WebSession, unitId: string, input: CreateUnitMediaFolderRequest): Promise<UnitMediaFolder>;
  updateUnitMediaFolder(session: WebSession, unitId: string, folderId: string, input: UpdateUnitMediaFolderRequest): Promise<UnitMediaFolder>;
  deleteUnitMediaFolder(session: WebSession, unitId: string, folderId: string): Promise<void>;
  createUnitMedia(session: WebSession, unitId: string, input: CreateUnitMediaRequest): Promise<UnitMedia>;
  updateUnitMedia(session: WebSession, unitId: string, mediaId: string, input: UpdateUnitMediaRequest): Promise<UnitMedia>;
  deleteUnitMedia(session: WebSession, unitId: string, mediaId: string): Promise<void>;
  getUnitPanels(session: WebSession, unitId: string): Promise<UnitPanelCollection | null>;
  getUnitPanelDetail(session: WebSession, unitId: string, panelId: number): Promise<UnitPanelDetail | null>;
  getGeneralUnitPanels(session: WebSession, query?: { q?: string; nodeType?: "PANEL" | "PART"; limit?: number }): Promise<UnitPanelGeneralCollection>;
  createUnitPanel(session: WebSession, unitId: string, input: CreateUnitPanelRequest): Promise<UnitPanelRecord>;
  updateUnitPanel(session: WebSession, unitId: string, panelId: number, input: UpdateUnitPanelRequest): Promise<UnitPanelRecord>;
  renameUnitPanelCategory(session: WebSession, unitId: string, input: RenameUnitPanelCategoryRequest): Promise<{ updatedCount: number }>;
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

  async listUnitClients(session: WebSession, query: { search?: string; selected?: string }) {
    return this.repository.findUnitClients({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      search: query.search,
      selected: query.selected,
    });
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

  async getUnitReferences(_session: WebSession) {
    return this.repository.findUnitReferences();
  }

  private async assertUnitInScope(session: WebSession, unitId: string): Promise<void> {
    const unit = await this.repository.findUnitSummary({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
    if (!unit) throw new Error("SCOPE_FORBIDDEN");
  }

  async getUnitMedia(session: WebSession, unitId: string) {
    await this.assertUnitInScope(session, unitId);
    return this.repository.findUnitMedia(unitId);
  }

  async createUnitMediaFolder(session: WebSession, unitId: string, input: CreateUnitMediaFolderRequest) {
    await this.assertUnitInScope(session, unitId);
    const folder = await this.repository.createUnitMediaFolder({ carId: unitId, actorId: session.user.employeeId, input });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media_folder.create", module: "unit", recordId: folder.id, newValue: { unitId, folder } });
    return folder;
  }

  async updateUnitMediaFolder(session: WebSession, unitId: string, folderId: string, input: UpdateUnitMediaFolderRequest) {
    await this.assertUnitInScope(session, unitId);
    const folder = await this.repository.updateUnitMediaFolder({ carId: unitId, folderId, input });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media_folder.update", module: "unit", recordId: folderId, newValue: { unitId, folder } });
    return folder;
  }

  async deleteUnitMediaFolder(session: WebSession, unitId: string, folderId: string): Promise<void> {
    await this.assertUnitInScope(session, unitId);
    await this.repository.deleteUnitMediaFolder({ carId: unitId, folderId });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media_folder.delete", module: "unit", recordId: folderId, newValue: { unitId, deleted: true } });
  }

  async createUnitMedia(session: WebSession, unitId: string, input: CreateUnitMediaRequest) {
    await this.assertUnitInScope(session, unitId);
    const media = await this.repository.createUnitMedia({ carId: unitId, actorId: session.user.employeeId, input });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media.create", module: "unit", recordId: media.id, newValue: { unitId, media } });
    return media;
  }

  async updateUnitMedia(session: WebSession, unitId: string, mediaId: string, input: UpdateUnitMediaRequest) {
    await this.assertUnitInScope(session, unitId);
    const media = await this.repository.updateUnitMedia({ carId: unitId, mediaId, input });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media.update", module: "unit", recordId: mediaId, newValue: { unitId, media } });
    return media;
  }

  async deleteUnitMedia(session: WebSession, unitId: string, mediaId: string): Promise<void> {
    await this.assertUnitInScope(session, unitId);
    await this.repository.deleteUnitMedia({ carId: unitId, mediaId });
    await this.auditService.log({ actorId: session.user.employeeId, actorName: session.user.fullName, action: "unit_media.delete", module: "unit", recordId: mediaId, newValue: { unitId, deleted: true } });
  }

  async getUnitPanels(session: WebSession, unitId: string): Promise<UnitPanelCollection | null> {
    return this.repository.findUnitPanels({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
    });
  }

  async getUnitPanelDetail(session: WebSession, unitId: string, panelId: number): Promise<UnitPanelDetail | null> {
    return this.repository.findUnitPanelDetail({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
      panelId,
    });
  }

  async getGeneralUnitPanels(session: WebSession, query: { q?: string; nodeType?: "PANEL" | "PART"; limit?: number } = {}): Promise<UnitPanelGeneralCollection> {
    return this.repository.findGeneralUnitPanels({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      ...query,
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

    try {
      await this.repository.upsertWarehouseStockCardFromPanel({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        unitId,
        record,
      });
    } catch {
      // Warehouse sync is best-effort; master panel mutation remains authoritative.
    }

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

    try {
      await this.repository.upsertWarehouseStockCardFromPanel({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        unitId,
        record: result.after,
      });
    } catch {
      // Warehouse sync is best-effort; master panel mutation remains authoritative.
    }

    return result.after;
  }

  async renameUnitPanelCategory(
    session: WebSession,
    unitId: string,
    input: RenameUnitPanelCategoryRequest,
  ): Promise<{ updatedCount: number }> {
    const result = await this.repository.renameUnitPanelCategory({
      employeeId: session.user.employeeId,
      scope: session.user.scope,
      unitId,
      actorId: session.user.employeeId,
      fromCategory: input.fromCategory,
      toCategory: input.toCategory,
    });

    await this.auditService.log({
      actorId: session.user.employeeId,
      actorName: session.user.fullName,
      action: "unit_panel.category.rename",
      module: "unit_panel",
      recordId: unitId,
      oldValue: {
        unitId,
        category: input.fromCategory,
      },
      newValue: {
        unitId,
        category: input.toCategory,
        updatedCount: result.updatedCount,
      },
    });

    return result;
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

    try {
      await this.repository.markWarehouseStockCardLostForPanel({
        employeeId: session.user.employeeId,
        scope: session.user.scope,
        unitId,
        panelId,
      });
    } catch {
      // Warehouse sync is best-effort; master panel mutation remains authoritative.
    }

    return { deletedId: panelId };
  }

}
