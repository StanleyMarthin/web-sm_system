import { describe, expect, it } from "bun:test";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import { handleJobPlanRuntimeProxyRoute } from "../src/routes/job-plan-runtime.routes";

const session = {
  user: {
    employeeId: "EMP-007",
    permissions: ["UPDATE_PLAN", "TASK_EXECUTE"],
  },
} as WebSession;

function auth(currentSession: WebSession | null = session): AuthService {
  return {
    getCurrentSession: async () => currentSession,
  } as unknown as AuthService;
}

describe("Job Plan API runtime proxy", () => {
  it("injects session userId into list query", async () => {
    let upstreamUrl = "";
    const response = await handleJobPlanRuntimeProxyRoute(
      new Request("http://api.test/api/job-plan-runtime?userId=FAKE&view=approval_queue"),
      "",
      auth(),
      async (request) => {
        upstreamUrl = String(request);
        return Response.json({ success: true, data: { items: [], count: 0 } });
      },
      "https://jobplan.test",
    );

    expect(response.status).toBe(200);
    expect(upstreamUrl).toBe("https://jobplan.test/sm/job-plans/v2?userId=EMP-007&view=approval_queue");
  });

  it("injects session userId into mutation body and preserves subpath", async () => {
    let upstreamUrl = "";
    let upstreamBody: unknown;
    const response = await handleJobPlanRuntimeProxyRoute(
      new Request("http://api.test/api/job-plan-runtime/PLAN-1/manual-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "FAKE",
          commandId: "cmd-1",
          expectedVersion: 5,
          actualStart: "2026-09-15T08:00:00+07:00",
          actualFinish: "2026-09-15T10:00:00+07:00",
          actualMinutes: 120,
        }),
      }),
      "PLAN-1/manual-execution",
      auth(),
      async (request, init) => {
        upstreamUrl = String(request);
        upstreamBody = JSON.parse(String(init?.body));
        return Response.json({ success: true, data: { planId: "PLAN-1", version: 6 } });
      },
      "https://jobplan.test/",
    );

    expect(response.status).toBe(200);
    expect(upstreamUrl).toBe("https://jobplan.test/sm/job-plans/v2/PLAN-1/manual-execution");
    expect(upstreamBody).toMatchObject({ userId: "EMP-007", commandId: "cmd-1" });
  });

  it("rejects users without Job Plan Runtime access", async () => {
    let called = false;
    const response = await handleJobPlanRuntimeProxyRoute(
      new Request("http://api.test/api/job-plan-runtime"),
      "",
      auth({ ...session, user: { ...session.user, permissions: [] } }),
      async () => {
        called = true;
        return Response.json({});
      },
      "https://jobplan.test",
    );

    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });
});
