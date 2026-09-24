import { describe, expect, it } from "bun:test";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import { handleNotificationsRoute } from "./notification.routes";

const session = {
  mobileSessionKey: "mobile-token",
  user: { employeeId: "EMP-007", permissions: ["LIST_NOTIFICATIONS"] },
} as WebSession;

function auth(currentSession: WebSession | null = session): AuthService {
  return {
    getCurrentSession: async () => currentSession,
  } as unknown as AuthService;
}

describe("GET /api/notifications", () => {
  it("uses the authenticated employee and bounded limit", async () => {
    let upstreamRequest: Request | undefined;
    const response = await handleNotificationsRoute(
      new Request("http://web.test/api/notifications?employee_id=OTHER&page=2&limit=999"),
      auth(),
      async (request) => {
        upstreamRequest = request;
        return Response.json({ success: true, data: [] });
      },
      "https://login.test",
    );

    expect(response.status).toBe(200);
    expect(upstreamRequest?.headers.get("authorization")).toBe("Bearer mobile-token");
    expect(new URL(upstreamRequest!.url).searchParams.toString()).toBe(
      "employee_id=EMP-007&page=2&limit=50",
    );
  });

  it("normalizes gateway fields for the web UI", async () => {
    const response = await handleNotificationsRoute(
      new Request("http://web.test/api/notifications"),
      auth(),
      async () => Response.json({
        success: true,
        data: [{
          id: 12,
          title: "WO disetujui",
          message: "WO-1 siap",
          created_at: "2026-08-10T08:00:00Z",
          is_read: 1,
          dataPayload: "{\"module\":\"wo\"}",
        }],
      }),
      "https://login.test/",
    );

    expect(await response.json()).toEqual({
      success: true,
      message: "Notifikasi berhasil dimuat.",
      data: {
        notifications: [{
          id: "12",
          title: "WO disetujui",
          body: "WO-1 siap",
          isRead: true,
          createdAt: "2026-08-10T08:00:00Z",
          data: { module: "wo" },
        }],
        page: 1,
        limit: 10,
      },
    });
  });

  it("rejects requests without a web session before calling upstream", async () => {
    let called = false;
    const response = await handleNotificationsRoute(
      new Request("http://web.test/api/notifications"),
      auth(null),
      async () => {
        called = true;
        return Response.json({});
      },
      "https://login.test",
    );

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  it("rejects users without notification permission", async () => {
    const response = await handleNotificationsRoute(
      new Request("http://web.test/api/notifications"),
      auth({ ...session, user: { ...session.user, permissions: [] } }),
      async () => Response.json({}),
      "https://login.test",
    );

    expect(response.status).toBe(403);
  });

  it("returns a stable error when the gateway fails", async () => {
    const response = await handleNotificationsRoute(
      new Request("http://web.test/api/notifications"),
      auth(),
      async () => Response.json({ message: "database internals" }, { status: 500 }),
      "https://login.test",
    );

    expect(response.status).toBe(502);
    expect((await response.json()).errorCode).toBe("NOTIFICATION_GATEWAY_FAILED");
  });
});
