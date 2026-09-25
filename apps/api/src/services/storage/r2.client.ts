import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { ApiEnv } from "@/config/env";

let client: S3Client | null = null;
let cacheKey: string | null = null;

export function getR2Client(env: ApiEnv): S3Client {
  const nextKey = [
    env.R2_ENDPOINT_URL,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
  ].join("|");

  if (client && cacheKey === nextKey) {
    return client;
  }

  client = new S3Client({
    endpoint: env.R2_ENDPOINT_URL,
    region: "auto",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 3_000,
      requestTimeout: 15_000,
    }),
  });
  cacheKey = nextKey;
  return client;
}

export function resetR2ClientForTests(): void {
  client?.destroy();
  client = null;
  cacheKey = null;
}
