import { cache } from "react";
import { authEnvelopeSchema, type AuthUser } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";

interface DashboardBootstrap {
  welcome: string;
  employeeId: string;
  permissionCount: number;
  scope: AuthUser["scope"];
}

async function fetchJson(path: string, cookieHeader: string) {
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/**
 * Wrapped with React cache() so that layout + page calling this in the same
 * render pass only trigger ONE actual HTTP request to /api/auth/me.
 */
export const fetchCurrentUser = cache(
  async (
    cookieHeader: string,
  ): Promise<{ user: AuthUser | null; status: number }> => {
    const response = await fetchJson("/api/auth/me", cookieHeader);
    if (!response || !response.ok) {
      return {
        user: null,
        status: response?.status ?? 503,
      };
    }

    const payload = authEnvelopeSchema.parse(await response.json());
    return {
      user: payload.data.user,
      status: response.status,
    };
  },
);

export async function fetchDashboardBootstrap(
  cookieHeader: string,
): Promise<{ data: DashboardBootstrap | null; status: number }> {
  const response = await fetchJson("/api/dashboard/bootstrap", cookieHeader);
  if (!response || !response.ok) {
    return {
      data: null,
      status: response?.status ?? 503,
    };
  }

  const payload = (await response.json()) as {
    data: DashboardBootstrap;
  };

  return {
    data: payload.data,
    status: response.status,
  };
}
