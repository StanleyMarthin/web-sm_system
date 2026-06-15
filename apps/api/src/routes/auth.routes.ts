import { loginRequestSchema } from "@smsystem/contracts/auth";
import type { AuthService } from "@/services/auth/auth.service";
import { parseJsonBody } from "@/http/request";
import { errorResponse, noContentResponse, successResponse } from "@/http/response";
import {
  isCredentialFailure,
  recordActiveSessionWarning,
  recordLoginFailure,
  resetLoginFailures,
} from "@/services/auth/login-attempts";

function appendCookies(response: Response, cookies: string[]): Response {
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}

export async function handleLoginRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const parsedBody = await parseJsonBody(request, loginRequestSchema);
  if (!parsedBody.success) {
    return parsedBody.response;
  }

  try {
    const result = await authService.login(request, parsedBody.data);
    await resetLoginFailures(parsedBody.data.employeeId);
    const response = successResponse(request, "Login berhasil", {
      user: result.user,
    });

    return appendCookies(response, result.cookies);
  } catch (error) {
    if (isCredentialFailure(error)) {
      const loginBlock = await recordLoginFailure(parsedBody.data.employeeId);
      if (loginBlock) {
        return errorResponse(
          request,
          loginBlock.message,
          loginBlock.errorCode === "ACCOUNT_DISABLED" ? 403 : 429,
          loginBlock.errorCode,
          {
            retryAfterSeconds: loginBlock.retryAfterSeconds,
          },
        );
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "errorCode" in error &&
      "message" in error
    ) {
      const adapterError = error as {
        status: number;
        errorCode: string;
        message: string;
        data?: Record<string, unknown>;
      };

      if (adapterError.errorCode === "ACTIVE_SESSION_EXISTS") {
        const warningBlock = await recordActiveSessionWarning(parsedBody.data.employeeId);
        if (warningBlock) {
          return errorResponse(
            request,
            warningBlock.message,
            warningBlock.errorCode === "ACCOUNT_DISABLED" ? 403 : 429,
            warningBlock.errorCode,
            {
              retryAfterSeconds: warningBlock.retryAfterSeconds,
            },
          );
        }
      }

      return errorResponse(
        request,
        adapterError.message,
        adapterError.status,
        adapterError.errorCode,
        adapterError.data ?? {},
      );
    }

    console.error("[auth] login failed", error);

    return errorResponse(
      request,
      "Terjadi kesalahan internal saat login.",
      500,
      "AUTH_LOGIN_FAILED",
    );
  }
}

export async function handleLogoutRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const cookies = await authService.logout(request);
  const headers = new Headers();
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return noContentResponse(request, headers);
}

export async function handleRefreshRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  try {
    const result = await authService.refresh(request);
    const response = successResponse(request, "Refresh berhasil", {
      user: result.user,
    });

    return appendCookies(response, result.cookies);
  } catch (error) {
    if (error instanceof Error && error.message === "REFRESH_TOKEN_REQUIRED") {
      return errorResponse(
        request,
        "Refresh token tidak ditemukan.",
        401,
        "INVALID_REFRESH_TOKEN",
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "errorCode" in error &&
      "message" in error
    ) {
      const adapterError = error as {
        status: number;
        errorCode: string;
        message: string;
        data?: Record<string, unknown>;
      };

      return errorResponse(
        request,
        adapterError.message,
        adapterError.status,
        adapterError.errorCode,
        adapterError.data ?? {},
      );
    }

    return errorResponse(
      request,
      "Terjadi kesalahan internal saat refresh sesi.",
      500,
      "AUTH_REFRESH_FAILED",
    );
  }
}

export async function handleMeRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const user = await authService.getCurrentUser(request);
  if (!user) {
    return errorResponse(
      request,
      "Sesi tidak valid atau sudah berakhir.",
      401,
      "INVALID_SESSION",
    );
  }

  return successResponse(request, "User aktif ditemukan", {
    user,
  });
}

export async function handlePermissionsRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const permissions = await authService.getCurrentPermissions(request);
  if (!permissions) {
    return errorResponse(
      request,
      "Sesi tidak valid atau sudah berakhir.",
      401,
      "INVALID_SESSION",
    );
  }

  return successResponse(request, "Permissions loaded", {
    permissions,
  });
}
