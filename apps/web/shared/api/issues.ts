import type {
  IssueAssignRequest,
  IssueCreateRequest,
  IssueEscalateRequest,
  IssueResolveRequest,
  IssueWaiveRequest,
} from "@smsystem/contracts/issue";
import {
  issueDetailEnvelopeSchema,
  issueGridEnvelopeSchema,
  issueMutationEnvelopeSchema,
  issueRecordSchema,
} from "@smsystem/contracts/issue";
import { getApiBaseUrl } from "@/shared/api/config";

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
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

async function fetchWithCookie(path: string, cookieHeader: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    return response;
  } catch {
    return null;
  }
}

async function mutateIssue(
  path: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: body ? "PATCH" : "PATCH",
    credentials: "include",
    headers: body
      ? {
          "Content-Type": "application/json",
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = issueMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function buildIssueGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = toUrlSearchParams(searchParams);

  if (!params.has("page")) {
    params.set("page", "1");
  }

  if (!params.has("limit")) {
    params.set("limit", "25");
  }

  return params.toString();
}

export async function fetchIssueGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildIssueGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";
  const response = await fetchWithCookie(`/api/issues${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: issueGridEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchUrgentIssues(cookieHeader: string) {
  const response = await fetchWithCookie("/api/issues/urgent", cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  const payload = (await response.json()) as {
    success: boolean;
    message: string;
    data: unknown[];
  };

  return {
    payload: payload.data.map((row) => issueRecordSchema.parse(row)),
    status: response.status,
  };
}

export async function fetchIssueDetail(cookieHeader: string, issueId: string) {
  const response = await fetchWithCookie(`/api/issues/${issueId}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: issueDetailEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchIssuesByUnit(cookieHeader: string, carId: string) {
  const response = await fetchWithCookie(`/api/issues/unit/${carId}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  const payload = (await response.json()) as {
    success: boolean;
    message: string;
    data: unknown[];
  };

  return {
    payload: payload.data.map((row) => issueRecordSchema.parse(row)),
    status: response.status,
  };
}

export async function createIssue(input: IssueCreateRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/issues`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = issueMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export function acknowledgeIssue(issueId: string) {
  return mutateIssue(`/api/issues/${issueId}/acknowledge`);
}

export function assignIssue(issueId: string, input: IssueAssignRequest) {
  return mutateIssue(`/api/issues/${issueId}/assign`, input);
}

export function startIssue(issueId: string) {
  return mutateIssue(`/api/issues/${issueId}/start`);
}

export function markIssueQcRecheck(issueId: string) {
  return mutateIssue(`/api/issues/${issueId}/qc-recheck`);
}

export function resolveIssue(issueId: string, input: IssueResolveRequest) {
  return mutateIssue(`/api/issues/${issueId}/resolve`, input);
}

export function escalateIssue(issueId: string, input: IssueEscalateRequest) {
  return mutateIssue(`/api/issues/${issueId}/escalate`, input);
}

export function waiveIssue(issueId: string, input: IssueWaiveRequest) {
  return mutateIssue(`/api/issues/${issueId}/waive`, input);
}
