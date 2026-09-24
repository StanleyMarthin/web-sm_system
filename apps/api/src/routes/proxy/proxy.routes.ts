import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getApiEnv } from "@/config/env";
import { errorResponse, withCors } from "@/http/response";
import { requireSession } from "@/middleware/auth.middleware";
import type { AuthService } from "@/services/auth/auth.service";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/security/upload-ticket";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

export async function handleImageProxyRoute(
  request: Request,
  authService: AuthService,
): Promise<Response> {
  const sessionResult = await requireSession(request, authService);
  if ("response" in sessionResult) {
    return sessionResult.response;
  }

  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");

  if (!targetUrl) {
    return withCors(request, new Response("Missing url parameter", { status: 400 }));
  }

  const env = getApiEnv();
  if (
    !env.R2_PUBLIC_URL ||
    !env.R2_ENDPOINT_URL ||
    !env.R2_BUCKET_NAME ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  ) {
    return withCors(request, new Response("Storage not configured", { status: 503 }));
  }

  let parsedTargetUrl: URL;
  let publicBaseUrl: URL;
  try {
    parsedTargetUrl = new URL(targetUrl);
    publicBaseUrl = new URL(stripTrailingSlash(env.R2_PUBLIC_URL));
  } catch {
    return withCors(request, new Response("Invalid url parameter", { status: 400 }));
  }

  if (parsedTargetUrl.protocol !== "https:") {
    return withCors(request, new Response("Forbidden", { status: 403 }));
  }

  const publicBasePath = publicBaseUrl.pathname.replace(/\/$/u, "");
  const pathAllowed = publicBasePath
    ? parsedTargetUrl.pathname.startsWith(`${publicBasePath}/`)
    : parsedTargetUrl.pathname.startsWith("/");

  if (parsedTargetUrl.origin !== publicBaseUrl.origin || !pathAllowed) {
    return withCors(request, new Response("Forbidden", { status: 403 }));
  }

  const objectKey = decodeURIComponent(
    publicBasePath
      ? parsedTargetUrl.pathname.slice(publicBasePath.length + 1)
      : parsedTargetUrl.pathname.replace(/^\//u, ""),
  );

  if (!objectKey) {
    return withCors(request, new Response("Invalid key", { status: 400 }));
  }

  const s3 = new S3Client({
    endpoint: env.R2_ENDPOINT_URL,
    region: "auto",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });

  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
      }),
    );
    const rawContentLength = head.ContentLength;
    if (
      typeof rawContentLength !== "number" ||
      !Number.isSafeInteger(rawContentLength) ||
      rawContentLength <= 0
    ) {
      return withCors(request, new Response("Invalid object metadata", { status: 502 }));
    }
    const contentLength = rawContentLength;
    if (contentLength > MAX_IMAGE_UPLOAD_BYTES) {
      return errorResponse(
        request,
        "Ukuran gambar maksimal 10MB.",
        413,
        "IMAGE_TOO_LARGE",
      );
    }

    const contentType = head.ContentType || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return withCors(request, new Response("Unsupported media type", { status: 415 }));
    }

    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
    });

    const res = await s3.send(command);
    const body = res.Body;
    if (!body || typeof body.transformToWebStream !== "function") {
      return withCors(request, new Response("Failed to fetch image", { status: 502 }));
    }

    return withCors(request, new Response(body.transformToWebStream(), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
        "Cache-Control": "public, max-age=86400",
      },
    }));
  } catch (error) {
    console.error("[proxy] image fetch failed");
    return withCors(request, new Response("Failed to fetch image", { status: 500 }));
  }
}
