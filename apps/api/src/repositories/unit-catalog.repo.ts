import { randomUUID } from "node:crypto";
import type {
  CatalogComponent,
  CatalogItem,
  CatalogMediaRequest,
  CatalogOverview,
  CatalogPanel,
  CatalogReferenceMediaRequest,
  CatalogSearchItem,
  CatalogWorkspace,
  CatalogWorkspaceItem,
  CreatePanelJobdescsRequest,
  SaveCatalogWorkspaceRequest,
  UpdateCatalogSurveyRequest,
  UpsertCatalogReferenceRequest,
} from "@smsystem/contracts/unit-catalog";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";

type Queryable = Pool | PoolConnection;

interface ComponentRow extends RowDataPacket {
  id: number;
  code: CatalogComponent["code"];
  componentName: string;
  description: string | null;
  isActive: number | boolean;
}

interface PanelRow extends RowDataPacket {
  id: number;
  componentId: number;
  componentCode: CatalogComponent["code"];
  componentName: string;
  panelName: string;
  description: string | null;
  isActive: number | boolean;
}

interface PanelSummaryRow extends PanelRow {
  componentMasterId: number;
  referenceId: number | null;
  itemCount: number | string | null;
  surveyedCount: number | string | null;
  updatedAt: string | null;
}

interface WorkspaceReferenceRow extends PanelRow {
  referenceId: number | null;
  carId: string;
  referenceUrl: string | null;
  notes: string | null;
}

interface WorkspaceItemRow extends RowDataPacket {
  id: number;
  catalogReferenceId: number;
  code: string | null;
  partNumber: string | null;
  itemName: string | null;
  positionCode: string | null;
  qtyNormal: number | string | null;
  notes: string | null;
  sortOrder: number;
}

