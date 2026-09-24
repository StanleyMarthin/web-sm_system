import type {
  CreateJobPlanRuntimeRequest,
  JobPlanRuntimeView,
  ManualExecutionJobPlanRuntimeRequest,
  MonitorJobPlanRuntimeRequest,
  MutateJobPlanRuntimeApprovalRequest,
  MutateJobPlanRuntimeExecutionRequest,
  ValidateJobPlanRuntimeRequest,
} from "@smsystem/contracts/job-plan-runtime";
import {
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
