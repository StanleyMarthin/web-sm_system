export type HealthCheckStatus = "ok" | "error";
export type HealthReportStatus = "ok" | "degraded";

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  latencyMs: number;
  detail?: string;
}

export interface HealthReport {
  service: string;
  status: HealthReportStatus;
  timestamp: string;
  checks: HealthCheck[];
}
