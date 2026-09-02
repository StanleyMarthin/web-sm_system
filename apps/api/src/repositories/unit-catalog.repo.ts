import { randomUUID } from "node:crypto";
import type {
  BulkCatalogItemsRequest,
  CatalogItem,
  CatalogMediaRequest,
  CatalogReferenceMediaRequest,
  CatalogReference,
  CreatePanelJobdescsRequest,
  UpdateCatalogSurveyRequest,
  UpsertCatalogReferenceRequest,
} from "@smsystem/contracts/unit-catalog";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";

type Queryable = Pool | PoolConnection;

interface CatalogItemRow extends RowDataPacket {
  id: number;
  catalogReferenceId: number;
  positionCode: string | null;
  partNumber: string | null;
  partName: string | null;
  qtyNormal: number | string | null;
  qtyOpname: number | string | null;
  actualName: string | null;
  availabilityStatus: CatalogItem["availabilityStatus"];
  conditionStatus: CatalogItem["conditionStatus"];
  actionType: CatalogItem["actionType"];
  surveyStatus: CatalogItem["surveyStatus"];
  location: string | null;
  notes: string | null;
  promotedPanelId: number | null;
  sortOrder: number;
  surveyedBy: string | null;
  surveyedAt: string | null;
}

interface CatalogReferenceRow extends RowDataPacket {
  id: number;
  carId: string;
  componentName: string;
  panelName: string;
  diagramImageUrl: string | null;
  referenceUrl: string | null;
  notes: string | null;
  itemCount?: number | null;
  surveyedCount?: number | null;
}

