// ============================================================
// Auth Service — login/logout using dummy data (MVP)
// Will be replaced with actual API calls via env.apiUrl
// ============================================================

import { DEMO_USERS } from "@/lib/dummy-data";
import type { AuthUser, LoginRequest } from "@/types";

interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export async function loginService(req: LoginRequest): Promise<LoginResult> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 500));

  const found = DEMO_USERS.find(
    (u) => u.employeeId === req.employeeId && u.password === req.password
  );

  if (!found) {
    return { success: false, error: "Employee ID atau password salah" };
  }

  const { password: _, ...user } = found;
  return {
    success: true,
    user,
    token: `dummy-jwt-${user.employeeId}-${Date.now()}`,
  };
}

export async function logoutService(): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
}
