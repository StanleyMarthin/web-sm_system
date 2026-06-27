import {
  unitDeleteEnvelopeSchema,
  unitBoardEnvelopeSchema,
  unitBoardRowSchema,
  unitMutationEnvelopeSchema,
  unitWorkspaceEnvelopeSchema,
  type CreateUnitRequest,
  type UpdateUnitRequest,
} from "@smsystem/contracts/unit";
import { unitBomWorkspaceEnvelopeSchema } from "@smsystem/contracts/unit-bom";
import {
  workflowLayoutEnvelopeSchema,
  type WorkflowLayoutPayload,
} from "@smsystem/contracts/workflow-layout";
import {
  unitPanelCategoryRenameEnvelopeSchema,
  unitPanelCollectionEnvelopeSchema,
  unitPanelDeleteEnvelopeSchema,
  unitPanelGeneralCollectionEnvelopeSchema,
  unitPanelMutationEnvelopeSchema,
  type CreateUnitPanelRequest,
  type RenameUnitPanelCategoryRequest,
  type UpdateUnitPanelRequest,
} from "@smsystem/contracts/unit-panel";
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

interface ApiFailure {
  success: false;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}

async function parseFailure(response: Response): Promise<ApiFailure> {
  try {
    return (await response.json()) as ApiFailure;
  } catch {
    return {
      success: false,
      message: "Response API tidak valid.",
      errorCode: "INVALID_RESPONSE",
      data: {},
    };
  }
}

function buildServerOrBrowserRequestInit(cookieHeader: string) {
  if (cookieHeader) {
    return {
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store" as const,
    };
  }

  return {
    credentials: "include" as const,
    cache: "no-store" as const,
  };
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
    const response = await fetch(`${getApiBaseUrl()}/api/units${suffix}`, buildServerOrBrowserRequestInit(cookieHeader));

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
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}`, buildServerOrBrowserRequestInit(cookieHeader));

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
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/workspace`, buildServerOrBrowserRequestInit(cookieHeader));

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
    const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/bom`, buildServerOrBrowserRequestInit(cookieHeader));

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

export async function fetchWorkflowLayout(
  cookieHeader: string,
  unitId: string,
  scopeId: string,
) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/units/${encodeURIComponent(unitId)}/workflow-layout/${encodeURIComponent(scopeId)}`,
      buildServerOrBrowserRequestInit(cookieHeader),
    );

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: workflowLayoutEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function saveWorkflowLayout(
  unitId: string,
  scopeId: string,
  layout: WorkflowLayoutPayload,
) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/units/${encodeURIComponent(unitId)}/workflow-layout/${encodeURIComponent(scopeId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(layout),
    },
  );

  if (!response.ok) {
    const failure = await parseFailure(response);
    return {
      ...failure,
      success: false as const,
    };
  }

  const payload = workflowLayoutEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.layout,
  };
}

export async function createUnit(input: CreateUnitRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/units`, {
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

  const payload = unitMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.unit,
  };
}

export async function updateUnit(unitId: string, input: UpdateUnitRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}`, {
    method: "PUT",
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

  const payload = unitMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.unit,
  };
}

export async function deleteUnit(unitId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = unitDeleteEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function fetchUnitPanels(cookieHeader: string, unitId: string) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/units/${unitId}/master-panels`,
      buildServerOrBrowserRequestInit(cookieHeader),
    );

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: unitPanelCollectionEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function fetchUnitPanelGeneralTemplates(cookieHeader: string) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/units/master-panels/general`,
      buildServerOrBrowserRequestInit(cookieHeader),
    );

    if (!response.ok) {
      return {
        payload: null,
        status: response.status,
      };
    }

    return {
      payload: unitPanelGeneralCollectionEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createUnitPanel(unitId: string, input: CreateUnitPanelRequest) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/master-panels`, {
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

  const payload = unitPanelMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.record,
  };
}

export async function updateUnitPanel(
  unitId: string,
  panelId: number,
  input: UpdateUnitPanelRequest,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/master-panels/${panelId}`, {
    method: "PUT",
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

  const payload = unitPanelMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data.record,
  };
}

export async function renameUnitPanelCategory(
  unitId: string,
  input: RenameUnitPanelCategoryRequest,
) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/master-panels/category`, {
    method: "PUT",
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

  const payload = unitPanelCategoryRenameEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}

export async function deleteUnitPanel(unitId: string, panelId: number) {
  const response = await fetch(`${getApiBaseUrl()}/api/units/${unitId}/master-panels/${panelId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  const payload = unitPanelDeleteEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    result: payload.data,
  };
}
