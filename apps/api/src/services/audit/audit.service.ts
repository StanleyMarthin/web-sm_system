import type { AuditLogEntry, AuditRepository } from "@/repositories/audit.repo";

export interface AuditService {
  log(entry: AuditLogEntry): Promise<void>;
}

export class AuditLogService implements AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.repository.insert(entry);
    } catch (error) {
      console.error("[audit] failed to write audit log", error);
    }
  }
}

export class DefaultAuditService extends AuditLogService {}
