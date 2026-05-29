import type { GridQueryState } from "@smsystem/contracts/grid";
import type { UnitBoardRow, UnitWorkspace } from "@smsystem/contracts/unit";
import type { UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { WebSession } from "@/services/auth/session.service";
import { buildGridMeta } from "@/services/grid/paginate";
import { UnitsRepository } from "@/repositories/units.repo";
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
}

export class DefaultUnitsService implements UnitsService {
  constructor(
    private readonly repository: UnitsRepository = new UnitsRepository(),
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
}
