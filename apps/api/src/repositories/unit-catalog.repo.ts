import { randomUUID } from "node:crypto";
import type {
  CatalogComponent,
  CatalogItem,
  CatalogMediaRequest,
  CatalogOverview,
  CatalogPanel,
  CatalogPanelImageRequest,
  CatalogSearchItem,
  CatalogWorkspace,
  CatalogWorkspaceItem,
  CatalogWorkspaceItemInput,
  CreateAdditionalCatalogItemRequest,
  CreatePanelJobdescsRequest,
  OpenCatalogPanelRequest,
  SaveCatalogWorkspaceRequest,
  UpdateCatalogSurveyRequest,
} from "@smsystem/contracts/unit-catalog";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";

type Queryable = Pool | PoolConnection;

interface ComponentRow extends RowDataPacket {
  id: number;
  code: CatalogComponent["code"];
  componentName: string;
}

interface PanelRow extends RowDataPacket {
  id: number;
  componentId: number;
  componentCode: CatalogComponent["code"];
  componentName: string;
  panelName: string;
}

interface PanelSummaryRow extends PanelRow {
  itemCount: number | string | null;
  restorationCount: number | string | null;
  updatedAt: string | null;
}

interface WorkspaceItemRow extends RowDataPacket {
  id: number;
  code: string | null;
  partNumber: string | null;
  itemName: string | null;
  position: string | null;
  qtyNormal: number | string | null;
  isRestoration: number | boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AdditionalItemRow extends RowDataPacket {
  id: number;
  carId: string;
  componentName: string | null;
  panelName: string | null;
  itemName: string;
  partNumber: string | null;
  deskription: string | null;
}

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizePanelName(value: string) {
  return normalizeSpaces(value).toUpperCase();
}

function isEmptyCatalogRow(row: {
  code: string | null;
  partNumber: string | null;
  itemName: string | null;
  position: string | null;
  qtyNormal: number | null;
  isRestoration: boolean;
}) {
  return !row.code && !row.partNumber && !row.itemName && !row.position && row.qtyNormal == null && !row.isRestoration;
}

function mapComponent(row: ComponentRow): CatalogComponent {
  return {
    id: Number(row.id),
    code: row.code,
    componentName: row.componentName,
  };
}

function mapPanel(row: PanelRow): CatalogPanel {
  return {
    id: Number(row.id),
    componentId: Number(row.componentId),
    componentCode: row.componentCode,
    componentName: row.componentName,
    panelName: row.panelName,
  };
}

function mapWorkspaceItem(row: WorkspaceItemRow): CatalogWorkspaceItem {
  return {
    id: Number(row.id),
    clientRowId: null,
    code: row.code ?? null,
    partNumber: row.partNumber ?? null,
    itemName: row.itemName ?? null,
    position: row.position ?? null,
    qtyNormal: num(row.qtyNormal),
    isRestoration: row.isRestoration === true || row.isRestoration === 1,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

function buildBooleanSearch(query: string) {
  return query
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => `+${term.replace(/[^\p{L}\p{N}\-_]/gu, "")}*`)
    .filter((term) => term.length > 2)
    .join(" ");
}

function resolveRestorationSelection(input: UpdateCatalogSurveyRequest, fallback = false) {
  if (typeof input.isRestoration === "boolean") return input.isRestoration;
  return input.actionType === "JOBDESC" || input.actionType === "JOBDESC_ORDER" || fallback;
}

export class UnitCatalogRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pool = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async listComponents(): Promise<CatalogComponent[]> {
    const [rows] = await this.poolFactory(this.env).query<ComponentRow[]>(
      `
        SELECT id, code, component_name AS componentName
        FROM catalog_components
        ORDER BY id ASC
      `,
    );
    return rows.map(mapComponent);
  }

  async listPanelsByComponent(componentId: number): Promise<CatalogPanel[]> {
    const [rows] = await this.poolFactory(this.env).query<PanelRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        WHERE p.component_id = ?
        ORDER BY p.panel_name ASC
      `,
      [componentId],
    );
    return rows.map(mapPanel);
  }

  async listOverview(unitId: string): Promise<CatalogOverview> {
    const componentRows = await this.listComponents();
    const [panelRows] = await this.poolFactory(this.env).query<PanelSummaryRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName,
          COUNT(uc.id) AS itemCount,
          SUM(CASE WHEN COALESCE(uc.is_restoration, 0) = 1 THEN 1 ELSE 0 END) AS restorationCount,
          DATE_FORMAT(MAX(uc.updated_at), '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        LEFT JOIN unit_catalog uc ON uc.panel_id = p.id AND uc.car_id = ?
        GROUP BY p.id, p.component_id, c.code, c.component_name, p.panel_name
        ORDER BY c.id ASC, p.panel_name ASC
      `,
      [unitId],
    );

    return {
      components: componentRows,
      panels: panelRows.map((row) => ({
        ...mapPanel(row),
        itemCount: Number(row.itemCount ?? 0),
        restorationCount: Number(row.restorationCount ?? 0),
        updatedAt: row.updatedAt ?? null,
      })),
    };
  }

