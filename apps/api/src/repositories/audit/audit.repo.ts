import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getApiEnv, type ApiEnv } from "@/config/env";
import { getMySqlPool } from "@/db/mysql";

export interface AuditLogEntry {
  actorId: string | null;
  actorName: string;
  action: string;
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditRepository {
  insert(entry: AuditLogEntry): Promise<void>;
}

export interface RoleHistoryEntry {
  id: number;
  actorName: string | null;
  action: string;
  createdAt: string;
  oldValue: unknown;
  newValue: unknown;
}

function getAuditTableName(auditDbName: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(auditDbName)) {
    throw new Error(`Invalid AUDIT_DB_NAME: ${auditDbName}`);
  }

  return `\`${auditDbName}\`.log_audit_trails`;
}

function toLegacyAuditAction(action: string): "INSERT" | "UPDATE" | "DELETE" {
  const normalized = action.toLowerCase();

  if (/\b(create|import|generate|submit|publish|release|store)\b/u.test(normalized)) {
    return "INSERT";
  }

  if (/\b(delete|deactivate|cancel)\b/u.test(normalized)) {
    return "DELETE";
  }

  return "UPDATE";
}

export class MySqlAuditRepository implements AuditRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pick<Pool, "execute"> = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async listRoleHistory(roleId: number): Promise<RoleHistoryEntry[]> {
    const pool = this.poolFactory(this.env);
    const [rows] = await pool.execute<Array<RowDataPacket & RoleHistoryEntry>>(
      `SELECT id, performed_name AS actorName, COALESCE(change_reason, action) AS action,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        old_data AS oldValue, new_data AS newValue
       FROM ${getAuditTableName(this.env.AUDIT_DB_NAME)}
       WHERE source_db = ? AND table_name = 'rbac' AND record_id = ?
       ORDER BY id DESC LIMIT 100`,
      [this.env.DB_NAME, String(roleId)],
    );
    return rows.map((row) => ({ id: row.id, actorName: row.actorName, action: row.action, createdAt: row.createdAt, oldValue: row.oldValue, newValue: row.newValue }));
  }

  async insert(entry: AuditLogEntry): Promise<void> {
    const pool = this.poolFactory(this.env);
    const tableName = getAuditTableName(this.env.AUDIT_DB_NAME);

    await pool.execute(
      `
        INSERT INTO ${tableName} (
          source_db,
          table_name,
          record_id,
          action,
          performed_by,
          performed_name,
          performed_role,
          old_data,
          new_data,
          change_reason,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        this.env.DB_NAME,
        entry.module,
        entry.recordId ?? randomUUID(),
        toLegacyAuditAction(entry.action),
        entry.actorId,
        entry.actorName,
        null,
        entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.action,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ],
    );
  }
}
