import type { ZodSchema } from "zod";
import { withCors } from "@/http/response";

const DEFAULT_JSON_BODY_LIMIT_BYTES = 1024 * 1024;

interface ParseJsonBodyOptions {
  maxBytes?: number;
}

function jsonErrorResponse(
  request: Request,
  message: string,
  status: number,
  errorCode: string,
  data: Record<string, unknown> = {},
): Response {
  return withCors(
    request,
    Response.json(
      {
        success: false,
        message,
        errorCode,
        data,
      },
      { status },
    ),
  );
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

function getContentLength(request: Request): number | null {
  const rawContentLength = request.headers.get("content-length");
  if (!rawContentLength) {
    return null;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);
  return Number.isFinite(contentLength) ? contentLength : null;
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
  options: ParseJsonBodyOptions = {},
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      success: false,
      response: jsonErrorResponse(
        request,
        "Content-Type harus application/json.",
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      ),
    };
  }

  const contentLength = getContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    return {
      success: false,
      response: jsonErrorResponse(
        request,
        "Request body terlalu besar.",
        413,
        "REQUEST_BODY_TOO_LARGE",
      ),
    };
  }

  let payload: unknown;

  try {
    const rawBody = await request.text();
    const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
    if (rawBodyBytes > maxBytes) {
      return {
        success: false,
        response: jsonErrorResponse(
          request,
          "Request body terlalu besar.",
          413,
          "REQUEST_BODY_TOO_LARGE",
        ),
      };
    }

    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: jsonErrorResponse(
        request,
        "Request body tidak valid.",
        400,
        "INVALID_JSON",
      ),
    };
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      success: false,
      response: jsonErrorResponse(
        request,
        "Payload request tidak valid.",
        400,
        "INVALID_PAYLOAD",
        {
          issues: result.error.issues,
        },
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
