import { permissionCodes } from "@smsystem/permissions";
import { getApiEnv } from "@/config/env";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import type { AuthService } from "@/services/auth/auth.service";

const DEFAULT_JOB_PLAN_V2_BASE_URL = "http://108.136.189.225:8083";

type Fetcher = typeof fetch;

function baseUrl(input?: string) {
  return (input?.trim() || getApiEnv().JOB_PLAN_V2_BASE_URL || DEFAULT_JOB_PLAN_V2_BASE_URL).replace(/\/$/u, "");
}

async function bodyWithSessionUser(request: Request, userId: string) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_PAYLOAD");
  }

  return JSON.stringify({
    ...payload,
    userId,
  });
}

function hasJobPlanV2Access(permissions: readonly string[]) {
  return (
    permissions.includes(permissionCodes.updatePlan) ||
    permissions.includes(permissionCodes.taskExecute) ||
    permissions.includes(permissionCodes.taskView) ||
    permissions.includes(permissionCodes.reviewTask)
  );
}

export async function handleJobPlanV2ProxyRoute(
  request: Request,
  path: string,
  authService: AuthService,
  fetcher: Fetcher = fetch,
  upstreamBaseUrl?: string,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) return sessionResult.response;

  const user = sessionResult.session.user;
  if (!hasJobPlanV2Access(user.permissions)) {
    return errorResponse(request, "Anda belum memiliki akses Job Plan V2.", 403, "JOB_PLAN_V2_FORBIDDEN");
  }

  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "HEAD") {
    url.searchParams.set("userId", user.employeeId);
  } else {
    url.searchParams.delete("userId");
  }
  const upstreamPath = path ? `/${path.replace(/^\/+/u, "")}` : "";
  const upstreamUrl = `${baseUrl(upstreamBaseUrl)}/sm/job-plans/v2${upstreamPath}${url.search}`;

  let body: BodyInit | undefined;
  try {
    body = await bodyWithSessionUser(request, user.employeeId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "INVALID_PAYLOAD" ? "Payload request tidak valid." : "Request body tidak valid.",
      400,
      code,
    );
  }

  const upstream = await fetcher(upstreamUrl, {
    method: request.method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });

  return withCors(
    request,
    new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    }),
  );
}
