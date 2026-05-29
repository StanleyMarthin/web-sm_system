import { z } from "zod";
import { getApiEnv } from "@/config/env";

const mobileEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errorCode: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

const loginSuccessSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: z.object({
    employeeId: z.string(),
  }),
});

const refreshSuccessSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: z.object({
    employeeId: z.string(),
  }),
});

export interface LoginWebParams {
  employeeId: string;
  password: string;
  deviceId: string;
  force: boolean;
}

export interface RefreshWebParams {
  refreshToken: string;
  deviceId: string;
}

export interface MobileAuthSuccess {
  employeeId: string;
  mobileSessionKey: string;
  refreshToken: string;
}

export class SmLoginAdapterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface SmLoginAdapter {
  loginWeb(params: LoginWebParams): Promise<MobileAuthSuccess>;
  refresh(params: RefreshWebParams): Promise<MobileAuthSuccess>;
}

async function parseEnvelope(response: Response) {
  const payload = await response.json();
  return mobileEnvelopeSchema.parse(payload);
}

function buildSuccess(payload: z.infer<typeof loginSuccessSchema>): MobileAuthSuccess {
  return {
    employeeId: payload.user.employeeId,
    mobileSessionKey: payload.token,
    refreshToken: payload.refreshToken,
  };
}

export class HttpSmLoginAdapter implements SmLoginAdapter {
  async loginWeb(params: LoginWebParams): Promise<MobileAuthSuccess> {
    const env = getApiEnv();
    const response = await fetch(`${env.SM_LOGIN_BASE_URL}/api/v1/auth/login-web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const envelope = await parseEnvelope(response);
    if (!response.ok || !envelope.success) {
      throw new SmLoginAdapterError(
        envelope.message,
        response.status,
        envelope.errorCode ?? "AUTH_LOGIN_FAILED",
        envelope.data,
      );
    }

    return buildSuccess(loginSuccessSchema.parse(envelope.data));
  }

  async refresh(params: RefreshWebParams): Promise<MobileAuthSuccess> {
    const env = getApiEnv();
    const response = await fetch(`${env.SM_LOGIN_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const envelope = await parseEnvelope(response);
    if (!response.ok || !envelope.success) {
      throw new SmLoginAdapterError(
        envelope.message,
        response.status,
        envelope.errorCode ?? "AUTH_REFRESH_FAILED",
        envelope.data,
      );
    }

    return buildSuccess(refreshSuccessSchema.parse(envelope.data));
  }
}
