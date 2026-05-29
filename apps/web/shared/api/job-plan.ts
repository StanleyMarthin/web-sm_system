import type {
  BulkCreateJobPlanRequest,
  CreateJobPlanRequest,
  CreateJobPlanWorkspaceRequest,
  DeleteJobPlanDraftRequest,
  JobPlanMode,
  SaveJobPlanDraftRequest,
  SubmitJobPlanDraftRequest,
  UpdateJobPlanRequest,
  UpdateJobPlanStatusRequest,
} from "@smsystem/contracts/job-plan";
import {
  jobPlanGridEnvelopeSchema,
  jobPlanMutationEnvelopeSchema,
  jobPlanPicLoadEnvelopeSchema,
} from "@smsystem/contracts/job-plan";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function toUrlSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    for (const item of value ?? []) {
      params.append(key, item);
    }
  }

  return params;
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  try {
    const payload = (await response.json()) as ApiFailure;
    return payload;
  } catch {
    return {
      success: false,
      message: "Response API tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

export function buildJobPlanGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
  mode: JobPlanMode,
): string {
  const params = toUrlSearchParams(searchParams);

  params.set("mode", mode);

  if (!params.has("date")) {
    params.set("date", getTodayIsoDate());
  }

  if (params.get("window") === "weekly" && params.has("dateStart")) {
    params.set("date", params.get("dateStart") ?? getTodayIsoDate());
  }

  if (!params.has("window")) {
    params.set("window", "daily");
  }

  return params.toString();
}

export async function fetchJobPlanGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
  mode: JobPlanMode,
) {
  const queryString = buildJobPlanGridQueryString(searchParams, mode);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/job-plan${suffix}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: jobPlanGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createJobPlan(input: CreateJobPlanRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function bulkCreateJobPlans(input: BulkCreateJobPlanRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/bulk`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function createJobPlanWorkspace(input: CreateJobPlanWorkspaceRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/workspace`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function saveJobPlanDraft(input: SaveJobPlanDraftRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/draft`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function submitJobPlanDrafts(input: SubmitJobPlanDraftRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/draft/submit`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function deleteJobPlanDrafts(input: DeleteJobPlanDraftRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/draft/delete`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function updateJobPlan(planId: string, input: UpdateJobPlanRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/${planId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function updateJobPlanStatus(
  planId: string,
  input: UpdateJobPlanStatusRequest,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/${planId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function deleteJobPlan(planId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/${planId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchJobPlanPicLoad(employeeId: string, taskDate: string) {
  const params = new URLSearchParams({
    employeeId,
    taskDate,
  });

  const response = await fetch(
    `${getApiBaseUrl()}/api/job-plan/pic-load?${params.toString()}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = jobPlanPicLoadEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    data: payload.data,
  };
}
