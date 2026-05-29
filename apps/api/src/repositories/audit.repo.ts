import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
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
}

export interface AuditRepository {
  insert(entry: AuditLogEntry): Promise<void>;
}

function getAuditTableName(auditDbName: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(auditDbName)) {
    throw new Error(`Invalid AUDIT_DB_NAME: ${auditDbName}`);
  }

  return `\`${auditDbName}\`.sm_audit_log`;
}

export class MySqlAuditRepository implements AuditRepository {
  constructor(
    private readonly poolFactory: (env?: ApiEnv) => Pick<Pool, "execute"> = getMySqlPool,
    private readonly env: ApiEnv = getApiEnv(),
  ) {}

  async insert(entry: AuditLogEntry): Promise<void> {
    const pool = this.poolFactory(this.env);
    const tableName = getAuditTableName(this.env.AUDIT_DB_NAME);

    await pool.execute(
      `
        INSERT INTO ${tableName} (
          id,
          actor_id,
          actor_name,
          action,
          module,
          record_id,
          old_value,
          new_value,
          ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        entry.actorId,
        entry.actorName,
        entry.action,
        entry.module,
        entry.recordId ?? null,
        entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.ipAddress ?? null,
      ],
    );
  }
}
