import { createApiFetchHandler } from "@/app";
import { getApiEnv } from "@/config/env";
import { assertSessionCryptoKeyConfigured } from "@/services/auth/session.service";

const env = getApiEnv();
assertSessionCryptoKeyConfigured(env);

if (typeof Bun === "undefined") {
  throw new Error("Bun runtime is required to start the API server.");
}

const server = Bun.serve({
  hostname: env.API_HOST,
  port: env.API_PORT,
  fetch: createApiFetchHandler(),
});

console.log(`[smsystem-api] listening on http://${server.hostname}:${server.port}`);
