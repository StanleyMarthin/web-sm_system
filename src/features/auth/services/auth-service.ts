// ============================================================
// Auth Service — real API call to /auth/login-web
// ============================================================

import type { AuthUser, LoginRequest, UserRole } from "@/types";

interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "web-unknown";
  let id = localStorage.getItem("sm_web_device_id");
  if (!id) {
    id = "web-" + crypto.randomUUID();
    localStorage.setItem("sm_web_device_id", id);
  }
  return id;
}

export async function loginService(req: LoginRequest): Promise<LoginResult> {
  try {
    const baseUrl = "/api-proxy";
    const deviceId = req.deviceId || getOrCreateDeviceId();
    
    const res = await fetch(`${baseUrl}/auth/login-web`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: req.employeeId,
        password: req.password,
        deviceId,
        force: req.force || false,
      }),
    });

    const data = await res.json();

    if (res.status === 409 && data.errorCode === "ACTIVE_SESSION_EXISTS") {
      return {
        success: false,
        requiresConfirmation: true,
        confirmationMessage: data.message || "Sesi aktif di perangkat lain.",
      };
    }

    if (!res.ok || !data.success) {
      return { success: false, error: data.message || "Login gagal" };
    }

    const apiUser = data.data.user;
    const mappedUser: AuthUser = {
      userId: apiUser.userId,
      employeeId: apiUser.employeeId,
      fullName: apiUser.fullname || apiUser.fullName || "User",
      role: (apiUser.roleName || apiUser.role || "mechanic").toLowerCase() as UserRole,
      divisionName: apiUser.division || apiUser.divisionName || "-",
      divisionId: apiUser.divisionId || 0,
    };

    return {
      success: true,
      user: mappedUser,
      token: data.data.token,
    };
  } catch (error) {
    console.error("[auth-service] login failed:", error);
    return { success: false, error: "Terjadi kesalahan jaringan" };
  }
}

export async function logoutService(): Promise<void> {
  // Can be implemented if needed, currently just clear local state in store
  await new Promise((r) => setTimeout(r, 200));
}