interface SurveyItemRow extends WorkspaceItemRow {
  qtyOpname: number | string | null;
  actualName: string | null;
  availabilityStatus: CatalogItem["availabilityStatus"];
  conditionStatus: CatalogItem["conditionStatus"];
  actionType: CatalogItem["actionType"];
  surveyStatus: CatalogItem["surveyStatus"];
  location: string | null;
  promotedPanelId: number | null;
  surveyedBy: string | null;
  surveyedAt: string | null;
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

function isTruthy(value: number | boolean) {
  return value === true || value === 1;
}

function isEmptyCatalogRow(row: {
  code: string | null;
  partNumber: string | null;
  itemName: string | null;
  positionCode: string | null;
  qtyNormal: number | null;
  notes: string | null;
}) {
  return !row.code && !row.partNumber && !row.itemName && !row.positionCode && row.qtyNormal == null && !row.notes;
}

function mapComponent(row: ComponentRow): CatalogComponent {
  return {
    id: Number(row.id),
    code: row.code,
    componentName: row.componentName,
    description: row.description ?? null,
    isActive: isTruthy(row.isActive),
  };
}

function mapPanel(row: PanelRow): CatalogPanel {
  return {
    id: Number(row.id),
    componentId: Number(row.componentId),
    componentCode: row.componentCode,
    componentName: row.componentName,
    panelName: row.panelName,
    description: row.description ?? null,
    isActive: isTruthy(row.isActive),
  };
}

function mapWorkspaceItem(row: WorkspaceItemRow): CatalogWorkspaceItem {
  return {
    id: Number(row.id),
    clientRowId: null,
    code: row.code ?? null,
    partNumber: row.partNumber ?? null,
    itemName: row.itemName ?? null,
    positionCode: row.positionCode ?? null,
    qtyNormal: num(row.qtyNormal),
    notes: row.notes ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

function mapSurveyItem(row: SurveyItemRow): CatalogItem {
  return {
    ...mapWorkspaceItem(row),
    id: Number(row.id),
    catalogReferenceId: Number(row.catalogReferenceId),
    qtyOpname: num(row.qtyOpname),
    actualName: row.actualName ?? null,
    availabilityStatus: row.availabilityStatus,
    conditionStatus: row.conditionStatus,
    actionType: row.actionType,
    surveyStatus: row.surveyStatus,
    location: row.location ?? null,
    promotedPanelId: row.promotedPanelId == null ? null : Number(row.promotedPanelId),
    surveyedBy: row.surveyedBy ?? null,
    surveyedAt: row.surveyedAt ?? null,
    media: [],
    mappings: [],
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

export class UnitCatalogRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pool = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async listOverview(unitId: string): Promise<CatalogOverview> {
    const [rows] = await this.poolFactory(this.env).query<PanelSummaryRow[]>(
      `
        SELECT
          c.id AS componentMasterId,
          c.code,
          c.component_name AS componentName,
          c.description,
          c.is_active AS isActive,
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName,
          p.description AS description,
          p.is_active AS isActive,
          r.id AS referenceId,
          COUNT(i.id) AS itemCount,
          SUM(CASE WHEN i.survey_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS surveyedCount,
          DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
        FROM catalog_components c
        LEFT JOIN catalog_panels p ON p.component_id = c.id AND p.is_active = 1
        LEFT JOIN unit_catalog_references r ON r.panel_id = p.id AND r.car_id = ?
        LEFT JOIN unit_catalog_items i ON i.catalog_reference_id = r.id
        WHERE c.is_active = 1
        GROUP BY c.id, c.code, c.component_name, c.description, c.is_active,
                 p.id, p.component_id, p.panel_name, p.description, p.is_active,
                 r.id, r.updated_at
        ORDER BY c.id ASC, p.panel_name ASC
      `,
      [unitId],
    );

    const components = new Map<number, CatalogComponent>();
    const panels: CatalogOverview["panels"] = [];

    for (const row of rows) {
      if (!components.has(Number(row.componentMasterId))) {
        components.set(Number(row.componentMasterId), {
          id: Number(row.componentMasterId),
          code: row.code,
          componentName: row.componentName,
          description: row.description ?? null,
          isActive: isTruthy(row.isActive),
        });
      }
      if (row.panelName) {
        panels.push({
          id: Number(row.id),
          componentId: Number(row.componentId),
          componentCode: row.componentCode,
          componentName: row.componentName,
          panelName: row.panelName,
          description: row.description ?? null,
          isActive: isTruthy(row.isActive),
          referenceId: row.referenceId == null ? null : Number(row.referenceId),
          itemCount: Number(row.itemCount ?? 0),
          surveyedCount: Number(row.surveyedCount ?? 0),
          updatedAt: row.updatedAt ?? null,
        });
      }
    }

    return {
      components: Array.from(components.values()),
      panels,
    };
  }

  async listReferences(unitId: string) {
    const overview = await this.listOverview(unitId);
    return overview.panels.filter((panel) => panel.referenceId !== null);
  }

  async createReference(unitId: string, actorId: string, input: UpsertCatalogReferenceRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const panel = await this.ensurePanelByName(connection, input.componentCode, input.panelName);
      const referenceId = await this.ensureReference(connection, unitId, panel, actorId, input.referenceUrl, input.notes);
      await connection.commit();
      return this.getPanelWorkspace(unitId, panel.id, referenceId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getReference(unitId: string, referenceId: number) {
    const [rows] = await this.poolFactory(this.env).query<Array<RowDataPacket & { panelId: number }>>(
      "SELECT panel_id AS panelId FROM unit_catalog_references WHERE id = ? AND car_id = ? LIMIT 1",
      [referenceId, unitId],
    );
    const panelId = rows[0]?.panelId ? Number(rows[0].panelId) : null;
    if (!panelId) return null;
    return this.getPanelWorkspace(unitId, panelId, referenceId);
  }

  async getPanelWorkspace(unitId: string, panelId: number, forcedReferenceId?: number | null): Promise<CatalogWorkspace | null> {
    const [rows] = await this.poolFactory(this.env).query<WorkspaceReferenceRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName,
          p.description,
          p.is_active AS isActive,
          COALESCE(r.id, ?) AS referenceId,
          ? AS carId,
          r.reference_url AS referenceUrl,
          r.notes
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        LEFT JOIN unit_catalog_references r ON r.panel_id = p.id AND r.car_id = ?
        WHERE p.id = ?
        LIMIT 1
      `,
      [forcedReferenceId ?? null, unitId, unitId, panelId],
    );

    const row = rows[0];
    if (!row) return null;

    const referenceId = row.referenceId == null ? null : Number(row.referenceId);
    const media = referenceId ? await this.listReferenceMedia(referenceId) : [];
    const items = referenceId
      ? await this.listWorkspaceItems(referenceId)
      : [];

    return {
      referenceId,
      carId: unitId,
      panel: mapPanel(row),
      referenceUrl: row.referenceUrl ?? null,
      notes: row.notes ?? null,
      media,
      items,
    };
  }

  async savePanelWorkspace(
    unitId: string,
    panelId: number,
    actorId: string,
    input: SaveCatalogWorkspaceRequest,
  ): Promise<CatalogWorkspace> {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const panel = await this.getCatalogPanel(panelId, connection);
      if (!panel) throw new Error("CATALOG_PANEL_NOT_FOUND");

      const referenceId = await this.ensureReference(connection, unitId, panel, actorId, input.referenceUrl, input.notes);
      const normalizedItems = input.items
        .map((item, index) => ({
          id: item.id ?? null,
          code: item.code ? normalizeSpaces(item.code) : null,
          partNumber: item.partNumber ? normalizeSpaces(item.partNumber) : null,
          itemName: item.itemName ? normalizeSpaces(item.itemName) : null,
          positionCode: item.positionCode ? normalizeSpaces(item.positionCode) : null,
          qtyNormal: item.qtyNormal ?? null,
          notes: item.notes ? normalizeSpaces(item.notes) : null,
          sortOrder: index,
        }))
        .filter((item) => !isEmptyCatalogRow(item));

      if (input.deletedItemIds.length > 0) {
        await connection.execute(
          `
            DELETE FROM unit_catalog_items
            WHERE catalog_reference_id = ?
              AND id IN (${input.deletedItemIds.map(() => "?").join(",")})
          `,
          [referenceId, ...input.deletedItemIds],
        );
      }

      for (const item of normalizedItems) {
        if (item.id) {
          await connection.execute(
            `
              UPDATE unit_catalog_items
              SET code = ?, part_number = ?, item_name = ?, position_code = ?,
                  qty_normal = ?, notes = ?, sort_order = ?
              WHERE id = ? AND catalog_reference_id = ?
            `,
            [
              item.code,
              item.partNumber,
              item.itemName,
              item.positionCode,
              item.qtyNormal,
              item.notes,
              item.sortOrder,
              item.id,
              referenceId,
            ],
          );
        } else {
          await connection.execute(
            `
              INSERT INTO unit_catalog_items (
                catalog_reference_id, code, part_number, item_name, position_code, qty_normal, notes, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              referenceId,
              item.code,
              item.partNumber,
              item.itemName,
              item.positionCode,
              item.qtyNormal,
              item.notes,
              item.sortOrder,
            ],
          );
        }
      }

      if (input.deletedMediaIds.length > 0) {
        await connection.execute(
          `
            DELETE FROM unit_catalog_reference_media
            WHERE catalog_reference_id = ?
              AND id IN (${input.deletedMediaIds.map(() => "?").join(",")})
          `,
          [referenceId, ...input.deletedMediaIds],
        );
      }

      for (const media of input.media) {
        if (media.id) {
          await connection.execute(
            `
              UPDATE unit_catalog_reference_media
              SET url_image = ?, caption = ?, sort_order = ?
              WHERE id = ? AND catalog_reference_id = ?
            `,
            [media.fileUrl, media.caption, media.sortOrder, media.id, referenceId],
          );
        } else {
          await connection.execute(
            `
              INSERT INTO unit_catalog_reference_media (
                catalog_reference_id, url_image, caption, sort_order, created_by
              ) VALUES (?, ?, ?, ?, ?)
            `,
            [referenceId, media.fileUrl, media.caption, media.sortOrder, actorId],
          );
        }
      }

      await connection.commit();
      const workspace = await this.getPanelWorkspace(unitId, panelId, referenceId);
      if (!workspace) throw new Error("CATALOG_REFERENCE_NOT_FOUND");
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

    const booleanQuery = buildBooleanSearch(trimmed);
    const prefixQuery = `${trimmed.replace(/\s+/gu, "")}%`;
    const clauses = ["r.car_id = ?"];
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
    if (booleanQuery) {
      searchClauses.push("MATCH(i.item_name, i.part_number, i.code) AGAINST (? IN BOOLEAN MODE)");
      params.push(booleanQuery);
    }
    searchClauses.push("i.part_number LIKE ?");
    params.push(prefixQuery);
    searchClauses.push("i.code LIKE ?");
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
      positionCode: string | null;
      qtyNormal: number | string | null;
    }>>(
      `
        SELECT
          i.id AS itemId,
          r.car_id AS carId,
          c.id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.id AS panelId,
          p.panel_name AS panelName,
          i.code,
          i.part_number AS partNumber,
          i.item_name AS itemName,
          i.position_code AS positionCode,
          i.qty_normal AS qtyNormal
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        JOIN catalog_panels p ON p.id = r.panel_id
        JOIN catalog_components c ON c.id = p.component_id
        WHERE ${clauses.join(" AND ")}
          AND (${searchClauses.join(" OR ")})
        ORDER BY p.panel_name ASC, i.sort_order ASC, i.id ASC
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
      positionCode: row.positionCode ?? null,
      qtyNormal: num(row.qtyNormal),
    }));
  }

  async addReferenceMedia(unitId: string, referenceId: number, actorId: string, input: CatalogReferenceMediaRequest) {
    const workspace = await this.getReference(unitId, referenceId);
    if (!workspace) throw new Error("CATALOG_REFERENCE_NOT_FOUND");
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO unit_catalog_reference_media (
          catalog_reference_id, url_image, caption, sort_order, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [referenceId, input.fileUrl, input.caption, input.sortOrder, actorId],
    );
    return { id: Number(result.insertId), fileUrl: input.fileUrl };
  }

  async getItem(unitId: string, itemId: number, db: Queryable = this.poolFactory(this.env)): Promise<CatalogItem | null> {
    const [rows] = await db.query<SurveyItemRow[]>(
      `
        SELECT
          i.id,
          i.catalog_reference_id AS catalogReferenceId,
          i.code,
          i.part_number AS partNumber,
          i.item_name AS itemName,
          i.position_code AS positionCode,
          i.qty_normal AS qtyNormal,
          i.qty_opname AS qtyOpname,
          i.actual_name AS actualName,
          i.availability_status AS availabilityStatus,
          i.condition_status AS conditionStatus,
          i.action_type AS actionType,
          i.survey_status AS surveyStatus,
          i.location,
          i.notes,
          i.promoted_panel_id AS promotedPanelId,
          i.sort_order AS sortOrder,
          i.surveyed_by AS surveyedBy,
          i.surveyed_at AS surveyedAt
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        WHERE i.id = ? AND r.car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    const item = rows[0] ? mapSurveyItem(rows[0]) : null;
    if (!item) return null;

    const [mediaRows] = await db.query<Array<RowDataPacket & {
      id: number;
      fileUrl: string;
      caption: string | null;
      createdBy: string | null;
      createdAt: string | null;
    }>>(
      `
        SELECT id, file_url AS fileUrl, caption, created_by AS createdBy, created_at AS createdAt
        FROM unit_catalog_item_media
        WHERE catalog_item_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [itemId],
    );
    item.media = mediaRows.map((row) => ({
      id: Number(row.id),
      fileUrl: row.fileUrl,
      caption: row.caption ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt ?? null,
    }));

    const [mappingRows] = await db.query<Array<RowDataPacket & {
      id: number;
      catalogItemId: number;
      catalogReferenceMediaId: number;
      xPercent: number | string;
      yPercent: number | string;
      createdBy: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>>(
      `
        SELECT
          id,
          catalog_item_id AS catalogItemId,
          catalog_reference_media_id AS catalogReferenceMediaId,
          x_percent AS xPercent,
          y_percent AS yPercent,
          created_by AS createdBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM unit_catalog_item_mappings
        WHERE catalog_item_id = ?
        ORDER BY id ASC
      `,
      [itemId],
    );
    item.mappings = mappingRows.map((row) => ({
      id: Number(row.id),
      catalogItemId: Number(row.catalogItemId),
      catalogReferenceMediaId: Number(row.catalogReferenceMediaId),
      xPercent: Number(row.xPercent),
      yPercent: Number(row.yPercent),
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }));

    return item;
  }

  async updateSurvey(unitId: string, itemId: number, actorId: string, input: UpdateCatalogSurveyRequest) {
    if (!(await this.getItem(unitId, itemId))) throw new Error("CATALOG_ITEM_NOT_FOUND");
    await this.poolFactory(this.env).execute(
      `
        UPDATE unit_catalog_items
        SET qty_opname = ?, actual_name = ?, availability_status = ?, condition_status = ?, action_type = ?,
            survey_status = 'DRAFT', location = ?, notes = ?, surveyed_by = ?, surveyed_at = NOW()
        WHERE id = ?
      `,
      [
        input.qtyOpname,
        input.actualName,
        input.availabilityStatus,
        input.conditionStatus,
        input.actionType,
        input.location,
        input.notes,
        actorId,
        itemId,
      ],
    );
    if (input.mapping) await this.addMapping(itemId, actorId, input.mapping);
    const item = await this.getItem(unitId, itemId);
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    return item;
  }

  async confirmSurvey(unitId: string, itemId: number, actorId: string, input: UpdateCatalogSurveyRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      await this.saveSurveyWithConnection(connection, unitId, itemId, actorId, input, "CONFIRMED");
      const promoted = await this.materializeItemWithConnection(connection, unitId, itemId, actorId);
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

  async addMedia(unitId: string, itemId: number, actorId: string, input: CatalogMediaRequest) {
    if (!(await this.getItem(unitId, itemId))) throw new Error("CATALOG_ITEM_NOT_FOUND");
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO unit_catalog_item_media (catalog_item_id, file_url, caption, created_by)
        VALUES (?, ?, ?, ?)
      `,
      [itemId, input.fileUrl, input.caption, actorId],
    );
    return { id: Number(result.insertId), fileUrl: input.fileUrl };
  }

  async deleteMedia(unitId: string, itemId: number, mediaId: number) {
    if (!(await this.getItem(unitId, itemId))) throw new Error("CATALOG_ITEM_NOT_FOUND");
    await this.poolFactory(this.env).execute(
      "DELETE FROM unit_catalog_item_media WHERE id = ? AND catalog_item_id = ?",
      [mediaId, itemId],
    );
    return { deletedId: mediaId };
  }

  async promoteItem(unitId: string, itemId: number, actorId: string) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const promoted = await this.materializeItemWithConnection(connection, unitId, itemId, actorId);
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
      componentName: string | null;
      name: string;
      parentId: number | null;
      partNumber: string | null;
      positionCode: string | null;
      qtyNormal: number | string | null;
      initialCondition: string | null;
      notes: string | null;
      panelName: string | null;
      namePart: string | null;
      location: string | null;
      currentStatus: string | null;
    }>>(
      `
        SELECT
          id,
          car_id AS carId,
          COALESCE(component_name, section) AS componentName,
          name,
          parent_id AS parentId,
          part_number AS partNumber,
          position_code AS positionCode,
          COALESCE(qty_normal, qty) AS qtyNormal,
          initial_condition AS initialCondition,
          notes,
          panel_name AS panelName,
          name_part AS namePart,
          location,
          current_status AS currentStatus
        FROM master_panels
        WHERE id = ? AND car_id = ?
        LIMIT 1
      `,
      [panelId, unitId],
    );
    const panel = rows[0] ?? null;
    if (!panel) return null;

    const [mediaRows] = await this.poolFactory(this.env).query<RowDataPacket[]>(
      `
        SELECT id, master_panel_id AS panelId, url_image AS fileUrl, image_type AS mediaType,
               caption, source_catalog_media_id AS sourceCatalogMediaId,
               source_catalog_reference_media_id AS sourceCatalogReferenceMediaId,
               created_by AS createdBy, created_at AS createdAt
        FROM master_panel_images
        WHERE master_panel_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [panelId],
    );
    return { ...panel, media: mediaRows };
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

  private async listWorkspaceItems(referenceId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<WorkspaceItemRow[]>(
      `
        SELECT
          id,
          catalog_reference_id AS catalogReferenceId,
          code,
          part_number AS partNumber,
          item_name AS itemName,
          position_code AS positionCode,
          qty_normal AS qtyNormal,
          notes,
          sort_order AS sortOrder
        FROM unit_catalog_items
        WHERE catalog_reference_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [referenceId],
    );
    return rows.map(mapWorkspaceItem);
  }

  private async listReferenceMedia(referenceId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT id, catalog_reference_id AS catalogReferenceId, url_image AS fileUrl, caption,
               sort_order AS sortOrder, created_by AS createdBy, created_at AS createdAt
        FROM unit_catalog_reference_media
        WHERE catalog_reference_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [referenceId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      catalogReferenceId: Number(row.catalogReferenceId),
      fileUrl: String(row.fileUrl),
      caption: row.caption ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
      createdBy: row.createdBy ?? null,
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
          p.panel_name AS panelName,
          p.description,
          p.is_active AS isActive
        FROM catalog_panels p
        JOIN catalog_components c ON c.id = p.component_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [panelId],
    );
    return rows[0] ? mapPanel(rows[0]) : null;
  }

  private async ensurePanelByName(connection: PoolConnection, componentCode: CatalogComponent["code"], panelName: string) {
    const normalized = normalizePanelName(panelName);
    const [componentRows] = await connection.query<ComponentRow[]>(
      "SELECT id, code, component_name AS componentName, description, is_active AS isActive FROM catalog_components WHERE code = ? LIMIT 1",
      [componentCode],
    );
    const component = componentRows[0] ? mapComponent(componentRows[0]) : null;
    if (!component) throw new Error("CATALOG_COMPONENT_NOT_FOUND");

    const [panelRows] = await connection.query<PanelRow[]>(
      `
        SELECT
          p.id,
          p.component_id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.panel_name AS panelName,
          p.description,
          p.is_active AS isActive
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
      "INSERT INTO catalog_panels (component_id, panel_name, is_active) VALUES (?, ?, 1)",
      [component.id, normalized],
    );
    return {
      id: Number(result.insertId),
      componentId: component.id,
      componentCode: component.code,
      componentName: component.componentName,
      panelName: normalized,
      description: null,
      isActive: true,
    } satisfies CatalogPanel;
  }

  private async ensureReference(
    connection: PoolConnection,
    unitId: string,
    panel: CatalogPanel,
    actorId: string,
    referenceUrl: string | null,
    notes: string | null,
  ) {
    const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM unit_catalog_references WHERE car_id = ? AND panel_id = ? LIMIT 1 FOR UPDATE",
      [unitId, panel.id],
    );
    if (rows[0]?.id) {
      const referenceId = Number(rows[0].id);
      await connection.execute(
        `
          UPDATE unit_catalog_references
          SET reference_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [referenceUrl, notes, referenceId],
      );
      return referenceId;
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO unit_catalog_references (
          car_id, panel_id, reference_url, notes, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [unitId, panel.id, referenceUrl, notes, actorId],
    );
    return Number(result.insertId);
  }

  private async materializeItemWithConnection(connection: PoolConnection, unitId: string, itemId: number, actorId: string) {
    const [rows] = await connection.query<Array<RowDataPacket & {
      id: number;
      catalogReferenceId: number;
      promotedPanelId: number | null;
      surveyStatus: string;
      componentId: number;
      componentCode: CatalogComponent["code"];
      componentName: string;
      panelId: number;
      panelName: string;
      actualName: string | null;
      itemName: string | null;
      partNumber: string | null;
      positionCode: string | null;
      qtyNormal: number | string | null;
      conditionStatus: string;
      availabilityStatus: string;
      location: string | null;
      notes: string | null;
      sortOrder: number | null;
    }>>(
      `
        SELECT
          i.id,
          i.catalog_reference_id AS catalogReferenceId,
          i.promoted_panel_id AS promotedPanelId,
          i.survey_status AS surveyStatus,
          c.id AS componentId,
          c.code AS componentCode,
          c.component_name AS componentName,
          p.id AS panelId,
          p.panel_name AS panelName,
          i.actual_name AS actualName,
          i.item_name AS itemName,
          i.part_number AS partNumber,
          i.position_code AS positionCode,
          i.qty_normal AS qtyNormal,
          i.condition_status AS conditionStatus,
          i.availability_status AS availabilityStatus,
          i.location,
          i.notes,
          i.sort_order AS sortOrder
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        JOIN catalog_panels p ON p.id = r.panel_id
        JOIN catalog_components c ON c.id = p.component_id
        WHERE i.id = ? AND r.car_id = ?
        LIMIT 1 FOR UPDATE
      `,
      [itemId, unitId],
    );
    const item = rows[0];
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    if (item.promotedPanelId) return { panelId: Number(item.promotedPanelId), alreadyPromoted: true };
    if (item.surveyStatus !== "CONFIRMED") throw new Error("SURVEY_NOT_CONFIRMED");

    const [existingRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM master_panels WHERE car_id = ? AND source_type = 'CATALOG' AND source_id = ? LIMIT 1 FOR UPDATE",
      [unitId, itemId],
    );
    if (existingRows[0]?.id) {
      await connection.execute("UPDATE unit_catalog_items SET promoted_panel_id = ? WHERE id = ?", [existingRows[0].id, itemId]);
      return { panelId: Number(existingRows[0].id), alreadyPromoted: true };
    }

    const [parentRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM master_panels
        WHERE car_id = ? AND parent_id IS NULL
          AND ((panel_id = ? AND panel_id IS NOT NULL) OR (COALESCE(component_name, section) = ? AND name = ?))
        LIMIT 1
      `,
      [unitId, item.panelId, item.componentCode, item.panelName],
    );
    let parentId = parentRows[0]?.id ? Number(parentRows[0].id) : 0;
    if (!parentId) {
      const [parentResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO master_panels (
            car_id, component_name, section, name, category, parent_id, sort_order,
            qty, qty_normal, is_active, created_by, updated_by, component_id, panel_id,
            panel_name, name_part, current_status, location
          ) VALUES (?, ?, ?, ?, ?, NULL, 0, 1, 1, 1, ?, ?, ?, ?, ?, ?, NULL, 'UNIT')
        `,
        [
          unitId,
          item.componentCode,
          item.componentCode,
          item.panelName,
          item.componentCode,
          actorId,
          actorId,
          item.componentId,
          item.panelId,
          item.panelName,
          item.panelName,
        ],
      );
      parentId = Number(parentResult.insertId);
    }

    const resolvedName = item.actualName || item.itemName || item.positionCode || item.partNumber || item.panelName;
    const [childResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO master_panels (
          car_id, component_name, section, name, category, parent_id, part_number, position_code,
          sort_order, qty, qty_normal, initial_condition, notes, is_active, created_by, updated_by,
          source_type, source_id, component_id, panel_id, panel_name, name_part, alias_name, current_status, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'CATALOG', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        unitId,
        item.componentCode,
        item.componentCode,
        resolvedName,
        item.componentCode,
        parentId,
        item.partNumber,
        item.positionCode,
        item.sortOrder ?? 0,
        num(item.qtyNormal) ?? 1,
        num(item.qtyNormal),
        item.conditionStatus,
        item.notes,
        actorId,
        actorId,
        itemId,
        item.componentId,
        item.panelId,
        item.panelName,
        resolvedName,
        item.actualName,
        item.availabilityStatus,
        item.location ?? "UNIT",
      ],
    );
    const panelId = Number(childResult.insertId);

    const referenceMedia = await this.listReferenceMedia(Number(item.catalogReferenceId), connection);
    for (const media of referenceMedia) {
      await connection.execute(
        `
          INSERT IGNORE INTO master_panel_images (
            master_panel_id, url_image, image_type, caption, source_catalog_reference_media_id, created_by
          ) VALUES (?, ?, 'REFERENCE', ?, ?, ?)
        `,
        [panelId, media.fileUrl, media.caption, media.id, actorId],
      );
    }

    const [mediaRows] = await connection.query<Array<RowDataPacket & { id: number; fileUrl: string; caption: string | null }>>(
      "SELECT id, file_url AS fileUrl, caption FROM unit_catalog_item_media WHERE catalog_item_id = ? ORDER BY created_at ASC, id ASC",
      [itemId],
    );
    for (const media of mediaRows) {
      await connection.execute(
        `
          INSERT IGNORE INTO master_panel_images (
            master_panel_id, url_image, image_type, caption, source_catalog_media_id, created_by
          ) VALUES (?, ?, 'ACTUAL', ?, ?, ?)
        `,
        [panelId, media.fileUrl, media.caption ?? null, media.id, actorId],
      );
    }

    await connection.execute("UPDATE unit_catalog_items SET promoted_panel_id = ? WHERE id = ?", [panelId, itemId]);
    await this.refreshPanelStatus(connection, unitId, panelId);
    return { panelId, alreadyPromoted: false };
  }

