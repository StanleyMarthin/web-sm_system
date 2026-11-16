import type {
  CreateJobPlanRuntimeRequest,
  JobPlanRuntimeView,
  ManualExecutionJobPlanRuntimeRequest,
  MonitorJobPlanRuntimeRequest,
  MutateJobPlanRuntimeApprovalRequest,
  MutateJobPlanRuntimeExecutionRequest,
  ValidateJobPlanRuntimeRequest,
} from "@smsystem/contracts/job-plan-runtime";
import type { JobPlanMode, JobPlanDraftRecord } from "@smsystem/contracts/job-plan";
import { deleteJobPlanDrafts, saveJobPlanDraft } from "./job-plan";
import {
  jobPlanRuntimeReadItemSchema,
  jobPlanRuntimeFailureSchema,
  jobPlanRuntimeListEnvelopeSchema,
  jobPlanRuntimeMutationEnvelopeSchema,
} from "@smsystem/contracts/job-plan-runtime";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

export interface JobPlanRuntimeListParams {
  userId: string;
  view?: JobPlanRuntimeView;
  date?: string;
  unitId?: string;
  divisionId?: string | number;
  employeeId?: string;
  coreId?: string;
  workMode?: JobPlanMode;
}

function appendParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

export function buildJobPlanRuntimeQueryString(input: JobPlanRuntimeListParams): string {
  const params = new URLSearchParams();

  appendParam(params, "userId", input.userId);
  appendParam(params, "view", input.view ?? "browse");
  appendParam(params, "date", input.date);
  appendParam(params, "unitId", input.unitId);
  appendParam(params, "divisionId", input.divisionId);
  appendParam(params, "employeeId", input.employeeId);
  appendParam(params, "coreId", input.coreId);
  appendParam(params, "workMode", input.workMode);
  appendParam(params, "mode", input.workMode);

  return params.toString();
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}));
  try {
    const payload = jobPlanRuntimeFailureSchema.parse(body);
    return {
      success: false,
      message: payload.message,
      errorCode: payload.errorCode,
      data: payload.data,
    };
  } catch {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const detail = Array.isArray(record.detail) ? record.detail[0] : record.detail;
      const message = typeof record.message === "string" ? record.message : typeof detail === "string" ? detail : null;
      if (message) {
        return {
          success: false,
          message,
          errorCode: typeof record.errorCode === "string" ? record.errorCode : "JOB_PLAN_RUNTIME_ERROR",
          data: {},
        };
      }
    }
    return {
      success: false,
      message: "Response Job Plan Runtime tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

async function postJson<TInput>(path: string, input: TInput) {
  const response = await fetch(`/api/job-plan-runtime${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanRuntimeMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function createJobPlanCommandId(prefix = "web") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function fetchJobPlanRuntimeList(input: JobPlanRuntimeListParams) {
  const queryString = buildJobPlanRuntimeQueryString(input);
  const suffix = queryString ? `?${queryString}` : "";

  const response = await fetch(`/api/job-plan-runtime${suffix}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanRuntimeListEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function createJobPlan(input: CreateJobPlanRuntimeRequest) {
  return postJson("", input);
}

export async function submitSharedJobPlanDraft(input: CreateJobPlanRuntimeRequest & {
  draftItemId: string;
  linkedPlanId?: string;
  draftRecord?: JobPlanDraftRecord;
}) {
  try {
    const { linkedPlanId, draftRecord, ...createInput } = input;
    let planId = linkedPlanId;
    if (!planId) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${input.userId}:${input.draftItemId}`));
      const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const created = await createJobPlan({ ...createInput, commandId: `web-draft-create:${key}` });
      if (!created.success) return created;
      planId = created.result.planId;
      if (draftRecord && !input.draftItemId.startsWith("qc-rework:")) {
        const linked = await saveJobPlanDraft({ replaceItems: false, items: [{
          ...draftRecord, linkedPlanId: planId, linkedPlanVersion: created.result.version,
        }] });
        if (!linked.success) return linked;
      }
    }
    const response = await fetch(`/api/job-plan-runtime/${encodeURIComponent(planId)}?${new URLSearchParams({ userId: input.userId })}`, {
      credentials: "include", cache: "no-store",
    });
    if (!response.ok) return parseFailure(response);
    const plan = jobPlanRuntimeReadItemSchema.parse((await response.json()).data);
    if (plan.plan_id !== planId || plan.core_id !== input.coreId || plan.is_overtime !== input.isOvertime || plan.urgent !== (input.urgent ?? false) || !plan.version) {
      return { success: false as const, message: "Plan berbeda dari draft. Muat ulang sebelum mengajukan." };
    }
    const edits = {
      employeeId: input.employeeId, taskDate: input.taskDate,
      plannedStartMinute: input.plannedStartMinute, plannedWorkMinutes: input.plannedWorkMinutes,
      jobDescription: input.jobDescription, note: input.note ?? null,
    };
    const changed = plan.employee_id !== edits.employeeId || plan.task_date !== edits.taskDate ||
      plan.planned_start_minute !== edits.plannedStartMinute || plan.planned_work_minutes !== edits.plannedWorkMinutes ||
      plan.jobdescription !== edits.jobDescription || (plan.note ?? null) !== edits.note;
    let version = plan.version;
    if (plan.approval_state === "DRAFT") {
      if (changed) {
        const edited = await mutateJobPlanApproval(planId, {
          ...edits, action: "edit_draft", userId: input.userId,
          commandId: `web-draft-edit:${planId}:${version}`, expectedVersion: version,
        });
        if (!edited.success) return edited;
        version = edited.result.version;
      }
      const submitted = await mutateJobPlanApproval(planId, {
        action: "submit", userId: input.userId,
        commandId: `web-draft-submit:${planId}:${version}`, expectedVersion: version,
      });
      if (!submitted.success) return submitted;
    } else if (changed || !["DIVISION_REVIEW", "UNIT_REVIEW", "MANAGEMENT_REVIEW", "APPROVED"].includes(plan.approval_state)) {
      return { success: false as const, message: "Plan sudah berubah. Muat ulang antrean sebelum mengajukan draft." };
    }
    return await deleteJobPlanDrafts({ draftItemIds: [input.draftItemId] });
  } catch {
    return { success: false as const, message: "Pengajuan belum terkonfirmasi. Draft tetap tersedia untuk dicoba lagi." };
  }
}

export async function cancelSharedJobPlanDraft(draftItemId: string, userId: string, linkedPlanId?: string, linkedPlanVersion?: number) {
  try {
    if (draftItemId.startsWith("qc-rework:")) {
      const cancelled = await postJson(`/drafts/${encodeURIComponent(draftItemId)}/cancel`, { userId });
      if (!cancelled.success) return cancelled;
    } else if (linkedPlanId) {
      if (!linkedPlanVersion) return { success: false as const, message: "Versi draft belum tersedia. Muat ulang sebelum menghapus." };
      const cancelled = await mutateJobPlanApproval(linkedPlanId, {
        action: "cancel", userId, expectedVersion: linkedPlanVersion,
        commandId: `web-draft-cancel:${linkedPlanId}:${linkedPlanVersion}`, reason: "Dihapus dari Web Job Plan",
      });
      if (!cancelled.success) return cancelled;
    }
    return await deleteJobPlanDrafts({ draftItemIds: [draftItemId] });
  } catch {
    return { success: false as const, message: "Penghapusan belum terkonfirmasi. Muat ulang sebelum mencoba lagi." };
  }
}

export async function mutateJobPlanApproval(planId: string, input: MutateJobPlanRuntimeApprovalRequest) {
  const response = await fetch(`/api/job-plan-runtime/${encodeURIComponent(planId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanRuntimeMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function mutateJobPlanExecution(planId: string, input: MutateJobPlanRuntimeExecutionRequest) {
  return postJson(`/${encodeURIComponent(planId)}/execution`, input);
}

export function manualExecuteJobPlan(planId: string, input: ManualExecutionJobPlanRuntimeRequest) {
  return postJson(`/${encodeURIComponent(planId)}/manual-execution`, input);
}

export function monitorJobPlan(planId: string, input: MonitorJobPlanRuntimeRequest) {
  return postJson(`/${encodeURIComponent(planId)}/monitor`, input);
}

export function validateJobPlan(planId: string, input: ValidateJobPlanRuntimeRequest) {
  return postJson(`/${encodeURIComponent(planId)}/validate`, input);
}
