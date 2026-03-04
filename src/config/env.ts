// ============================================================
// Environment configuration — no hardcoded URLs
// ============================================================

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "https://api.smrestoration.com/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SM System",
} as const;
