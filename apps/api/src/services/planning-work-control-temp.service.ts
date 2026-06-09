import type {
  CriticalPathSnapshotBody,
  LabourOverrideBody,
  ServiceTemplate,
} from "@smsystem/contracts/planning-work-control";
import type { RedisClientType } from "redis";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { getRedisClient } from "@/redis/client";
import { getMySqlPool } from "@/db/mysql";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

interface ServiceIntakeDraft {
  intakeId: string;
  status: "DRAFT";
  unitId: string;
  diagnosis: string;
  templateIds: string[];
  totalEstimatedHours: number;
  capacityStatus: "SPK_READY" | "SPK_WITH_SPL" | "TARGET_PERLU_DIREVISI";
  targetFinishDate: string;
  createdBy: string;
  createdAt: string;
}

interface ServiceTemplateRow extends RowDataPacket {
  id: string;
  name: string;
  divisionId: number;
  divisionName: string | null;
  estimatedHours: number | null;
  sampleCount: number | null;
}

export interface PlanningWorkControlTempStore {
  listServiceTemplates(): Promise<ServiceTemplate[]>;
  createServiceIntakeDraft(
    input: Omit<ServiceIntakeDraft, "intakeId" | "status" | "createdAt">,
  ): Promise<{ intakeId: string; status: "DRAFT" }>;
  saveCriticalPathSnapshot(
    input: CriticalPathSnapshotBody & { savedBy: string },
  ): Promise<{ unitId: string; savedAt: string }>;
  getLabourOverride(unitId: string): Promise<LabourOverrideBody | null>;
  saveLabourOverride(
    input: LabourOverrideBody & { savedBy: string },
  ): Promise<{ unitId: string; savedAt: string }>;
}

function key(name: string): string {
  return `planning:work-control:${name}`;
}

function unitKey(name: string, unitId: string): string {
  return `planning:work-control:${name}:${unitId}`;
}

export class RedisPlanningWorkControlTempStore implements PlanningWorkControlTempStore {
  constructor(
    private readonly clientFactory: () => Promise<RedisClientType> = getRedisClient,
    private readonly poolFactory: () => Pool = getMySqlPool,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  async listServiceTemplates(): Promise<ServiceTemplate[]> {
    const client = await this.clientFactory();
    const raw = await client.get(key("service-templates"));
    if (raw) {
      return JSON.parse(raw) as ServiceTemplate[];
    }

    const templates = await this.listServiceTemplatesFromMasterJobTypes();
    if (templates.length > 0) {
      await client.set(key("service-templates"), JSON.stringify(templates), {
        expiration: { type: "EX", value: this.ttlSeconds },
      });
    }
    return templates;
  }

  private async listServiceTemplatesFromMasterJobTypes(): Promise<ServiceTemplate[]> {
    const pool = this.poolFactory();
    const [rows] = (await pool.query(
      `
        SELECT
          mjt.id AS id,
          COALESCE(mjt.job_name, mjt.id) AS name,
          mjt.division_id AS divisionId,
          d.name AS divisionName,
          ROUND(AVG(COALESCE(
            cd.target_hours_revised,
            cd.target_hours_initial + cd.time_extension_hours,
            cd.target_hours_initial
          )), 2) AS estimatedHours,
          COUNT(cd.id) AS sampleCount
        FROM master_job_types mjt
        LEFT JOIN sm_divisi d ON d.id = mjt.division_id
        LEFT JOIN sm_jobdesc_countdown cd ON cd.job_type_id = mjt.id
        WHERE mjt.job_name IS NOT NULL
          AND mjt.division_id IS NOT NULL
        GROUP BY mjt.id, mjt.job_name, mjt.division_id, d.name
        HAVING estimatedHours IS NOT NULL
           AND estimatedHours > 0
        ORDER BY d.name ASC, mjt.job_name ASC
        LIMIT 200
      `,
    )) as [ServiceTemplateRow[], unknown];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      divisionId: String(row.divisionId),
      estimatedHours: Number(row.estimatedHours ?? 0),
      applicableConditions: [
        row.divisionName ?? `Divisi ${row.divisionId}`,
        `${Number(row.sampleCount ?? 0)} histori pekerjaan`,
      ],
    }));
  }

  async createServiceIntakeDraft(
    input: Omit<ServiceIntakeDraft, "intakeId" | "status" | "createdAt">,
  ): Promise<{ intakeId: string; status: "DRAFT" }> {
    const intakeId = `SVC-${randomUUID().replace(/-/gu, "").slice(0, 16).toUpperCase()}`;
    const draft: ServiceIntakeDraft = {
      ...input,
      intakeId,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
    const client = await this.clientFactory();
    await client.set(unitKey("service-intake", intakeId), JSON.stringify(draft), {
      expiration: { type: "EX", value: this.ttlSeconds },
    });
    return { intakeId, status: "DRAFT" };
  }

  async saveCriticalPathSnapshot(
    input: CriticalPathSnapshotBody & { savedBy: string },
  ): Promise<{ unitId: string; savedAt: string }> {
    const savedAt = new Date().toISOString();
    const client = await this.clientFactory();
    await client.set(
      unitKey("critical-path-summary", input.unitId),
      JSON.stringify({ ...input, savedAt }),
      { expiration: { type: "EX", value: this.ttlSeconds } },
    );
    return { unitId: input.unitId, savedAt };
  }

  async getLabourOverride(unitId: string): Promise<LabourOverrideBody | null> {
    const client = await this.clientFactory();
    const raw = await client.get(unitKey("labour-override", unitId));
    return raw ? (JSON.parse(raw) as LabourOverrideBody) : null;
  }

  async saveLabourOverride(
    input: LabourOverrideBody & { savedBy: string },
  ): Promise<{ unitId: string; savedAt: string }> {
    const savedAt = new Date().toISOString();
    const client = await this.clientFactory();
    await client.set(unitKey("labour-override", input.unitId), JSON.stringify(input), {
      expiration: { type: "EX", value: this.ttlSeconds },
    });
    return { unitId: input.unitId, savedAt };
  }
}
