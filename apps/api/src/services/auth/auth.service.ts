import { DEVICE_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@smsystem/contracts/auth";
import type { AuthUser, LoginRequest } from "@smsystem/contracts/auth";
import type { AuthContextRepository } from "@/repositories/auth-context.repo";
import type { AuditService } from "@/services/audit/audit.service";
import type { SessionStore, WebSession } from "@/services/auth/session.service";
import type {
  RefreshWebParams,
  SmLoginAdapter,
} from "@/services/auth/sm-login.adapter";
import { getCookie } from "@/http/cookies";
import { SmLoginAdapterError } from "@/services/auth/sm-login.adapter";
import {
  getLoginAttemptBlock,
  recordActiveSessionWarning,
} from "@/services/auth/login-attempts";

interface LoginResult {
  user: AuthUser;
  cookies: string[];
}

export interface AuthService {
  login(request: Request, body: LoginRequest): Promise<LoginResult>;
  logout(request: Request): Promise<string[]>;
  refresh(request: Request): Promise<LoginResult>;
  getCurrentSession(request: Request): Promise<WebSession | null>;
  getCurrentUser(request: Request): Promise<AuthUser | null>;
  getCurrentPermissions(request: Request): Promise<string[] | null>;
  updateCurrentUserPhotoUrl?(request: Request, photoUrl: string): Promise<void>;
}

function getIpAddress(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function getDeviceId(request: Request): string {
  return getCookie(request, DEVICE_COOKIE_NAME) ?? `web-${crypto.randomUUID()}`;
}

function getRefreshToken(request: Request): string | null {
  return getCookie(request, REFRESH_COOKIE_NAME);
}

export class DefaultAuthService implements AuthService {
  constructor(
    private readonly adapter: SmLoginAdapter,
    private readonly authContextRepository: AuthContextRepository,
    private readonly sessionStore: SessionStore,
    private readonly auditService: AuditService,
  ) {}

  async login(request: Request, body: LoginRequest): Promise<LoginResult> {
    const loginBlock = await getLoginAttemptBlock(body.employeeId);
    if (loginBlock) {
      throw new SmLoginAdapterError(
        loginBlock.message,
        loginBlock.errorCode === "ACCOUNT_DISABLED" ? 403 : 429,
        loginBlock.errorCode,
        {
          retryAfterSeconds: loginBlock.retryAfterSeconds,
        },
      );
    }

    const deviceId = getDeviceId(request);
    const mobileSession = await this.adapter.loginWeb({
      employeeId: body.employeeId,
      password: body.password,
      deviceId,
      force: body.force ?? false,
    });

    const employeeId = mobileSession.employeeId.toUpperCase();
    const existingSession = await this.sessionStore.getSessionFromRequest(request);
    const activeSession = await this.sessionStore.getActiveSessionByEmployeeId(employeeId);
    const isAnotherActiveSession =
      activeSession !== null && activeSession.sessionKey !== existingSession?.sessionKey;

    if (isAnotherActiveSession) {
      if (!body.force) {
        const warningBlock = await recordActiveSessionWarning(employeeId);
        if (warningBlock) {
          throw new SmLoginAdapterError(
            warningBlock.message,
            warningBlock.errorCode === "ACCOUNT_DISABLED" ? 403 : 429,
            warningBlock.errorCode,
            {
              retryAfterSeconds: warningBlock.retryAfterSeconds,
            },
          );
        }

        throw new SmLoginAdapterError(
          "Akun ini sedang login di perangkat Web lain. Apakah Anda ingin melanjutkan dan logout dari perangkat tersebut?",
          409,
          "ACTIVE_SESSION_EXISTS",
          {},
        );
      }

      await this.sessionStore.deleteActiveSessionByEmployeeId(employeeId);
    }

    if (existingSession) {
      await this.sessionStore.deleteSessionByKey(existingSession.sessionKey);
    }

    const user = await this.authContextRepository.findByEmployeeId(
      mobileSession.employeeId,
    );
    if (!user) {
      throw new Error("Authenticated user context was not found.");
    }

    const session = await this.sessionStore.createSession({
      user,
      refreshToken: mobileSession.refreshToken,
      mobileSessionKey: mobileSession.mobileSessionKey,
      deviceId,
      userAgent: request.headers.get("user-agent"),
      ipAddress: getIpAddress(request),
    });

    await this.auditService.log({
      actorId: user.employeeId,
      actorName: user.fullName,
      action: "auth.login",
      module: "auth",
      recordId: user.employeeId,
      newValue: {
        employeeId: user.employeeId,
        deviceId,
      },
      ipAddress: getIpAddress(request),
    });

    return {
      user: session.user,
      cookies: this.sessionStore.buildLoginCookies(session),
    };
  }

  async logout(request: Request): Promise<string[]> {
    const session = await this.sessionStore.getSessionFromRequest(request);
    if (session) {
      await this.sessionStore.deleteSessionByKey(session.sessionKey);

      await this.auditService.log({
        actorId: session.user.employeeId,
        actorName: session.user.fullName,
        action: "auth.logout",
        module: "auth",
        recordId: session.user.employeeId,
        oldValue: {
          sessionKey: session.sessionKey,
        },
        ipAddress: getIpAddress(request),
      });
    }

    return this.sessionStore.buildLogoutCookies();
  }

  async refresh(request: Request): Promise<LoginResult> {
    const refreshToken = getRefreshToken(request);
    if (!refreshToken) {
      throw new Error("REFRESH_TOKEN_REQUIRED");
    }

    const existingSession = await this.sessionStore.getSessionFromRequest(request);
    if (existingSession) {
      await this.sessionStore.deleteSessionByKey(existingSession.sessionKey);
    }

    const deviceId = getDeviceId(request);
    const mobileSession = await this.adapter.refresh({
      refreshToken,
      deviceId,
    } satisfies RefreshWebParams);

    const user = await this.authContextRepository.findByEmployeeId(
      mobileSession.employeeId,
    );
    if (!user) {
      throw new Error("Authenticated user context was not found.");
    }

    const session = await this.sessionStore.createSession({
      user,
      refreshToken: mobileSession.refreshToken,
      mobileSessionKey: mobileSession.mobileSessionKey,
      deviceId,
      userAgent: request.headers.get("user-agent"),
      ipAddress: getIpAddress(request),
    });

    await this.auditService.log({
      actorId: user.employeeId,
      actorName: user.fullName,
      action: "auth.refresh",
      module: "auth",
      recordId: user.employeeId,
      newValue: {
        employeeId: user.employeeId,
        sessionKey: session.sessionKey,
      },
      ipAddress: getIpAddress(request),
    });

    return {
      user: session.user,
      cookies: this.sessionStore.buildLoginCookies(session),
    };
  }

  async getCurrentSession(request: Request): Promise<WebSession | null> {
    return this.sessionStore.getSessionFromRequest(request);
  }

  async getCurrentUser(request: Request): Promise<AuthUser | null> {
    return (await this.getCurrentSession(request))?.user ?? null;
  }

  async updateCurrentUserPhotoUrl(request: Request, photoUrl: string): Promise<void> {
    const session = await this.getCurrentSession(request);
    if (!session) {
      return;
    }

    await this.sessionStore.updateSessionUser?.(session.sessionKey, {
      ...session.user,
      photoUrl,
    });
  }

  async getCurrentPermissions(request: Request): Promise<string[] | null> {
    const user = await this.getCurrentUser(request);
    return user?.permissions ?? null;
  }
}
