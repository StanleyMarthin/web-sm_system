import { normalizeNotificationItem } from "@smsystem/contracts/notification";
import { permissionCodes } from "@smsystem/permissions";
import { getApiEnv } from "@/config/env";
import { errorResponse, successResponse } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import { requirePermission } from "@/middleware/permission.middleware";
import type { AuthService } from "@/services/auth/auth.service";

type Fetch = (request: Request) => Promise<Response>;

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function handleNotificationsRoute(
  request: Request,
  authService: AuthService,
  fetcher: Fetch = fetch,
  loginBaseUrl = getApiEnv().SM_LOGIN_BASE_URL,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;
  const permissionResult = requirePermission(
    request,
    sessionResult.session,
    permissionCodes.listNotifications,
  );
  if ("response" in permissionResult) return permissionResult.response;

  const requestUrl = new URL(request.url);
  const page = positiveInt(requestUrl.searchParams.get("page"), 1);
  const limit = Math.min(positiveInt(requestUrl.searchParams.get("limit"), 10), 50);
  const upstreamUrl = new URL("api/v1/notifications", `${loginBaseUrl.replace(/\/$/u, "")}/`);
  upstreamUrl.search = new URLSearchParams({
    employee_id: sessionResult.session.user.employeeId,
    page: String(page),
    limit: String(limit),
  }).toString();

  try {
    const upstream = await fetcher(new Request(upstreamUrl, {
      headers: { Authorization: `Bearer ${sessionResult.session.mobileSessionKey}` },
    }));
    if (!upstream.ok) throw new Error("UPSTREAM_RESPONSE");

    const body = await upstream.json() as { data?: unknown };
    const items = Array.isArray(body.data) ? body.data.map(normalizeNotificationItem) : [];
    return successResponse(request, "Notifikasi berhasil dimuat.", {
      notifications: items,
      page,
      limit,
    });
  } catch {
    return errorResponse(
      request,
      "Notifikasi belum bisa dimuat saat ini.",
      502,
      "NOTIFICATION_GATEWAY_FAILED",
    );
  }
}
