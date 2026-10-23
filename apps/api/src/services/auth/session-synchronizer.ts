import type { AuthContextRepository } from "@/repositories/auth-context/auth-context.repo";
import type { SessionStore } from "@/services/auth/session.service";
import type { SmLoginAdapter } from "@/services/auth/sm-login.adapter";

export interface SessionSynchronizer {
  sync(employeeIds: readonly string[]): Promise<void>;
  invalidate(employeeIds: readonly string[]): Promise<void>;
}

export class SessionSynchronizationError extends Error {
  constructor(cause: unknown) {
    super("SESSION_SYNCHRONIZATION_FAILED", { cause });
  }
}

function normalizeEmployeeIds(employeeIds: readonly string[]): string[] {
  return [...new Set(employeeIds.map((employeeId) => employeeId.trim().toUpperCase()).filter(Boolean))];
}

export class DefaultSessionSynchronizer implements SessionSynchronizer {
  constructor(
    private readonly loginAdapter: SmLoginAdapter,
    private readonly authContextRepository: AuthContextRepository,
    private readonly sessionStore: SessionStore,
  ) {}

  async sync(employeeIds: readonly string[]): Promise<void> {
    const ids = normalizeEmployeeIds(employeeIds);
    if (ids.length === 0) {
      return;
    }

    try {
      await this.loginAdapter.syncEmployeeSessions(ids);
      await Promise.all(ids.map((employeeId) => this.syncWebSession(employeeId)));
    } catch (error) {
      throw new SessionSynchronizationError(error);
    }
  }

  async invalidate(employeeIds: readonly string[]): Promise<void> {
    const ids = normalizeEmployeeIds(employeeIds);
    if (ids.length === 0) {
      return;
    }

    try {
      await this.loginAdapter.invalidateEmployeeSessions(ids);
      await Promise.all(ids.map((employeeId) => this.sessionStore.deleteActiveSessionByEmployeeId(employeeId)));
    } catch (error) {
      throw new SessionSynchronizationError(error);
    }
  }

  private async syncWebSession(employeeId: string): Promise<void> {
    const session = await this.sessionStore.getActiveSessionByEmployeeId(employeeId);
    if (!session) {
      return;
    }

    const user = await this.authContextRepository.findByEmployeeId(employeeId);
    if (!user) {
      await this.sessionStore.deleteActiveSessionByEmployeeId(employeeId);
      return;
    }

    await this.sessionStore.updateSessionUser?.(session.sessionKey, user);
  }
}
