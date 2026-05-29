import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getApiEnv } from "@/config/env";
import { withCors } from "@/http/response";

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

  const publicBase = env.R2_PUBLIC_URL.replace(/\/$/u, "");

  if (!targetUrl.startsWith(publicBase)) {
    return withCors(request, new Response("Forbidden", { status: 403 }));
  }

  // Strip query params (e.g. cache-bust ?t=...) to get the clean S3 key
  const cleanUrl = targetUrl.split("?")[0];
  const objectKey = cleanUrl.slice(publicBase.length + 1);

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
    const byteArray = await res.Body!.transformToByteArray();
    const body = new ArrayBuffer(byteArray.byteLength);
    new Uint8Array(body).set(byteArray);

    return new Response(body, {
      headers: {
        "Content-Type": res.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[proxy] error:", error);
    return withCors(request, new Response("Failed to fetch image", { status: 500 }));
  }
}