  async listReferences(unitId: string) {
    const overview = await this.listOverview(unitId);
    return overview.panels.filter((panel) => panel.itemCount > 0);
  }

  async openPanel(unitId: string, _actorId: string, input: OpenCatalogPanelRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const panel = await this.ensurePanelByName(connection, input.componentCode, input.panelName);
      await connection.commit();
      return this.getPanelWorkspace(unitId, panel.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getPanelWorkspace(unitId: string, panelId: number): Promise<CatalogWorkspace | null> {
    const panel = await this.getCatalogPanel(panelId);
    if (!panel) return null;
    const [itemRows, panelImages] = await Promise.all([
      this.listWorkspaceItems(unitId, panelId),
      this.listPanelImages(panelId),
    ]);
    return {
      carId: unitId,
      panel,
      panelImages,
      items: itemRows,
    };
  }

  async savePanelWorkspace(unitId: string, panelId: number, _actorId: string, input: SaveCatalogWorkspaceRequest): Promise<CatalogWorkspace> {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const panel = await this.getCatalogPanel(panelId, connection);
      if (!panel) throw new Error("CATALOG_PANEL_NOT_FOUND");

      const normalizedItems = input.items
        .map((item) => this.normalizeItemInput(item))
        .filter((item) => !isEmptyCatalogRow(item));

      if (input.deletedItemIds.length > 0) {
        await connection.execute(
          `
            DELETE FROM unit_catalog
            WHERE car_id = ?
              AND panel_id = ?
              AND id IN (${input.deletedItemIds.map(() => "?").join(",")})
          `,
          [unitId, panelId, ...input.deletedItemIds],
        );
      }

      for (const item of normalizedItems) {
        if (item.id) {
          await connection.execute(
            `
              UPDATE unit_catalog
              SET code = ?, part_number = ?, item_name = ?, position = ?, qty_normal = ?, is_restoration = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND car_id = ? AND panel_id = ?
            `,
            [
              item.code,
              item.partNumber,
              item.itemName,
              item.position,
              item.qtyNormal,
              item.isRestoration ? 1 : 0,
              item.id,
              unitId,
              panelId,
            ],
          );
        } else {
          await connection.execute(
            `
              INSERT INTO unit_catalog (
                car_id, panel_id, code, part_number, item_name, position, qty_normal, is_restoration
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              unitId,
              panelId,
              item.code,
              item.partNumber,
              item.itemName,
              item.position,
              item.qtyNormal,
              item.isRestoration ? 1 : 0,
            ],
          );
        }
      }

      if (input.deletedPanelImageIds.length > 0) {
        await connection.execute(
          `
            DELETE FROM catalog_panel_images
            WHERE panel_id = ?
              AND id IN (${input.deletedPanelImageIds.map(() => "?").join(",")})
          `,
          [panelId, ...input.deletedPanelImageIds],
        );
      }

      for (const image of input.panelImages) {
        if (image.id) {
          await connection.execute(
            `
              UPDATE catalog_panel_images
              SET url_image = ?, caption = ?, sort_order = ?
              WHERE id = ? AND panel_id = ?
            `,
            [image.fileUrl, image.caption, image.sortOrder, image.id, panelId],
          );
        } else {
          await connection.execute(
            `
              INSERT INTO catalog_panel_images (
                panel_id, url_image, caption, sort_order
              ) VALUES (?, ?, ?, ?)
            `,
            [panelId, image.fileUrl, image.caption, image.sortOrder],
          );
        }
      }

      await connection.commit();
      const workspace = await this.getPanelWorkspace(unitId, panelId);
      if (!workspace) throw new Error("CATALOG_PANEL_NOT_FOUND");
      return workspace;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async searchCatalog(unitId: string, query: string, filters?: { componentId?: number | null; panelId?: number | null; limit?: number; offset?: number }) {
    const trimmed = query.trim();
    if (!trimmed) return [] as CatalogSearchItem[];

    const clauses = ["uc.car_id = ?"];
    const params: unknown[] = [unitId];
    if (filters?.componentId) {
      clauses.push("c.id = ?");
      params.push(filters.componentId);
    }
    if (filters?.panelId) {
      clauses.push("p.id = ?");
      params.push(filters.panelId);
    }

    const searchClauses = [];
    const booleanQuery = buildBooleanSearch(trimmed);
    if (booleanQuery) {
      searchClauses.push("MATCH(uc.item_name, uc.part_number, uc.code) AGAINST (? IN BOOLEAN MODE)");
      params.push(booleanQuery);
    }
    const prefixQuery = `${trimmed.replace(/\s+/gu, "")}%`;
    searchClauses.push("uc.part_number LIKE ?");
    params.push(prefixQuery);
    searchClauses.push("uc.code LIKE ?");
    params.push(prefixQuery);

    const limit = Math.min(Math.max(filters?.limit ?? 25, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);
    params.push(limit, offset);

    const [rows] = await this.poolFactory(this.env).query<Array<RowDataPacket & {
      itemId: number;
      carId: string;
      componentId: number;
      componentCode: CatalogComponent["code"];
      componentName: string;
      panelId: number;
      panelName: string;
      code: string | null;
      partNumber: string | null;
      itemName: string | null;
      position: string | null;
      qtyNormal: number | string | null;
      isRestoration: number | boolean | null;
    }>>(
      `
        SELECT
          uc.id AS itemId,
          uc.car_id AS carId,
          c.id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.id AS panelId,
          p.panel_name AS panelName,
          uc.code,
          uc.part_number AS partNumber,
          uc.item_name AS itemName,
          uc.position AS position,
          uc.qty_normal AS qtyNormal,
          uc.is_restoration AS isRestoration
        FROM unit_catalog uc
        JOIN catalog_panels p ON p.id = uc.panel_id
        JOIN catalog_components c ON c.id = p.component_id
        WHERE ${clauses.join(" AND ")}
          AND (${searchClauses.join(" OR ")})
        ORDER BY p.panel_name ASC, uc.id ASC
        LIMIT ? OFFSET ?
      `,
      params,
    );

    return rows.map((row) => ({
      itemId: Number(row.itemId),
      carId: row.carId,
      componentId: Number(row.componentId),
      componentCode: row.componentCode,
      componentName: row.componentName,
      panelId: Number(row.panelId),
      panelName: row.panelName,
      code: row.code ?? null,
      partNumber: row.partNumber ?? null,
      itemName: row.itemName ?? null,
      position: row.position ?? null,
      qtyNormal: num(row.qtyNormal),
      isRestoration: row.isRestoration === true || row.isRestoration === 1,
    }));
  }

  async addPanelImage(unitId: string, panelId: number, _actorId: string, input: CatalogPanelImageRequest) {
    if (!(await this.getPanelWorkspace(unitId, panelId))) throw new Error("CATALOG_PANEL_NOT_FOUND");
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO catalog_panel_images (
          panel_id, url_image, caption, sort_order
        ) VALUES (?, ?, ?, ?)
      `,
      [panelId, input.fileUrl, input.caption, input.sortOrder],
    );
    return { id: Number(result.insertId), fileUrl: input.fileUrl };
  }

  async createAdditionalItem(unitId: string, actorId: string, input: CreateAdditionalCatalogItemRequest) {
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO unit_additional_items (
          car_id, component_name, panel_name, item_name, part_number, deskription, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        unitId,
        input.componentName ? normalizeSpaces(input.componentName) : null,
        input.panelName ? normalizeSpaces(input.panelName) : null,
        normalizeSpaces(input.itemName),
        input.partNumber ? normalizeSpaces(input.partNumber) : null,
        input.deskription ? input.deskription.trim() : null,
        actorId,
      ],
    );
    return this.getAdditionalItem(unitId, Number(result.insertId));
  }

  async promoteAdditionalItem(unitId: string, itemId: number, actorId: string) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
        "SELECT id FROM master_panels WHERE car_id = ? AND source_part = 'ADDITIONAL' AND part_id = ? LIMIT 1 FOR UPDATE",
        [unitId, itemId],
      );
      if (existingRows[0]?.id) {
        await connection.commit();
        return { panelId: Number(existingRows[0].id), alreadyPromoted: true };
      }

      const item = await this.getAdditionalItem(unitId, itemId, connection);
      if (!item) throw new Error("ADDITIONAL_ITEM_NOT_FOUND");
      const classification = await this.resolveAdditionalClassification(item, connection);
      const componentName = classification?.componentName ?? item.componentName ?? null;
      const panelName = classification?.panelName ?? item.panelName ?? null;

      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO master_panels (
            car_id, part_id, source_part, component_id, panel_id, component_name, panel_name,
            name_part, alias_name, part_number, qty, initial_condition, current_status, location, notes,
            created_at, created_by, updated_at, updated_by
          ) VALUES (?, ?, 'ADDITIONAL', ?, ?, ?, ?, ?, NULL, ?, 1, 'UNKNOWN', 'UNKNOWN', 'UNIT', ?, NOW(), ?, NOW(), ?)
        `,
        [
          unitId,
          itemId,
          classification?.componentId ?? null,
          classification?.panelId ?? null,
          componentName,
          panelName,
          item.itemName,
          item.partNumber,
          item.deskription,
          actorId,
          actorId,
        ],
      );
      const panelId = Number(result.insertId);
      await this.refreshPanelStatus(connection, unitId, panelId);
      await connection.commit();
      return { panelId, alreadyPromoted: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getItem(unitId: string, itemId: number, db: Queryable = this.poolFactory(this.env)): Promise<CatalogItem | null> {
    const [rows] = await db.query<Array<WorkspaceItemRow & RowDataPacket & { promotedPanelId: number | null }>>(
      `
        SELECT
          uc.id,
          uc.code,
          uc.part_number AS partNumber,
          uc.item_name AS itemName,
          uc.position AS position,
          uc.qty_normal AS qtyNormal,
          uc.is_restoration AS isRestoration,
          DATE_FORMAT(uc.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(uc.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
          (
            SELECT mp.id
            FROM master_panels mp
            WHERE mp.car_id = uc.car_id
              AND mp.source_part = 'CATALOG'
              AND mp.part_id = uc.id
            ORDER BY mp.id DESC
            LIMIT 1
          ) AS promotedPanelId
        FROM unit_catalog uc
        WHERE uc.id = ? AND uc.car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    const row = rows[0];
    if (!row) return null;

    const promotedPanelId = row.promotedPanelId == null ? null : Number(row.promotedPanelId);
    const mediaRows = promotedPanelId ? await this.listMasterPanelImages(promotedPanelId, db) : [];
    return {
      ...mapWorkspaceItem(row),
      id: Number(row.id),
      promotedPanelId,
      media: mediaRows.map((image) => ({
        id: image.id,
        panelId: promotedPanelId ?? 0,
        fileUrl: image.fileUrl,
        caption: image.caption,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt,
      })),
      mappings: [],
    };
  }

  async updateSurvey(unitId: string, itemId: number, _actorId: string, input: UpdateCatalogSurveyRequest) {
    const item = await this.getItem(unitId, itemId);
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    await this.poolFactory(this.env).execute(
      "UPDATE unit_catalog SET is_restoration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND car_id = ?",
      [resolveRestorationSelection(input, item.isRestoration) ? 1 : 0, itemId, unitId],
    );
    const refreshed = await this.getItem(unitId, itemId);
    if (!refreshed) throw new Error("CATALOG_ITEM_NOT_FOUND");
    return refreshed;
  }

  async confirmSurvey(unitId: string, itemId: number, actorId: string, input: UpdateCatalogSurveyRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const shouldRestore = await this.saveSurveyWithConnection(connection, unitId, itemId, input);
      if (!shouldRestore) throw new Error("SURVEY_NOT_CONFIRMED");
      const promoted = await this.materializeItemWithConnection(connection, unitId, itemId, actorId, input);
      const item = await this.getItem(unitId, itemId, connection);
      if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
      await connection.commit();
      return { item, panelId: promoted.panelId, alreadyPromoted: promoted.alreadyPromoted };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addMedia(unitId: string, itemId: number, _actorId: string, input: CatalogMediaRequest) {
    const item = await this.getItem(unitId, itemId);
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    if (!item.promotedPanelId) throw new Error("CATALOG_ITEM_MEDIA_REQUIRES_MASTER_PANEL");
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO masterpanel_images (
          part_id, url_image, caption, sort_order
        ) VALUES (
          ?, ?, ?, (
            SELECT COALESCE(MAX(sort_order), -1) + 1
            FROM masterpanel_images existing
            WHERE existing.part_id = ?
          )
        )
      `,
      [item.promotedPanelId, input.fileUrl, input.caption, item.promotedPanelId],
    );
    return { id: Number(result.insertId), fileUrl: input.fileUrl };
  }

  async deleteMedia(unitId: string, itemId: number, mediaId: number) {
    const item = await this.getItem(unitId, itemId);
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    if (!item.promotedPanelId) throw new Error("CATALOG_ITEM_MEDIA_REQUIRES_MASTER_PANEL");
    await this.poolFactory(this.env).execute(
      "DELETE FROM masterpanel_images WHERE id = ? AND part_id = ?",
      [mediaId, item.promotedPanelId],
    );
    return { deletedId: mediaId };
  }

  async promoteItem(unitId: string, itemId: number, actorId: string) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const promoted = await this.materializeItemWithConnection(connection, unitId, itemId, actorId, {
        isRestoration: true,
        actualName: null,
        availabilityStatus: "UNKNOWN",
        conditionStatus: "UNKNOWN",
        actionType: "JOBDESC",
        location: null,
        notes: null,
        mapping: null,
        qtyOpname: null,
      });
      await connection.commit();
      return promoted;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getPanel(unitId: string, panelId: number) {
    const [rows] = await this.poolFactory(this.env).query<Array<RowDataPacket & {
      id: number;
      carId: string;
      partId: number | null;
      sourcePart: string | null;
      componentId: number | null;
      panelId: number | null;
      componentName: string | null;
      panelName: string | null;
      namePart: string;
      aliasName: string | null;
      partNumber: string | null;
      qty: number | string | null;
      initialCondition: string | null;
      currentStatus: string | null;
      location: string | null;
      notes: string | null;
      createdAt: string | null;
      createdBy: string | null;
      updatedAt: string | null;
      updatedBy: string | null;
    }>>(
      `
        SELECT
          id,
          car_id AS carId,
          part_id AS partId,
          source_part AS sourcePart,
          component_id AS componentId,
          panel_id AS panelId,
          component_name AS componentName,
          panel_name AS panelName,
          name_part AS namePart,
          alias_name AS aliasName,
          part_number AS partNumber,
          qty,
          initial_condition AS initialCondition,
          current_status AS currentStatus,
          location,
          notes,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          created_by AS createdBy,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
          updated_by AS updatedBy
        FROM master_panels
        WHERE id = ? AND car_id = ?
        LIMIT 1
      `,
      [panelId, unitId],
    );
    const panel = rows[0] ?? null;
    if (!panel) return null;
    const media = await this.listMasterPanelImages(panelId);
    return { ...panel, media };
  }

  async listPanelJobdescs(panelId: number) {
    const [rows] = await this.poolFactory(this.env).query<RowDataPacket[]>(
      `
        SELECT id AS countdownId, car_id AS carId, panel_id AS panelId, division_id AS divisionId,
               job_type_id AS jobTypeId, section_name AS description, target_hours_initial AS targetHoursInitial,
               task_category AS taskCategory, status, start_date AS startDate, deadline_date AS deadlineDate
        FROM sm_jobdesc_countdown
        WHERE panel_id = ? AND task_category IN ('MAIN', 'ADDITIONAL')
        ORDER BY created_at ASC, id ASC
      `,
      [panelId],
    );
    return rows;
  }

  async createPanelJobdescs(unitId: string, panelId: number, input: CreatePanelJobdescsRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const panel = await this.getPanel(unitId, panelId);
      if (!panel) throw new Error("UNIT_PANEL_NOT_FOUND");
      const created = [];
      for (const job of input.jobs) {
        const countdownId = randomUUID();
        await connection.execute(
          `
            INSERT INTO sm_jobdesc_countdown (
              id, car_id, division_id, pic_plan, required_grade, standard_hours, target_hours,
              task_category, panel_id, section_name, job_type_id,
              target_hours_initial, target_hours_revised, remaining_hours, status, start_date, deadline_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLAN', ?, ?)
          `,
          [
            countdownId,
            unitId,
            job.divisionId,
            job.picPlan,
            job.requiredGrade,
            job.standardHours,
            job.targetHoursInitial,
            job.taskCategory,
            panelId,
            job.description,
            job.jobTypeId,
            job.targetHoursInitial,
            job.targetHoursInitial,
            job.targetHoursInitial,
            job.startDate,
            job.deadlineDate,
          ],
        );
        created.push({ countdownId, panelId });
      }
      await this.refreshPanelStatus(connection, unitId, panelId);
      await connection.commit();
      return created;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private normalizeItemInput(item: CatalogWorkspaceItemInput) {
    return {
      id: item.id ?? null,
      code: item.code ? normalizeSpaces(item.code) : null,
      partNumber: item.partNumber ? normalizeSpaces(item.partNumber) : null,
      itemName: item.itemName ? normalizeSpaces(item.itemName) : null,
      position: item.position ? normalizeSpaces(item.position) : null,
      qtyNormal: item.qtyNormal ?? null,
      isRestoration: Boolean(item.isRestoration),
    };
  }

  private async listWorkspaceItems(unitId: string, panelId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<WorkspaceItemRow[]>(
      `
        SELECT
          id,
          code,
          part_number AS partNumber,
          item_name AS itemName,
          position AS position,
          qty_normal AS qtyNormal,
          is_restoration AS isRestoration,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM unit_catalog
        WHERE car_id = ? AND panel_id = ?
        ORDER BY id ASC
      `,
      [unitId, panelId],
    );
    return rows.map(mapWorkspaceItem);
  }

  private async listPanelImages(panelId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          id,
          panel_id AS panelId,
          url_image AS fileUrl,
          caption,
          sort_order AS sortOrder,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM catalog_panel_images
        WHERE panel_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [panelId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      panelId: Number(row.panelId),
      fileUrl: String(row.fileUrl),
      caption: row.caption ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
      createdAt: row.createdAt ?? null,
    }));
  }

  private async listMasterPanelImages(masterPanelId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT
          id,
          part_id AS partId,
          url_image AS fileUrl,
          caption,
          sort_order AS sortOrder,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM masterpanel_images
        WHERE part_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [masterPanelId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      partId: Number(row.partId),
      fileUrl: String(row.fileUrl),
      caption: row.caption ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
      createdAt: row.createdAt ?? null,
    }));
  }

  private async getCatalogPanel(panelId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<PanelRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [panelId],
    );
    return rows[0] ? mapPanel(rows[0]) : null;
  }

  private async getAdditionalItem(unitId: string, itemId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<AdditionalItemRow[]>(
      `
        SELECT
          id,
          car_id AS carId,
          component_name AS componentName,
          panel_name AS panelName,
          item_name AS itemName,
          part_number AS partNumber,
          deskription
        FROM unit_additional_items
        WHERE id = ? AND car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    return rows[0] ?? null;
  }

  private async resolveAdditionalClassification(item: AdditionalItemRow, db: Queryable = this.poolFactory(this.env)) {
    const componentName = item.componentName ? normalizePanelName(item.componentName) : null;
    const panelName = item.panelName ? normalizePanelName(item.panelName) : null;
    if (!componentName || !panelName) return null;

    const [rows] = await db.query<Array<RowDataPacket & {
      componentId: number;
      panelId: number;
      componentName: string;
      panelName: string;
    }>>(
      `
        SELECT
          c.id AS componentId,
          p.id AS panelId,
          c.component_name AS componentName,
          p.panel_name AS panelName
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        WHERE (UPPER(TRIM(c.code)) = ? OR UPPER(TRIM(c.component_name)) = ?)
          AND UPPER(TRIM(p.panel_name)) = ?
        LIMIT 1
      `,
      [componentName, componentName, panelName],
    );
    return rows[0]
      ? {
          componentId: Number(rows[0].componentId),
          panelId: Number(rows[0].panelId),
          componentName: String(rows[0].componentName),
          panelName: String(rows[0].panelName),
        }
      : null;
  }

  private async ensurePanelByName(connection: PoolConnection, componentCode: CatalogComponent["code"], panelName: string) {
    const [componentRows] = await connection.query<ComponentRow[]>(
      "SELECT id, code, component_name AS componentName FROM catalog_components WHERE code = ? LIMIT 1",
      [componentCode],
    );
    const component = componentRows[0] ? mapComponent(componentRows[0]) : null;
    if (!component) throw new Error("CATALOG_COMPONENT_NOT_FOUND");

    const normalized = normalizePanelName(panelName);
    const [panelRows] = await connection.query<PanelRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        WHERE p.component_id = ?
          AND UPPER(TRIM(p.panel_name)) = ?
        LIMIT 1
      `,
      [component.id, normalized],
    );
    if (panelRows[0]) return mapPanel(panelRows[0]);

    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO catalog_panels (component_id, panel_name) VALUES (?, ?)",
      [component.id, normalized],
    );
    return {
      id: Number(result.insertId),
      componentId: component.id,
      componentCode: component.code,
      componentName: component.componentName,
      panelName: normalized,
    } satisfies CatalogPanel;
  }

  private async saveSurveyWithConnection(connection: PoolConnection, unitId: string, itemId: number, input: UpdateCatalogSurveyRequest) {
    const [rows] = await connection.query<Array<RowDataPacket & { isRestoration: number | boolean | null }>>(
      "SELECT id, is_restoration AS isRestoration FROM unit_catalog WHERE id = ? AND car_id = ? LIMIT 1 FOR UPDATE",
      [itemId, unitId],
    );
    const row = rows[0];
    if (!row) throw new Error("CATALOG_ITEM_NOT_FOUND");
    const shouldRestore = resolveRestorationSelection(input, row.isRestoration === true || row.isRestoration === 1);
    await connection.execute(
      "UPDATE unit_catalog SET is_restoration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [shouldRestore ? 1 : 0, itemId],
    );
    return shouldRestore;
  }

  private async materializeItemWithConnection(connection: PoolConnection, unitId: string, itemId: number, actorId: string, input: UpdateCatalogSurveyRequest) {
    const [existingRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM master_panels WHERE car_id = ? AND source_part = 'CATALOG' AND part_id = ? LIMIT 1 FOR UPDATE",
      [unitId, itemId],
    );
    if (existingRows[0]?.id) {
      return { panelId: Number(existingRows[0].id), alreadyPromoted: true };
    }

    const [rows] = await connection.query<Array<RowDataPacket & {
      id: number;
      carId: string;
      componentId: number;
      componentCode: CatalogComponent["code"];
      componentName: string;
      panelId: number;
      panelName: string;
      itemName: string | null;
      partNumber: string | null;
      position: string | null;
      qtyNormal: number | string | null;
      isRestoration: number | boolean | null;
    }>>(
      `
        SELECT
          uc.id,
          uc.car_id AS carId,
          c.id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.id AS panelId,
          p.panel_name AS panelName,
          uc.item_name AS itemName,
          uc.part_number AS partNumber,
          uc.position AS position,
          uc.qty_normal AS qtyNormal,
          uc.is_restoration AS isRestoration
        FROM unit_catalog uc
        JOIN catalog_panels p ON p.id = uc.panel_id
        JOIN catalog_components c ON c.id = p.component_id
        WHERE uc.id = ? AND uc.car_id = ?
        LIMIT 1 FOR UPDATE
      `,
      [itemId, unitId],
    );
    const item = rows[0];
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    if (!(item.isRestoration === true || item.isRestoration === 1)) throw new Error("SURVEY_NOT_CONFIRMED");

    const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO master_panels (
            car_id, part_id, source_part, component_id, panel_id, component_name, panel_name,
            name_part, alias_name, part_number, qty, initial_condition, current_status, location, notes,
            created_at, created_by, updated_at, updated_by
        ) VALUES (?, ?, 'CATALOG', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), ?)
      `,
      [
        unitId,
        itemId,
        item.componentId,
        item.panelId,
        item.componentName,
        item.panelName,
        item.itemName ?? item.position ?? item.partNumber ?? item.panelName,
        input.actualName ?? null,
        item.partNumber,
        num(item.qtyNormal) ?? 1,
        input.conditionStatus,
        input.availabilityStatus,
        input.location ?? "UNIT",
        input.notes,
        actorId,
        actorId,
      ],
    );
    const panelId = Number(result.insertId);
    await this.refreshPanelStatus(connection, unitId, panelId);
    return { panelId, alreadyPromoted: false };
  }

  private async refreshPanelStatus(connection: Queryable, unitId: string, panelId: number) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM sm_car_panel_status WHERE car_id = ? AND panel_id = ? LIMIT 1",
      [unitId, panelId],
    );
    if (rows[0]) {
      await connection.execute("UPDATE sm_car_panel_status SET last_updated_at = NOW() WHERE car_id = ? AND panel_id = ?", [unitId, panelId]);
      return;
    }
    await connection.execute(
      "INSERT INTO sm_car_panel_status (id, car_id, panel_id, current_division_id, is_locked, last_updated_at) VALUES (?, ?, ?, NULL, 0, NOW())",
      [randomUUID(), unitId, panelId],
    );
  }
}
