import { CSRF_COOKIE_NAME } from "@smsystem/contracts/auth";
import { getApiEnv } from "@/config/env";
import { getCookie } from "@/http/cookies";
import { errorResponse, getAllowedOrigin } from "@/http/response";
import type { AuthService } from "@/services/auth/auth.service";

function isMutatingRequest(request: Request): boolean {
  switch (request.method.toUpperCase()) {
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
      return true;
    default:
      return false;
  }
}

function getOriginGuardEnv() {
  try {
    const apiEnv = getApiEnv();
    return {
      NODE_ENV: apiEnv.NODE_ENV,
      WEB_ALLOWED_ORIGINS: apiEnv.WEB_ALLOWED_ORIGINS,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    return {
      NODE_ENV: process.env.NODE_ENV ?? "development",
      WEB_ALLOWED_ORIGINS: [],
    };
  }
}

export async function enforceCsrfProtection(
  request: Request,
  authService: AuthService,
): Promise<Response | null> {
  if (!isMutatingRequest(request)) {
    return null;
  }

  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin && process.env.NODE_ENV !== "production") {
    return null;
  }

  const allowedOrigin = getAllowedOrigin(origin, getOriginGuardEnv());
  if (!allowedOrigin) {
    return errorResponse(
      request,
      "Origin request tidak diizinkan.",
      403,
      "INVALID_ORIGIN",
    );
  }

  if (url.pathname === "/api/auth/login") {
    return null;
  }

  const session = await authService.getCurrentSession(request);
  if (!session) {
    return null;
  }

  const headerToken = request.headers.get("x-csrf-token")?.trim() ?? "";
  const cookieToken = getCookie(request, CSRF_COOKIE_NAME)?.trim() ?? "";
  if (
    !session.csrfToken ||
    !headerToken ||
    !cookieToken ||
    headerToken !== cookieToken ||
    headerToken !== session.csrfToken
  ) {
    return errorResponse(
      request,
      "Token CSRF tidak valid atau sudah kedaluwarsa.",
      403,
      "INVALID_CSRF_TOKEN",
    );
  }

  return null;
}