  private async addMapping(
    connectionOrItemId: Queryable | number,
    itemIdOrActorId: number | string,
    actorOrMapping: string | NonNullable<UpdateCatalogSurveyRequest["mapping"]>,
    maybeMapping?: NonNullable<UpdateCatalogSurveyRequest["mapping"]>,
  ) {
    const connection = typeof connectionOrItemId === "number" ? this.poolFactory(this.env) : connectionOrItemId;
    const itemId = typeof connectionOrItemId === "number" ? connectionOrItemId : Number(itemIdOrActorId);
    const actorId = typeof connectionOrItemId === "number" ? String(itemIdOrActorId) : String(actorOrMapping);
    const mapping = (typeof connectionOrItemId === "number" ? actorOrMapping : maybeMapping) as NonNullable<UpdateCatalogSurveyRequest["mapping"]>;
    await connection.execute(
      `
        INSERT INTO unit_catalog_item_mappings (
          catalog_item_id, catalog_reference_media_id, x_percent, y_percent, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [itemId, mapping.catalogReferenceMediaId, mapping.xPercent, mapping.yPercent, actorId],
    );
  }

  private async saveSurveyWithConnection(
    connection: PoolConnection,
    unitId: string,
    itemId: number,
    actorId: string,
    input: UpdateCatalogSurveyRequest,
    surveyStatus: "DRAFT" | "CONFIRMED",
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT i.id
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        WHERE i.id = ? AND r.car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    if (!rows[0]) throw new Error("CATALOG_ITEM_NOT_FOUND");

    await connection.execute(
      `
        UPDATE unit_catalog_items
        SET qty_opname = ?, actual_name = ?, availability_status = ?, condition_status = ?, action_type = ?,
            survey_status = ?, location = ?, notes = ?, surveyed_by = ?, surveyed_at = NOW()
        WHERE id = ?
      `,
      [
        input.qtyOpname,
        input.actualName,
        input.availabilityStatus,
        input.conditionStatus,
        input.actionType,
        surveyStatus,
        input.location,
        input.notes,
        actorId,
        itemId,
      ],
    );

    if (input.mapping) await this.addMapping(connection, itemId, actorId, input.mapping);
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
