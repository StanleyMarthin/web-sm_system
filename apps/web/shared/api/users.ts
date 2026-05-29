import type {
  CreateUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
} from "@smsystem/contracts/user";
import {
  userEnvelopeSchema,
  userGridEnvelopeSchema,
} from "@smsystem/contracts/user";
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

export function buildUserGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchUserGrid(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildUserGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/users${suffix}`, {
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
      payload: userGridEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createUser(input: CreateUserRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/users`, {
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

  const payload = userEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    user: payload.data.user,
  };
}

export async function updateUser(employeeId: string, input: UpdateUserRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/users/${employeeId}`, {
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

  const payload = userEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    user: payload.data.user,
  };
}

export async function resetUserPassword(
  employeeId: string,
  input: ResetPasswordRequest,
) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/users/${employeeId}/reset-password`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
  };
}

export async function deactivateUser(employeeId: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/users/${employeeId}/deactivate`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  return {
    success: true as const,
  };
}
