import { z } from "zod";
import { getApiBaseUrl } from "@/shared/api/config";

const masterJobTypeSchema = z.object({
  id: z.string(),
  divisionId: z.number().int().nullable(),
  jobName: z.string(),
  isTeknis: z.boolean(),
});

const divisionManagementRecordSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  code: z.string(),
  isTeknis: z.boolean(),
  parentId: z.number().int().nullable(),
  userCount: z.number().int().nonnegative(),
  activeUserCount: z.number().int().nonnegative(),
  managedByCount: z.number().int().nonnegative(),
  jobTypes: z.array(masterJobTypeSchema),
});

const divisionManagementEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    divisions: z.array(divisionManagementRecordSchema),
    generalJobTypes: z.array(masterJobTypeSchema),
  }),
});

const createMasterJobdescEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    jobType: masterJobTypeSchema,
  }),
});

const divisionMutationEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    division: divisionManagementRecordSchema,
  }),
});

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

export async function fetchDivisionManagement(cookieHeader: string) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/divisions`, {
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
      payload: divisionManagementEnvelopeSchema.parse(await response.json()),
      status: response.status,
    };
  } catch {
    return {
      payload: null,
      status: 503,
    };
  }
}

export async function createDivisionMasterJobdesc(
  divisionId: number | null,
  input: {
    jobName: string;
    isTeknis: boolean;
  },
) {
  const endpoint =
    divisionId === null
      ? `${getApiBaseUrl()}/api/admin/job-types`
      : `${getApiBaseUrl()}/api/admin/divisions/${divisionId}/job-types`;

  const response = await fetch(endpoint, {
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

  const payload = createMasterJobdescEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    jobType: payload.data.jobType,
  };
}

export async function createDivision(input: {
  name: string;
  code: string;
  isTeknis: boolean;
  parentId: number | null;
}) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/divisions`, {
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

  const payload = divisionMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    division: payload.data.division,
  };
}

export async function updateDivision(
  divisionId: number,
  input: {
    name: string;
    code: string;
    isTeknis: boolean;
    parentId: number | null;
  },
) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/divisions/${divisionId}`, {
    method: "PATCH",
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

  const payload = divisionMutationEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    division: payload.data.division,
  };
}

export async function deleteDivision(divisionId: number) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/divisions/${divisionId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  return {
    success: true as const,
  };
}

export async function updateDivisionMasterJobdesc(
  jobTypeId: string,
  input: {
    jobName: string;
    isTeknis: boolean;
  },
) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/job-types/${jobTypeId}`, {
    method: "PATCH",
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

  const payload = createMasterJobdescEnvelopeSchema.parse(await response.json());
  return {
    success: true as const,
    jobType: payload.data.jobType,
  };
}

export async function deleteDivisionMasterJobdesc(jobTypeId: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/job-types/${jobTypeId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  return {
    success: true as const,
  };
}

export type DivisionManagementRecord = z.infer<typeof divisionManagementRecordSchema>;
export type MasterJobTypeRecord = z.infer<typeof masterJobTypeSchema>;
