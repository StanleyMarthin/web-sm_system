import type { HealthCheck, HealthReport } from "@smsystem/contracts/health";
import { probeMySql } from "@/db/mysql";
import { probeRedis } from "@/redis/client";

export interface HealthDependencies {
  serviceName?: string;
  now?: () => string;
  probeTimeoutMs?: number;
  checkDatabase?: () => Promise<HealthCheck>;
  checkRedis?: () => Promise<HealthCheck>;
}

function getReportStatus(checks: HealthCheck[]): HealthReport["status"] {
  return checks.every((check) => check.status === "ok") ? "ok" : "degraded";
}

async function withProbeTimeout(
  name: string,
  timeoutMs: number,
  probe: () => Promise<HealthCheck>,
): Promise<HealthCheck> {
  const timeoutResult = new Promise<HealthCheck>((resolve) => {
    setTimeout(() => {
      resolve({
        name,
        status: "error",
        latencyMs: timeoutMs,
        detail: `Probe timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);
  });

  return Promise.race([probe(), timeoutResult]);
}

export async function getHealthReport(dependencies: HealthDependencies = {}): Promise<HealthReport> {
  const checkDatabase = dependencies.checkDatabase ?? probeMySql;
  const checkRedis = dependencies.checkRedis ?? probeRedis;
  const probeTimeoutMs = dependencies.probeTimeoutMs ?? 1_500;

  const [database, redis] = await Promise.all([
    withProbeTimeout("database", probeTimeoutMs, checkDatabase),
    withProbeTimeout("redis", probeTimeoutMs, checkRedis),
  ]);
  const checks: HealthCheck[] = [
    {
      name: "app",
      status: "ok",
      latencyMs: 0,
    },
    database,
    redis,
  ];

  return {
    service: dependencies.serviceName ?? "smsystem-bun-api",
    status: getReportStatus(checks),
    timestamp: dependencies.now?.() ?? new Date().toISOString(),
    checks,
  };
}

export async function handleHealthRequest(
  dependencies: HealthDependencies = {},
): Promise<Response> {
  const report = await getHealthReport(dependencies);

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
  });
}
