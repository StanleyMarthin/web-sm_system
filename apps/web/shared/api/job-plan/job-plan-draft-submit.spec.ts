import { afterEach, expect, test } from "bun:test";
import { jobPlanDraftRecordSchema } from "@smsystem/contracts/job-plan";
import { cancelSharedJobPlanDraft, submitSharedJobPlanDraft } from "./job-plan-runtime";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const draft = {
  draftItemId: "qc-rework:qc-1", userId: "KD-1", coreId: "CORE-1", employeeId: "EMP-1",
  taskDate: "2026-11-13", plannedStartMinute: 480, plannedWorkMinutes: 60,
  jobDescription: "Perbaikan QC", isRework: true, isOvertime: false, isPriority: false, commandId: "unused",
};
const ok = (data: object) => Response.json({ statusCode: 200, success: true, message: "OK", data });

test("submits a shared QC draft through its real plan before deleting the stash", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (url, options) => {
    calls.push({ url: String(url), body: options?.body ? JSON.parse(String(options.body)) : {} });
    if (!options?.method) return ok(snapshot(1));
    if (calls.length === 1) return ok({ planId: "PLAN-1", version: 1, approvalState: "DRAFT" });
    if (calls.length === 3) return ok({ planId: "PLAN-1", version: 2, approvalState: "DIVISION_REVIEW" });
    return ok({ deletedPlanId: draft.draftItemId, status: "DRAFT" });
  }) as typeof fetch;

  expect((await submitSharedJobPlanDraft(draft)).success).toBe(true);
  expect(calls.map((call) => new URL(call.url, "http://localhost").pathname)).toEqual([
    "/api/job-plan-runtime", "/api/job-plan-runtime/PLAN-1", "/api/job-plan-runtime/PLAN-1", "/api/job-plan/draft/delete",
  ]);
  expect(calls[0]?.body).toMatchObject({ draftItemId: draft.draftItemId, coreId: "CORE-1", isRework: true });
  expect(calls[2]?.body).toMatchObject({ action: "submit", expectedVersion: 1 });
  expect(calls[3]?.body).toEqual({ draftItemIds: [draft.draftItemId] });
});

test("keeps the draft after a failed submission and retries the same create identity", async () => {
  const createCommands: unknown[] = [];
  let deleted = false;
  globalThis.fetch = (async (url, options) => {
    if (!options?.method) return ok(snapshot(1));
    if (String(url).endsWith("/api/job-plan-runtime")) {
      createCommands.push(JSON.parse(String(options?.body)).commandId);
      return ok({ planId: "PLAN-1", version: 1, approvalState: "DRAFT" });
    }
    if (String(url).includes("draft/delete")) deleted = true;
    return Response.json({ success: false, statusCode: 409, message: "Kapasitas penuh" }, { status: 409 });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft(draft)).success).toBe(false);
  expect((await submitSharedJobPlanDraft(draft)).success).toBe(false);
  expect(createCommands[0]).toBe(createCommands[1]);
  expect(deleted).toBe(false);
});

test("cleans up a draft already submitted by a previous request without resubmitting", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url, options) => {
    const path = new URL(String(url), "http://localhost").pathname;
    paths.push(path);
    if (!options?.method) return ok(snapshot(3, "DIVISION_REVIEW"));
    return path === "/api/job-plan-runtime"
      ? ok({ planId: "PLAN-1", version: 3, approvalState: "DIVISION_REVIEW", reused: true })
      : ok({ status: "DRAFT" });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft(draft)).success).toBe(true);
  expect(paths).toEqual(["/api/job-plan-runtime", "/api/job-plan-runtime/PLAN-1", "/api/job-plan/draft/delete"]);
});

test("keeps an uncertain network submission available for retry", async () => {
  globalThis.fetch = (async () => { throw new Error("Connection closed"); }) as typeof fetch;
  expect((await submitSharedJobPlanDraft(draft)).success).toBe(false);
});

test("cancels the linked canonical draft before removing the shared QC draft", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (url, options) => {
    const path = new URL(String(url), "http://localhost").pathname;
    calls.push({ path, body: JSON.parse(String(options?.body)) });
    return path.endsWith("/cancel") ? ok({ planId: draft.draftItemId, version: 1, approvalState: "CANCELLED" }) : ok({ status: "DRAFT" });
  }) as typeof fetch;
  expect((await cancelSharedJobPlanDraft(draft.draftItemId, draft.userId, "PLAN-1", 3)).success).toBe(true);
  expect(calls.map((call) => call.path)).toEqual(["/api/job-plan-runtime/drafts/qc-rework%3Aqc-1/cancel", "/api/job-plan/draft/delete"]);
  expect(calls[0]?.body).toEqual({ userId: draft.userId });
});

test("deletes an unlinked QC draft through the backend so orphan create receipts are checked", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url) => {
    const path = new URL(String(url), "http://localhost").pathname;
    paths.push(path);
    return path.endsWith("/cancel")
      ? ok({ planId: draft.draftItemId, version: 1, approvalState: "CANCELLED" })
      : ok({ status: "DRAFT" });
  }) as typeof fetch;
  expect((await cancelSharedJobPlanDraft(draft.draftItemId, draft.userId)).success).toBe(true);
  expect(paths).toEqual(["/api/job-plan-runtime/drafts/qc-rework%3Aqc-1/cancel", "/api/job-plan/draft/delete"]);
});

test("does not delete the QC intent when its linked plan cannot be cancelled", async () => {
  const paths: string[] = [];
  globalThis.fetch = (async (url) => {
    paths.push(String(url));
    return Response.json({ success: false, statusCode: 409, message: "Versi berubah" }, { status: 409 });
  }) as typeof fetch;
  expect((await cancelSharedJobPlanDraft(draft.draftItemId, draft.userId, "PLAN-1", 3)).success).toBe(false);
  expect(paths).toHaveLength(1);
});

