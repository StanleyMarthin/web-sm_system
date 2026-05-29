"use client";

import { authEnvelopeSchema } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiEnvelope {
  success: boolean;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

async function parseApiEnvelope(response: Response): Promise<ApiEnvelope> {
  try {
    const payload = (await response.json()) as ApiEnvelope;
    return payload;
  } catch {
    return {
      success: false,
      message: "Respons dari server tidak valid.",
      errorCode: "INVALID_RESPONSE",
    };
  }
}

export async function loginWithPassword(input: {
  employeeId: string;
  password: string;
  force: boolean;
}) {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        employeeId: input.employeeId.trim(),
      }),
    });
  } catch {
    return {
      success: false as const,
      message: "Layanan login tidak dapat dihubungi. Coba beberapa saat lagi.",
      errorCode: "AUTH_SERVICE_UNAVAILABLE",
      data: {},
    };
  }

  const envelope = await parseApiEnvelope(response);
  if (!response.ok || !envelope.success) {
    return {
      success: false as const,
      message: envelope.message || "Terjadi kesalahan saat login.",
      errorCode: envelope.errorCode || "UNKNOWN_ERROR",
      data: envelope.data ?? {},
    };
  }

  return {
    success: true as const,
    data: authEnvelopeSchema.parse(envelope).data,
  };
}

export async function logoutFromWeb() {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  return response.ok;
}
