import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getApiEnv } from "@/config/env";
import { withCors } from "@/http/response";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/u, "");
}

export async function handleImageProxyRoute(
  request: Request,
): Promise<Response> {
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get("url");

  if (!targetUrl) {
    return withCors(request, new Response("Missing url parameter", { status: 400 }));
  }

  const env = getApiEnv();
  if (!env.R2_PUBLIC_URL || !env.R2_ENDPOINT_URL || !env.R2_BUCKET_NAME) {
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
    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
    });

    const res = await s3.send(command);
    const contentType = res.ContentType || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return withCors(request, new Response("Unsupported media type", { status: 415 }));
    }

    const byteArray = await res.Body!.transformToByteArray();
    const body = new ArrayBuffer(byteArray.byteLength);
    new Uint8Array(body).set(byteArray);

    return withCors(request, new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    }));
  } catch (error) {
    console.error("[proxy] image fetch failed");
    return withCors(request, new Response("Failed to fetch image", { status: 500 }));
  }
}
