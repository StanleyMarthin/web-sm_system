import type {
  CreateJobPlanV2Request,
  JobPlanV2View,
  ManualExecutionJobPlanV2Request,
  MonitorJobPlanV2Request,
  MutateJobPlanV2ApprovalRequest,
  MutateJobPlanV2ExecutionRequest,
  ValidateJobPlanV2Request,
} from "@smsystem/contracts/job-plan-v2";
import {
  jobPlanV2FailureSchema,
  jobPlanV2ListEnvelopeSchema,
  jobPlanV2MutationEnvelopeSchema,
} from "@smsystem/contracts/job-plan-v2";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

export interface JobPlanV2ListParams {
  userId: string;
  view?: JobPlanV2View;
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

export function buildJobPlanV2QueryString(input: JobPlanV2ListParams): string {
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
    const payload = jobPlanV2FailureSchema.parse(body);
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
          errorCode: typeof record.errorCode === "string" ? record.errorCode : "JOB_PLAN_V2_ERROR",
          data: {},
        };
      }
    }
    return {
      success: false,
      message: "Response Job Plan V2 tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

async function postJson<TInput>(path: string, input: TInput) {
  const response = await fetch(`/api/job-plan-v2${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanV2MutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function createJobPlanV2CommandId(prefix = "web") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function fetchJobPlanV2List(input: JobPlanV2ListParams) {
  const queryString = buildJobPlanV2QueryString(input);
  const suffix = queryString ? `?${queryString}` : "";

  const response = await fetch(`/api/job-plan-v2${suffix}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanV2ListEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchJobPlanV2History(cookieHeader: string, coreId: string) {
  const params = new URLSearchParams({ view: "browse", coreId });

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/job-plan-v2?${params.toString()}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) return parseFailure(response);

    const payload = jobPlanV2ListEnvelopeSchema.parse(await response.json());
    return {
      success: true as const,
      result: payload.data,
    };
  } catch {
    return {
      success: false as const,
      message: "Riwayat Job Plan tidak dapat dihubungi.",
      errorCode: "JOB_PLAN_V2_UNAVAILABLE",
      data: {},
    };
  }
}

export function createJobPlanV2(input: CreateJobPlanV2Request) {
  return postJson("", input);
}

export async function mutateJobPlanV2Approval(planId: string, input: MutateJobPlanV2ApprovalRequest) {
  const response = await fetch(`/api/job-plan-v2/${encodeURIComponent(planId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) return parseFailure(response);

  const payload = jobPlanV2MutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function mutateJobPlanV2Execution(planId: string, input: MutateJobPlanV2ExecutionRequest) {
  return postJson(`/${encodeURIComponent(planId)}/execution`, input);
}

export function manualExecuteJobPlanV2(planId: string, input: ManualExecutionJobPlanV2Request) {
  return postJson(`/${encodeURIComponent(planId)}/manual-execution`, input);
}

export function monitorJobPlanV2(planId: string, input: MonitorJobPlanV2Request) {
  return postJson(`/${encodeURIComponent(planId)}/monitor`, input);
}

export function validateJobPlanV2(planId: string, input: ValidateJobPlanV2Request) {
  return postJson(`/${encodeURIComponent(planId)}/validate`, input);
}
