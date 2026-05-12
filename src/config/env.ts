// ============================================================
// Environment configuration — per-service API URLs
// Setiap microservice berjalan di port terpisah pada host yang sama
// ============================================================

const HOST = process.env.NEXT_PUBLIC_API_HOST ?? "http://108.136.189.225";

export const env = {
  apiUrl:       process.env.NEXT_PUBLIC_API_URL ?? `${HOST}/v1`,
  appName:      process.env.NEXT_PUBLIC_APP_NAME ?? "SM System",
  // Microservice URLs — diarahkan ke proxy internal Next.js agar public tidak tahu
  jobPlanUrl:   "/api-proxy/job-plan",
  tasksUrl:     "/api-proxy/tasks",
  countdownUrl: "/api-proxy/countdown",
  warehouseUrl: "/api-proxy/warehouse",
  qcUrl:        "/api-proxy/qc",
  woUrl:        "/api-proxy/wo",
} as const;
