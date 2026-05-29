import { getApiEnv, type ApiEnv } from "@/config/env";

interface CorsEnv {
  NODE_ENV: string;
  WEB_ALLOWED_ORIGINS: string[];
}

function isAllowedDevOrigin(origin: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(origin);
}

function getAllowedOrigin(origin: string | null, env: CorsEnv): string | null {
  if (!origin) {
    return null;
  }

  if (env.NODE_ENV !== "production" && isAllowedDevOrigin(origin)) {
    return origin;
  }

  return env.WEB_ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

export function withCors(
  request: Request,
  response: Response,
  env?: CorsEnv,
): Response {
  const resolvedEnv =
    env ??
    (() => {
      try {
        const apiEnv = getApiEnv();
        return {
          NODE_ENV: apiEnv.NODE_ENV,
          WEB_ALLOWED_ORIGINS: apiEnv.WEB_ALLOWED_ORIGINS,
        } satisfies CorsEnv;
      } catch {
        return {
          NODE_ENV: process.env.NODE_ENV ?? "development",
          WEB_ALLOWED_ORIGINS: [],
        } satisfies CorsEnv;
      }
    })();

  const origin = getAllowedOrigin(request.headers.get("origin"), resolvedEnv);
  if (!origin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export function successResponse(
  request: Request,
  message: string,
  data: Record<string, unknown>,
  init: ResponseInit = {},
): Response {
  const response = Response.json(
    {
      success: true,
      message,
      data,
    },
    {
      status: init.status ?? 200,
      headers: init.headers,
    },
  );

  return withCors(request, response);
}

export function errorResponse(
  request: Request,
  message: string,
  status: number,
  errorCode: string,
  data: Record<string, unknown> = {},
): Response {
  const response = Response.json(
    {
      success: false,
      message,
      errorCode,
      data,
    },
    { status },
  );

  return withCors(request, response);
}

export function noContentResponse(request: Request, headers?: Headers): Response {
  const response = new Response(null, {
    status: 204,
    headers,
  });

  return withCors(request, response);
}

export function preflightResponse(request: Request): Response {
  const env: CorsEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    WEB_ALLOWED_ORIGINS: [],
  };

  try {
    const apiEnv = getApiEnv();
    env.NODE_ENV = apiEnv.NODE_ENV;
    env.WEB_ALLOWED_ORIGINS = apiEnv.WEB_ALLOWED_ORIGINS;
  } catch {
    // Fall back to development-safe defaults for tests and bootstrap cases.
  }

  const response = new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

  return withCors(request, response, env);
}
