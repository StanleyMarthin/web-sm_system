import type {
  CatalogMediaRequest,
  CatalogReferenceMediaRequest,
  CreatePanelJobdescsRequest,
  SaveCatalogWorkspaceRequest,
  UpdateCatalogSurveyRequest,
  UpsertCatalogReferenceRequest,
} from "@smsystem/contracts/unit-catalog";
import { permissionCodes } from "@smsystem/permissions";
import { UnitCatalogRepository } from "@/repositories/unit-catalog.repo";
import { UnitsRepository } from "@/repositories/units.repo";
import type { WebSession } from "@/services/auth/session.service";

export class UnitCatalogService {
  constructor(
    private readonly repository: UnitCatalogRepository = new UnitCatalogRepository(),
    private readonly unitsRepository: UnitsRepository = new UnitsRepository(),
  ) {}

  private async assertUnitAccess(session: WebSession, unitId: string) {
    const canSurveyCatalog =
      session.user.permissions.includes(permissionCodes.unitCatalogSurvey) ||
      session.user.permissions.includes(permissionCodes.unitCatalogManage);
    const unit = await this.unitsRepository.findUnitSummary({
      employeeId: session.user.employeeId,
      scope: canSurveyCatalog
        ? { ...session.user.scope, canViewAllUnits: true, canViewAssignedUnits: true }
        : session.user.scope,
      unitId,
    });
    if (!unit) throw new Error("UNIT_NOT_FOUND");
  }

  async getOverview(session: WebSession, unitId: string) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.listOverview(unitId);
  }

  async searchCatalog(session: WebSession, unitId: string, query: string, filters?: { componentId?: number | null; panelId?: number | null; limit?: number; offset?: number }) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.searchCatalog(unitId, query, filters);
  }

  async createReference(session: WebSession, unitId: string, input: UpsertCatalogReferenceRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.createReference(unitId, session.user.employeeId, input);
  }

  async getReference(session: WebSession, unitId: string, referenceId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.getReference(unitId, referenceId);
  }

  async getPanelWorkspace(session: WebSession, unitId: string, panelId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.getPanelWorkspace(unitId, panelId);
  }

  async savePanelWorkspace(session: WebSession, unitId: string, panelId: number, input: SaveCatalogWorkspaceRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.savePanelWorkspace(unitId, panelId, session.user.employeeId, input);
  }

  async addReferenceMedia(session: WebSession, unitId: string, referenceId: number, input: CatalogReferenceMediaRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.addReferenceMedia(unitId, referenceId, session.user.employeeId, input);
  }

  async getItem(session: WebSession, unitId: string, itemId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.getItem(unitId, itemId);
  }

  async updateSurvey(session: WebSession, unitId: string, itemId: number, input: UpdateCatalogSurveyRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.updateSurvey(unitId, itemId, session.user.employeeId, input);
  }

  async confirmSurvey(session: WebSession, unitId: string, itemId: number, input: UpdateCatalogSurveyRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.confirmSurvey(unitId, itemId, session.user.employeeId, input);
  }

  async addMedia(session: WebSession, unitId: string, itemId: number, input: CatalogMediaRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.addMedia(unitId, itemId, session.user.employeeId, input);
  }

  async deleteMedia(session: WebSession, unitId: string, itemId: number, mediaId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.deleteMedia(unitId, itemId, mediaId);
  }

  async promoteItem(session: WebSession, unitId: string, itemId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.promoteItem(unitId, itemId, session.user.employeeId);
  }

  async getPanel(session: WebSession, unitId: string, panelId: number) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.getPanel(unitId, panelId);
  }

  async listPanelJobdescs(session: WebSession, unitId: string, panelId: number) {
    await this.assertUnitAccess(session, unitId);
    if (!(await this.repository.getPanel(unitId, panelId))) throw new Error("UNIT_PANEL_NOT_FOUND");
    return this.repository.listPanelJobdescs(panelId);
  }

  async createPanelJobdescs(session: WebSession, unitId: string, panelId: number, input: CreatePanelJobdescsRequest) {
    await this.assertUnitAccess(session, unitId);
    return this.repository.createPanelJobdescs(unitId, panelId, input);
  }
}