function num(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapItem(row: CatalogItemRow): CatalogItem {
  return {
    id: Number(row.id),
    catalogReferenceId: Number(row.catalogReferenceId),
    positionCode: row.positionCode,
    partNumber: row.partNumber,
    partName: row.partName,
    qtyNormal: num(row.qtyNormal),
    qtyOpname: num(row.qtyOpname),
    actualName: row.actualName,
    availabilityStatus: row.availabilityStatus,
    conditionStatus: row.conditionStatus,
    actionType: row.actionType,
    surveyStatus: row.surveyStatus,
    location: row.location,
    notes: row.notes,
    promotedPanelId: row.promotedPanelId === null ? null : Number(row.promotedPanelId),
    sortOrder: Number(row.sortOrder ?? 0),
    surveyedBy: row.surveyedBy,
    surveyedAt: row.surveyedAt,
    media: [],
    mappings: [],
  };
}

function mapReference(row: CatalogReferenceRow): CatalogReference {
  return {
    id: Number(row.id),
    carId: row.carId,
    componentName: row.componentName,
    panelName: row.panelName,
    diagramImageUrl: row.diagramImageUrl,
    referenceUrl: row.referenceUrl,
    notes: row.notes,
    itemCount: Number(row.itemCount ?? 0),
    surveyedCount: Number(row.surveyedCount ?? 0),
    media: [],
    items: [],
  };
}

export class UnitCatalogRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pool = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async listReferences(unitId: string): Promise<CatalogReference[]> {
    const [rows] = await this.poolFactory(this.env).query<CatalogReferenceRow[]>(
      `
        SELECT r.id, r.car_id AS carId, r.component_name AS componentName, r.panel_name AS panelName,
               r.diagram_image_url AS diagramImageUrl, r.reference_url AS referenceUrl, r.notes,
               COUNT(i.id) AS itemCount,
               SUM(CASE WHEN i.survey_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS surveyedCount
        FROM unit_catalog_references r
        LEFT JOIN unit_catalog_items i ON i.catalog_reference_id = r.id
        WHERE r.car_id = ?
        GROUP BY r.id
        ORDER BY r.component_name, r.panel_name, r.id
      `,
      [unitId],
    );
    return rows.map(mapReference);
  }

  async createReference(unitId: string, actorId: string, input: UpsertCatalogReferenceRequest) {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO unit_catalog_references (
            car_id, component_name, panel_name, diagram_image_url, reference_url, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [unitId, input.componentName, input.panelName, input.diagramImageUrl, input.referenceUrl, input.notes, actorId],
      );
      const referenceId = Number(result.insertId);
      if (input.diagramImageUrl) {
        await connection.execute(
          `
            INSERT INTO unit_catalog_reference_media (
              catalog_reference_id, file_url, caption, sort_order, created_by
            ) VALUES (?, ?, ?, 0, ?)
          `,
          [referenceId, input.diagramImageUrl, input.referenceUrl, actorId],
        );
      }
      await connection.commit();
      return this.getReference(unitId, referenceId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getReference(unitId: string, referenceId: number): Promise<CatalogReference | null> {
    const pool = this.poolFactory(this.env);
    const [referenceRows] = await pool.query<CatalogReferenceRow[]>(
      `
        SELECT id, car_id AS carId, component_name AS componentName, panel_name AS panelName,
               diagram_image_url AS diagramImageUrl, reference_url AS referenceUrl, notes
        FROM unit_catalog_references
        WHERE id = ? AND car_id = ?
        LIMIT 1
      `,
      [referenceId, unitId],
    );
    const reference = referenceRows[0] ? mapReference(referenceRows[0]) : null;
    if (!reference) return null;
    reference.media = await this.listReferenceMedia(referenceId);
    const [itemRows] = await pool.query<CatalogItemRow[]>(
      `
        SELECT id, catalog_reference_id AS catalogReferenceId, position_code AS positionCode,
               part_number AS partNumber, part_name AS partName, qty_normal AS qtyNormal,
               actual_name AS actualName,
               qty_opname AS qtyOpname, availability_status AS availabilityStatus,
               condition_status AS conditionStatus, action_type AS actionType,
               survey_status AS surveyStatus,
               location, notes, promoted_panel_id AS promotedPanelId, sort_order AS sortOrder,
               surveyed_by AS surveyedBy, surveyed_at AS surveyedAt
        FROM unit_catalog_items
        WHERE catalog_reference_id = ?
        ORDER BY sort_order, id
      `,
      [referenceId],
    );
    reference.items = itemRows.map(mapItem);
    return reference;
  }

  async replaceItems(referenceId: number, input: BulkCatalogItemsRequest): Promise<{ itemCount: number }> {
    const connection = await this.poolFactory(this.env).getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM unit_catalog_items WHERE catalog_reference_id = ?", [referenceId]);
      for (const item of input.items) {
        await connection.execute(
          `
            INSERT INTO unit_catalog_items (
              catalog_reference_id, position_code, part_number, part_name, qty_normal, qty_opname,
              actual_name, availability_status, condition_status, action_type, location, notes, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            referenceId,
            item.positionCode,
            item.partNumber,
            item.partName,
            item.qtyNormal,
            item.qtyOpname,
            item.actualName,
            item.availabilityStatus,
            item.conditionStatus,
            item.actionType,
            item.location,
            item.notes,
            item.sortOrder,
          ],
        );
      }
      await connection.commit();
      return { itemCount: input.items.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addReferenceMedia(unitId: string, referenceId: number, actorId: string, input: CatalogReferenceMediaRequest) {
    const reference = await this.getReference(unitId, referenceId);
    if (!reference) throw new Error("CATALOG_REFERENCE_NOT_FOUND");
    const [result] = await this.poolFactory(this.env).execute<ResultSetHeader>(
      `
        INSERT INTO unit_catalog_reference_media (
          catalog_reference_id, file_url, caption, sort_order, created_by
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [referenceId, input.fileUrl, input.caption, input.sortOrder, actorId],
    );
    return { id: Number(result.insertId), fileUrl: input.fileUrl };
  }

  async getItem(unitId: string, itemId: number, db: Queryable = this.poolFactory(this.env)): Promise<CatalogItem | null> {
    const [rows] = await db.query<CatalogItemRow[]>(
      `
        SELECT i.id, i.catalog_reference_id AS catalogReferenceId, i.position_code AS positionCode,
               i.part_number AS partNumber, i.part_name AS partName, i.qty_normal AS qtyNormal,
               i.actual_name AS actualName,
               i.qty_opname AS qtyOpname, i.availability_status AS availabilityStatus,
               i.condition_status AS conditionStatus, i.action_type AS actionType,
               i.survey_status AS surveyStatus,
               i.location, i.notes, i.promoted_panel_id AS promotedPanelId, i.sort_order AS sortOrder,
               i.surveyed_by AS surveyedBy, i.surveyed_at AS surveyedAt
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        WHERE i.id = ? AND r.car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    const item = rows[0] ? mapItem(rows[0]) : null;
    if (!item) return null;
    const [mediaRows] = await db.query<RowDataPacket[]>(
      `
        SELECT id, file_url AS fileUrl, caption, created_by AS createdBy, created_at AS createdAt
        FROM unit_catalog_item_media
        WHERE catalog_item_id = ?
        ORDER BY created_at, id
      `,
      [itemId],
    );
    item.media = mediaRows.map((row) => ({
      id: Number(row.id),
      fileUrl: String(row.fileUrl),
      caption: row.caption ?? null,
      createdBy: row.createdBy ?? null,
      createdAt: row.createdAt ?? null,
    }));
    const [mappingRows] = await db.query<RowDataPacket[]>(
      `
        SELECT id, catalog_item_id AS catalogItemId, catalog_reference_media_id AS catalogReferenceMediaId,
               x_percent AS xPercent, y_percent AS yPercent, created_by AS createdBy,
               created_at AS createdAt, updated_at AS updatedAt
        FROM unit_catalog_item_mappings
        WHERE catalog_item_id = ?
        ORDER BY id
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

  async updateSurvey(unitId: string, itemId: number, actorId: string, input: UpdateCatalogSurveyRequest): Promise<CatalogItem> {
    if (!(await this.getItem(unitId, itemId))) throw new Error("CATALOG_ITEM_NOT_FOUND");
    await this.poolFactory(this.env).execute(
      `
        UPDATE unit_catalog_items
        SET qty_opname = ?, actual_name = ?, availability_status = ?, condition_status = ?, action_type = ?,
            survey_status = 'DRAFT', location = ?, notes = ?, surveyed_by = ?, surveyed_at = NOW()
        WHERE id = ?
      `,
      [input.qtyOpname, input.actualName, input.availabilityStatus, input.conditionStatus, input.actionType, input.location, input.notes, actorId, itemId],
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

  private async materializeItemWithConnection(connection: PoolConnection, unitId: string, itemId: number, actorId: string) {
      const [rows] = await connection.query<Array<RowDataPacket & {
        id: number; catalogReferenceId: number; promotedPanelId: number | null; surveyStatus: string; componentName: string; panelName: string;
        actualName: string | null;
        partName: string | null; partNumber: string | null; positionCode: string | null;
        qtyNormal: number | string | null; conditionStatus: string; notes: string | null; sortOrder: number | null;
        diagramImageUrl: string | null; referenceUrl: string | null;
      }>>(
        `
          SELECT i.id, i.catalog_reference_id AS catalogReferenceId,
                 i.promoted_panel_id AS promotedPanelId, i.survey_status AS surveyStatus, r.component_name AS componentName,
                 r.panel_name AS panelName, i.actual_name AS actualName,
                 i.part_name AS partName, i.part_number AS partNumber,
                 i.position_code AS positionCode, i.qty_normal AS qtyNormal,
                 i.condition_status AS conditionStatus, i.notes, i.sort_order AS sortOrder,
                 r.diagram_image_url AS diagramImageUrl, r.reference_url AS referenceUrl
          FROM unit_catalog_items i
          JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
          WHERE i.id = ? AND r.car_id = ?
          LIMIT 1 FOR UPDATE
        `,
        [itemId, unitId],
      );
      const item = rows[0];
      if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
      if (item.promotedPanelId) {
        return { panelId: Number(item.promotedPanelId), alreadyPromoted: true };
      }
      if (item.surveyStatus !== "CONFIRMED") throw new Error("SURVEY_NOT_CONFIRMED");
      const [parentRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT id FROM master_panels
          WHERE car_id = ? AND parent_id IS NULL
            AND COALESCE(component_name, section) = ? AND name = ?
          LIMIT 1
        `,
        [unitId, item.componentName, item.panelName],
      );
      let parentId = Number(parentRows[0]?.id ?? 0);
      if (!parentId) {
        const [parentResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO master_panels (
              car_id, component_name, section, name, category, parent_id, sort_order,
              qty, qty_normal, is_active, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, NULL, 0, 1, 1, 1, ?, ?)
          `,
          [unitId, item.componentName, item.componentName, item.panelName, item.componentName, actorId, actorId],
        );
        parentId = Number(parentResult.insertId);
      }
      const panelName = item.actualName || item.partName || item.positionCode || item.partNumber || item.panelName;
      const [existingPanelRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT id FROM master_panels
          WHERE car_id = ? AND parent_id = ?
            AND COALESCE(component_name, section) = ?
            AND name = ?
            AND part_number <=> ?
            AND position_code <=> ?
          LIMIT 1
        `,
        [unitId, parentId, item.componentName, panelName, item.partNumber, item.positionCode],
      );
      let panelId = Number(existingPanelRows[0]?.id ?? 0);
      if (!panelId) {
        const [panelResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO master_panels (
              car_id, component_name, section, name, category, parent_id, part_number, position_code,
              sort_order, qty, qty_normal, initial_condition, notes, is_active, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `,
          [
            unitId, item.componentName, item.componentName, panelName, item.componentName, parentId,
            item.partNumber, item.positionCode, item.sortOrder ?? 0, num(item.qtyNormal) ?? 1,
            num(item.qtyNormal), item.conditionStatus, item.notes, actorId, actorId,
          ],
        );
        panelId = Number(panelResult.insertId);
      }
      const referenceMedia = await this.listReferenceMedia(item.catalogReferenceId, connection);
      for (const media of referenceMedia) {
        const [existingMediaRows] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM master_panel_media WHERE panel_id = ? AND source_catalog_reference_media_id = ? LIMIT 1",
          [panelId, media.id],
        );
        if (existingMediaRows[0]) continue;
        await connection.execute(
          `
            INSERT INTO master_panel_media (
              panel_id, file_url, media_type, caption, source_catalog_reference_media_id, created_by
            ) VALUES (?, ?, 'REFERENCE', ?, ?, ?)
          `,
          [panelId, media.fileUrl, media.caption, media.id, actorId],
        );
      }
      if (item.diagramImageUrl) {
        const [existingDiagramRows] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM master_panel_media WHERE panel_id = ? AND media_type = 'REFERENCE' AND file_url = ? LIMIT 1",
          [panelId, item.diagramImageUrl],
        );
        if (!existingDiagramRows[0]) {
        await connection.execute(
          "INSERT INTO master_panel_media (panel_id, file_url, media_type, caption, created_by) VALUES (?, ?, 'REFERENCE', ?, ?)",
          [panelId, item.diagramImageUrl, item.referenceUrl, actorId],
        );
        }
      }
      const [mediaRows] = await connection.query<RowDataPacket[]>(
        "SELECT id, file_url AS fileUrl, caption FROM unit_catalog_item_media WHERE catalog_item_id = ?",
        [itemId],
      );
      for (const media of mediaRows) {
        const [existingMediaRows] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM master_panel_media WHERE panel_id = ? AND source_catalog_media_id = ? LIMIT 1",
          [panelId, media.id],
        );
        if (existingMediaRows[0]) continue;
        await connection.execute(
          `
            INSERT INTO master_panel_media (panel_id, file_url, media_type, caption, source_catalog_media_id, created_by)
            VALUES (?, ?, 'ACTUAL', ?, ?, ?)
          `,
          [panelId, media.fileUrl, media.caption ?? null, media.id, actorId],
        );
      }
      await connection.execute("UPDATE unit_catalog_items SET promoted_panel_id = ? WHERE id = ?", [panelId, itemId]);
      await this.refreshPanelStatus(connection, unitId, panelId);
      return { panelId, alreadyPromoted: false };
  }

  async getPanel(unitId: string, panelId: number) {
    const [rows] = await this.poolFactory(this.env).query<RowDataPacket[]>(
      `
        SELECT id, car_id AS carId, COALESCE(component_name, section) AS componentName,
               name, parent_id AS parentId, part_number AS partNumber, position_code AS positionCode,
               COALESCE(qty_normal, qty) AS qtyNormal, initial_condition AS initialCondition, notes
        FROM master_panels
        WHERE id = ? AND car_id = ?
        LIMIT 1
      `,
      [panelId, unitId],
    );
    const panel = rows[0] ?? null;
    if (!panel) {
      return null;
    }

    const [mediaRows] = await this.poolFactory(this.env).query<RowDataPacket[]>(
      `
        SELECT id, panel_id AS panelId, file_url AS fileUrl, media_type AS mediaType,
               caption, source_catalog_media_id AS sourceCatalogMediaId,
               source_catalog_reference_media_id AS sourceCatalogReferenceMediaId,
               created_by AS createdBy, created_at AS createdAt
        FROM master_panel_media
        WHERE panel_id = ?
        ORDER BY created_at, id
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
        ORDER BY created_at, id
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
            countdownId, unitId, job.divisionId, job.picPlan, job.requiredGrade, job.standardHours,
            job.targetHoursInitial, job.taskCategory, panelId, job.description,
            job.jobTypeId, job.targetHoursInitial, job.targetHoursInitial, job.targetHoursInitial,
            job.startDate, job.deadlineDate,
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

  private async listReferenceMedia(referenceId: number, db: Queryable = this.poolFactory(this.env)) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
        SELECT id, catalog_reference_id AS catalogReferenceId, file_url AS fileUrl, caption,
               sort_order AS sortOrder, created_by AS createdBy, created_at AS createdAt
        FROM unit_catalog_reference_media
        WHERE catalog_reference_id = ?
        ORDER BY sort_order, id
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
  ): Promise<CatalogItem> {
    const [existing] = await connection.query<RowDataPacket[]>(
      `
        SELECT i.id
        FROM unit_catalog_items i
        JOIN unit_catalog_references r ON r.id = i.catalog_reference_id
        WHERE i.id = ? AND r.car_id = ?
        LIMIT 1
      `,
      [itemId, unitId],
    );
    if (!existing[0]) throw new Error("CATALOG_ITEM_NOT_FOUND");
    await connection.execute(
      `
        UPDATE unit_catalog_items
        SET qty_opname = ?, actual_name = ?, availability_status = ?, condition_status = ?, action_type = ?,
            survey_status = ?, location = ?, notes = ?, surveyed_by = ?, surveyed_at = NOW()
        WHERE id = ?
      `,
      [input.qtyOpname, input.actualName, input.availabilityStatus, input.conditionStatus, input.actionType, surveyStatus, input.location, input.notes, actorId, itemId],
    );
    if (input.mapping) await this.addMapping(connection, itemId, actorId, input.mapping);
    const item = await this.getItem(unitId, itemId, connection);
    if (!item) throw new Error("CATALOG_ITEM_NOT_FOUND");
    return item;
  }
}
