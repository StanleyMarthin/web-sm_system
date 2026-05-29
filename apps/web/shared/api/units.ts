import {
  unitBoardEnvelopeSchema,
  unitBoardRowSchema,
  unitWorkspaceEnvelopeSchema,
} from "@smsystem/contracts/unit";
import { unitBomWorkspaceEnvelopeSchema } from "@smsystem/contracts/unit-bom";
import { z } from "zod";
import { getApiBaseUrl } from "@/shared/api/config";

const unitDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unit: unitBoardRowSchema,
  }),
});

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

export function buildUnitGridQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  return toUrlSearchParams(searchParams).toString();
}

export async function fetchUnitBoard(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const queryString = buildUnitGridQueryString(searchParams);
  const suffix = queryString ? `?${queryString}` : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/units${suffix}`, {
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
      payload: unitBoardEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchUnitDetail(cookieHeader: string, unitId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}`, {
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
      payload: unitDetailEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchUnitWorkspace(cookieHeader: string, unitId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/workspace`, {
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
      payload: unitWorkspaceEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchUnitBom(cookieHeader: string, unitId: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/bom`, {
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
      payload: unitBomWorkspaceEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}
