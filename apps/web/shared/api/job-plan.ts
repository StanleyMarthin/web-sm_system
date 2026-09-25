import type {
  CreateJobPlanAdditionalCountdownRequest,
  JobPlanMode,
  JobPlanOptionKind,
  SaveJobPlanDraftRequest,
} from "@smsystem/contracts/job-plan";
import {
  createJobPlanAdditionalCountdownResponseSchema,
  jobPlanGridEnvelopeSchema,
  jobPlanMutationEnvelopeSchema,
  jobPlanOptionsEnvelopeSchema,
} from "@smsystem/contracts/job-plan";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

const optionCache = new Map<string, unknown[]>();

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
      credentials: cookieHeader ? undefined : "include",
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

export async function createJobPlanAdditionalCountdown(input: CreateJobPlanAdditionalCountdownRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/additional-countdown`, {
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

  const payload = await response.json() as { data: unknown };
  return {
    success: true as const,
    result: createJobPlanAdditionalCountdownResponseSchema.parse(payload.data),
  };
}

export async function fetchJobPlanOptions(kind: JobPlanOptionKind, params: {
  divisionId?: number | null;
  unitId?: string | null;
  panelId?: number | null;
}) {
  const searchParams = new URLSearchParams();
  if (params.divisionId) searchParams.set("divisionId", String(params.divisionId));
  if (params.unitId) searchParams.set("unitId", params.unitId);
  if (params.panelId) searchParams.set("panelId", String(params.panelId));
  const query = searchParams.toString();
  const cacheKey = `${kind}:${query}`;
  const cached = optionCache.get(cacheKey);
  if (cached) return { success: true as const, data: cached };

  const response = await fetch(`${getApiBaseUrl()}/api/job-plan/options/${kind}${query ? `?${query}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
      data: [] as unknown[],
    };
  }

  const payload = jobPlanOptionsEnvelopeSchema.parse(await response.json());
  optionCache.set(cacheKey, payload.data);
  return {
    success: true as const,
    data: payload.data,
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