const snapshot = (version = 7, state = "DRAFT") => ({
  plan_id: "PLAN-1", core_id: draft.coreId, car_id: "CAR-1", panel_id: 1, division_id: 4,
  employee_id: draft.employeeId, task_date: draft.taskDate, planned_start_minute: 480,
  planned_finish_minute: 540, planned_work_minutes: 60, approval_state: state,
  execution_state: "NOT_STARTED", ledger_state: "UNMATERIALIZED", legacy_status: null,
  urgent: false, is_rework: true, is_overtime: false, is_priority: false,
  jobdescription: draft.jobDescription, note: null, source: "V2_REDIS", version,
});

test("ordinary mobile-linked draft submits the current canonical version without creating again", async () => {
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  globalThis.fetch = (async (url, options) => {
    const path = new URL(String(url), "http://localhost").pathname;
    const method = options?.method ?? "GET";
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ path, method, body });
    if (method === "GET") return ok(snapshot(9));
    return path.endsWith("draft/delete") ? ok({ status: "DRAFT" })
      : ok({ planId: "PLAN-1", version: 10, approvalState: "DIVISION_REVIEW" });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft({ ...draft, draftItemId: "draft-ordinary", linkedPlanId: "PLAN-1" })).success).toBe(true);
  expect(calls.map((call) => [call.method, call.path])).toEqual([
    ["GET", "/api/job-plan-runtime/PLAN-1"], ["PUT", "/api/job-plan-runtime/PLAN-1"],
    ["POST", "/api/job-plan/draft/delete"],
  ]);
  expect(calls[1]?.body).toMatchObject({ action: "submit", expectedVersion: 9 });
});

test("reused create receipt reloads the actual version before submission", async () => {
  const puts: Record<string, unknown>[] = [];
  globalThis.fetch = (async (url, options) => {
    if ((options?.method ?? "GET") === "GET") return ok(snapshot(8));
    if (options?.method === "PUT") { puts.push(JSON.parse(String(options.body))); return ok({ planId: "PLAN-1", version: 9 }); }
    return String(url).endsWith("draft/delete") ? ok({ status: "DRAFT" })
      : ok({ planId: "PLAN-1", version: 1, reused: true });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft(draft)).success).toBe(true);
  expect(puts[0]).toMatchObject({ action: "submit", expectedVersion: 8 });
});

test("persists the canonical link for mobile before attempting ordinary draft submission", async () => {
  const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  const record = jobPlanDraftRecordSchema.parse({
    draftItemId: "draft-ordinary", coreId: draft.coreId, assignedUserId: draft.employeeId,
    taskDate: draft.taskDate, targetHours: 1, startTime: "08:00", finishTime: "09:00", jobDescription: draft.jobDescription,
  });
  globalThis.fetch = (async (url, options) => {
    const path = new URL(String(url), "http://localhost").pathname;
    calls.push({ path, method: options?.method ?? "GET", body: options?.body ? JSON.parse(String(options.body)) : undefined });
    if (!options?.method) return ok(snapshot());
    if (options.method === "PUT") return Response.json({ success: false, message: "Kapasitas penuh" }, { status: 409 });
    return path === "/api/job-plan-runtime" ? ok({ planId: "PLAN-1", version: 1 }) : ok({ status: "DRAFT" });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft({ ...draft, draftItemId: record.draftItemId, draftRecord: record })).success).toBe(false);
  expect(calls[1]?.path).toBe("/api/job-plan/draft");
  expect(calls[1]?.body).toMatchObject({ replaceItems: false, items: [{ ...record, linkedPlanId: "PLAN-1", linkedPlanVersion: 1 }] });
  expect(calls.some((call) => call.path.endsWith("draft/delete"))).toBe(false);
});

test("reconciles edited shared fields before submitting the current plan", async () => {
  const puts: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url, options) => {
    if (!options?.method) return ok(snapshot());
    if (options.method === "PUT") {
      puts.push(JSON.parse(String(options.body)));
      return ok({ planId: "PLAN-1", version: puts.length === 1 ? 8 : 9 });
    }
    return ok({ status: "DRAFT" });
  }) as typeof fetch;
  expect((await submitSharedJobPlanDraft({ ...draft, linkedPlanId: "PLAN-1", plannedWorkMinutes: 90 })).success).toBe(true);
  expect(puts[0]).toMatchObject({ action: "edit_draft", expectedVersion: 7, plannedWorkMinutes: 90 });
  expect(puts[1]).toMatchObject({ action: "submit", expectedVersion: 8 });
});

test("does not discard changed or cancelled linked drafts", async () => {
  for (const state of ["CANCELLED", "APPROVED"]) {
    const methods: string[] = [];
    globalThis.fetch = (async (_url, options) => {
      methods.push(options?.method ?? "GET");
      return ok(snapshot(7, state));
    }) as typeof fetch;
    expect((await submitSharedJobPlanDraft({ ...draft, linkedPlanId: "PLAN-1", plannedWorkMinutes: 90 })).success).toBe(false);
    expect(methods).toEqual(["GET"]);
  }
});


test("does not submit or remove a supplemental draft linked to an ordinary plan", async () => {
  const mutations: string[] = [];
  globalThis.fetch = (async (url, options) => {
    if (!options?.method) return ok(snapshot());
    mutations.push(String(url));
    return ok({ planId: "PLAN-1", version: 1 });
  }) as typeof fetch;
  const result = await submitSharedJobPlanDraft({ ...draft, urgent: true, linkedPlanId: "PLAN-1" });
  expect(result.success).toBe(false);
  expect(mutations).toEqual([]);
});
