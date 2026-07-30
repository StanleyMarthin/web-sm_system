import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@smsystem/contracts/auth";
import { generateUrlRequestSchema } from "@/shared/api/spf-contracts";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Body request harus berupa JSON.");
  }

  const parsed = generateUrlRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      `${issue?.path.join(".") || "body"}: ${issue?.message || "Data tidak valid"}`,
    );
  }

  const upstreamBaseUrl = process.env.SPF_API_INTERNAL_URL?.trim().replace(/\/$/u, "");
  if (!upstreamBaseUrl) {
    return errorResponse(503, "SPF_NOT_CONFIGURED", "Backend SPF belum dikonfigurasi.");
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin) {
    try {
      const originHost = new URL(requestOrigin).host;
      const serverHost = request.headers.get("host") ?? request.nextUrl.host;
      if (originHost !== serverHost) {
        return errorResponse(403, "INVALID_ORIGIN", "Origin request tidak diizinkan.");
      }
    } catch {
      return errorResponse(403, "INVALID_ORIGIN", "Origin request tidak valid.");
    }
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  const csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";
  const deviceId = request.cookies.get("sm_device_id")?.value ?? "";

  const cookieHeader = [
    sessionCookie && `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionCookie)}`,
    csrfToken && `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
    deviceId && `sm_device_id=${encodeURIComponent(deviceId)}`,
  ].filter(Boolean).join("; ");

  try {
    const upstream = await fetch(`${upstreamBaseUrl}/api/generate_url`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(requestOrigin ? { origin: requestOrigin } : {}),
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const upstreamData = await upstream.json().catch(() => null);
    return NextResponse.json(upstreamData, { status: upstream.status });
  } catch {
    return errorResponse(502, "SPF_UPSTREAM_UNAVAILABLE", "Backend SPF tidak dapat dijangkau.");
  }
}
