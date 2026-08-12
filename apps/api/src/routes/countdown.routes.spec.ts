import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import type { AuthService } from "@/services/auth/auth.service";
import type { WebSession } from "@/services/auth/session.service";
import {
  handleCountdownDownloadRoute,
  handleCountdownImportRoute,
  handleCountdownRevisionApprovalRoute,
  handleCountdownRevisionRequestRoute,
} from "./countdown.routes";

const session = {
  user: {
    employeeId: "EMP-1",
    permissions: [permissionCodes.viewCountdown],
    scope: { canViewAllUnits: false, canViewAssignedUnits: false, divisionIds: [7], unitIds: ["UNIT-1"] },
  },
} as WebSession;

function auth(currentSession: WebSession = session): AuthService {
  return { getCurrentSession: async () => currentSession } as unknown as AuthService;
}

describe("GET /api/countdown/download", () => {
  it("requires unitId", async () => {
    let called = false;
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download"),
      auth(),
      { download: async () => { called = true; return new Uint8Array(); } } as never,
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it("passes filters and returns an xlsx attachment", async () => {
    let received: unknown;
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download?unitId=UNIT-1&divisionId=7&status=PROSES"),
      auth(),
      { download: async (_session: unknown, query: unknown) => { received = query; return new Uint8Array([1, 2, 3]); } } as never,
    );

    expect(received).toEqual({ unitId: "UNIT-1", divisionId: "7", status: "PROSES" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="countdown-UNIT-1.xlsx"');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it("rejects an invalid divisionId before export", async () => {
    let called = false;
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download?unitId=UNIT-1&divisionId=0"),
      auth(),
      { download: async () => { called = true; return new Uint8Array(); } } as never,
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it("rejects an unknown status before export", async () => {
    let called = false;
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download?unitId=UNIT-1&status=INVALID"),
      auth(),
      { download: async () => { called = true; return new Uint8Array(); } } as never,
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it("keeps the attachment filename header-safe", async () => {
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download?unitId=UNIT%22%0D%0AX-Test%3Ayes"),
      auth(),
      { download: async () => new Uint8Array() } as never,
    );

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="countdown-UNIT___X-Test_yes.xlsx"',
    );
  });

  it("requires countdown view permission", async () => {
    const response = await handleCountdownDownloadRoute(
      new Request("http://web.test/api/countdown/download?unitId=UNIT-1"),
      auth({ ...session, user: { ...session.user, permissions: [] } }),
      { download: async () => new Uint8Array() } as never,
    );

    expect(response.status).toBe(403);
  });
});

describe("POST /api/countdown/import", () => {
  const manageSession = {
    ...session,
    user: {
      ...session.user,
      permissions: [permissionCodes.updatePlan],
      scope: { ...session.user.scope, canViewAllUnits: true },
    },
  } as WebSession;

  it("requires the selected unitId", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1])], "countdown.xlsx"));
    let called = false;
    const response = await handleCountdownImportRoute(
      new Request("http://web.test/api/countdown/import", { method: "POST", body: form }),
      auth(manageSession),
      { importWorkbook: async () => { called = true; return {}; } } as never,
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it("passes the selected unitId to workbook validation", async () => {
    const form = new FormData();
    form.set("unitId", "UNIT-1");
    form.set("file", new File([new Uint8Array([1])], "countdown.xlsx"));
    let received: unknown;
    const response = await handleCountdownImportRoute(
      new Request("http://web.test/api/countdown/import", { method: "POST", body: form }),
      auth(manageSession),
      { importWorkbook: async (...args: unknown[]) => { received = args; return { inserted: 1, updated: 0, rejected: 0, issues: [] }; } } as never,
    );

    expect(response.status).toBe(201);
    expect((received as unknown[])[3]).toBe("UNIT-1");
  });

  it("rejects legacy .xls files", async () => {
    const form = new FormData();
    form.set("unitId", "UNIT-1");
    form.set("file", new File([new Uint8Array([1])], "countdown.xls"));
    const response = await handleCountdownImportRoute(
      new Request("http://web.test/api/countdown/import", { method: "POST", body: form }),
      auth(manageSession),
      { importWorkbook: async () => ({}) } as never,
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for unreadable xlsx content", async () => {
    const form = new FormData();
    form.set("unitId", "UNIT-1");
    form.set("file", new File([new Uint8Array([1])], "countdown.xlsx"));
    const response = await handleCountdownImportRoute(
      new Request("http://web.test/api/countdown/import", { method: "POST", body: form }),
      auth(manageSession),
      { importWorkbook: async () => { throw new Error("COUNTDOWN_IMPORT_FILE_INVALID"); } } as never,
    );

    expect(response.status).toBe(400);
  });
});

describe("countdown revision routes", () => {
  it("requires request-revision permission", async () => {
    const response = await handleCountdownRevisionRequestRoute(
      new Request("http://web.test/api/countdown/CD-1/revision", {
        method: "POST",
        body: JSON.stringify({ requestedHours: 2, requestedDeadline: "2026-08-20", reason: "Tambahan kerja" }),
        headers: { "content-type": "application/json" },
      }),
      "CD-1",
      auth({ ...session, user: { ...session.user, permissions: [permissionCodes.viewCountdown] } }),
      { requestRevision: async () => ({}) } as never,
    );
    expect(response.status).toBe(403);
  });

  it("validates and forwards an approval decision", async () => {
    let received: unknown;
    const response = await handleCountdownRevisionApprovalRoute(
      new Request("http://web.test/api/countdown/CD-1/revision/approval", {
        method: "PUT",
        body: JSON.stringify({ isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" }),
        headers: { "content-type": "application/json" },
      }),
      "CD-1",
      auth({ ...session, user: { ...session.user, permissions: [permissionCodes.viewCountdown, permissionCodes.countdownSubmitApproval] } }),
      { decideRevision: async (...args: unknown[]) => { received = args; return { status: "APPROVED" }; } } as never,
    );
    expect(response.status).toBe(200);
    expect((received as unknown[]).slice(1)).toEqual([
      "CD-1",
      { isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" },
    ]);
  });

  it("returns a clear conflict when the unit budget is unavailable", async () => {
    const response = await handleCountdownRevisionApprovalRoute(
      new Request("http://web.test/api/countdown/CD-1/revision/approval", {
        method: "PUT",
        body: JSON.stringify({ isApproved: true, approvedHours: 2, approvedDeadline: "2026-08-20" }),
        headers: { "content-type": "application/json" },
      }),
      "CD-1",
      auth({ ...session, user: { ...session.user, permissions: [permissionCodes.viewCountdown, permissionCodes.countdownSubmitApproval] } }),
      { decideRevision: async () => { throw new Error("COUNTDOWN_UNIT_BUDGET_NOT_FOUND"); } } as never,
    );
    expect(response.status).toBe(409);
  });
});
