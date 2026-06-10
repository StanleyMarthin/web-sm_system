"use client";

import { CSRF_COOKIE_NAME, authEnvelopeSchema } from "@smsystem/contracts/auth";
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

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
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
  try {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrfToken
        ? {
            "X-CSRF-Token": csrfToken,
          }
        : undefined,
    });

    return response.ok;
  } catch {
    return false;
  }
}
