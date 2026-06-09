import { z } from "zod";
import { getApiBaseUrl } from "@/shared/api/config";

const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const workControlUnitSchema = z.object({
  unitId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable().optional(),
  carId: z.string(),
  progressPercent: z.number(),
  riskLevel: riskLevelSchema,
  remainingJobCount: z.number(),
  remainingHours: z.number(),
  targetDeliveryDate: z.string().nullable(),
  status: z.string().optional(),
});

const workControlUnitsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(workControlUnitSchema),
});

const unitProgressResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unitId: z.string(),
    progressPercent: z.number(),
    remainingHours: z.number(),
    totalEstimatedHours: z.number(),
    actualHours: z.number(),
    roughEstimateDays: z.number(),
    mainConstraint: z.string().nullable(),
    involvedDivisions: z.array(
      z.object({
        divisionId: z.string(),
        divisionName: z.string(),
        pendingHours: z.number(),
        targetHours: z.number().optional().default(0),
        actualHours: z.number().optional().default(0),
      }),
    ),
    jobs: z.array(
      z.object({
        jobId: z.string(),
        divisionId: z.string().nullable().optional().default(null),
        divisionName: z.string().nullable().optional().default(null),
        jobName: z.string(),
        panel: z.string().nullable().optional().default(null),
        status: z.string(),
        estimatedHours: z.number(),
        actualHours: z.number().nullable(),
        remainingHours: z.number().optional().default(0),
        dependsOn: z.array(z.string()).optional().default([]),
        startDate: z.string().nullable().optional().default(null),
        deadlineDate: z.string().nullable().optional().default(null),
        qcLastStatus: z.string().nullable().optional().default(null),
      }),
    ),
  }),
});

const capacityResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(
    z.object({
      divisionId: z.string(),
      divisionName: z.string(),
      totalMembers: z.number(),
      activeMembers: z.number(),
      absentMembers: z.number(),
      normalCapacityHours: z.number(),
      absenceHours: z.number(),
      availableCapacityHours: z.number(),
      absentMemberDetails: z.array(
        z.object({
          memberId: z.string(),
          memberName: z.string(),
          absenceType: z.string(),
          startDate: z.string(),
          endDate: z.string(),
        }),
      ),
    }),
  ),
});

const createTargetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    planningTargetId: z.string(),
    status: z.literal("DRAFT"),
  }),
});

const releaseSpkResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    spkIds: z.array(z.string()),
    message: z.string(),
  }),
});

const overtimeRecommendationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    recommendationId: z.string(),
    status: z.literal("RECOMMENDED"),
  }),
});

const planningSplRecommendationListResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(
    z.object({
      planningTargetId: z.string(),
      periodStart: z.string(),
      periodEnd: z.string(),
      divisionId: z.string(),
      divisionName: z.string(),
      shortageHours: z.number(),
      recommendedOvertimeHours: z.number(),
      unitCount: z.number(),
      targetCount: z.number(),
      firstNeedDate: z.string().nullable(),
      lastNeedDate: z.string().nullable(),
      reason: z.string().nullable(),
      status: z.enum(["RECOMMENDED", "APPROVED", "REJECTED"]).nullable(),
    }),
  ),
});

const serviceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  divisionId: z.string(),
  estimatedHours: z.number(),
  applicableConditions: z.array(z.string()),
});

const serviceTemplateListResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(serviceTemplateSchema),
});

const serviceIntakeResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    intakeId: z.string(),
    status: z.literal("DRAFT"),
  }),
});

const criticalPathSnapshotResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unitId: z.string(),
    savedAt: z.string(),
  }),
});

const labourOverrideResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    unitId: z.string(),
    savedAt: z.string(),
  }),
});

export type WorkControlUnit = z.infer<typeof workControlUnitSchema>;
export type WorkControlUnitProgress = z.infer<typeof unitProgressResponseSchema>["data"];
export type WorkControlDivisionCapacity = z.infer<typeof capacityResponseSchema>["data"][number];
export type PlanningSplRecommendation = z.infer<
  typeof planningSplRecommendationListResponseSchema
>["data"][number];
export type WorkControlServiceTemplate = z.infer<typeof serviceTemplateSchema>;
export type CreateWorkControlTargetInput = {
  planningTargetId?: string;
  weekStartDate: string;
  units: {
    carId: string;
    divisionId: string;
    targetHours: number;
    targetOutput: string;
    targetFinishDate: string;
    priority: number;
    riskLevel: z.infer<typeof riskLevelSchema>;
    notes?: string;
  }[];
};

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

async function fetchWithCookie(path: string, cookieHeader: string) {
  try {
    return await fetch(`${getApiBaseUrl()}${path}`, {
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

async function getWithCredentials(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    throw new Error(failure.message || "Data Work Control belum bisa dimuat.");
  }

  return response;
}

async function postWithCredentials(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const failure = await parseFailure(response);
    throw new Error(failure.message || "Work Control belum bisa diproses.");
  }

  return response;
}

export async function fetchWorkControlUnits(cookieHeader: string) {
  const response = await fetchWithCookie(
    "/api/planning/work-control/units",
    cookieHeader,
  );
  if (!response?.ok) {
    return { payload: null, status: response?.status ?? 503 };
  }

  const parsed = workControlUnitsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { payload: null, status: 422 };
  }

  return { payload: parsed.data, status: response.status };
}

export async function fetchWorkControlUnitsClient() {
  const response = await getWithCredentials("/api/planning/work-control/units");
  return workControlUnitsResponseSchema.parse(await response.json());
}

export async function fetchUnitProgress(unitId: string) {
  const response = await getWithCredentials(
    `/api/planning/work-control/units/${encodeURIComponent(unitId)}/progress`,
  );
  return unitProgressResponseSchema.parse(await response.json());
}

export async function fetchDivisionCapacity(params: {
  periodStart: string;
  periodEnd: string;
  divisionIds?: string[];
}) {
  const search = new URLSearchParams({
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  if (params.divisionIds && params.divisionIds.length > 0) {
    search.set("divisionIds", params.divisionIds.join(","));
  }

  const response = await getWithCredentials(
    `/api/planning/work-control/capacity?${search.toString()}`,
  );
  return capacityResponseSchema.parse(await response.json());
}

export async function createWorkControlTarget(input: CreateWorkControlTargetInput) {
  const response = await postWithCredentials(
    "/api/planning/work-control/targets",
    input,
  );
  return createTargetResponseSchema.parse(await response.json());
}

export async function releaseSpk(planningTargetId: string) {
  const response = await postWithCredentials(
    "/api/planning/work-control/release-spk",
    { planningTargetId },
  );
  return releaseSpkResponseSchema.parse(await response.json());
}

export async function createOvertimeRecommendation(input: {
  planningTargetId: string;
  divisionId: string;
  shortageHours: number;
  reason: string;
}) {
  const response = await postWithCredentials(
    "/api/planning/work-control/overtime-recommendation",
    input,
  );
  return overtimeRecommendationResponseSchema.parse(await response.json());
}

export async function fetchPlanningSplRecommendations(
  cookieHeader: string,
  params: { periodStart: string; periodEnd: string },
) {
  const search = new URLSearchParams({
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });
  const response = await fetchWithCookie(
    `/api/planning/work-control/overtime-recommendations?${search.toString()}`,
    cookieHeader,
  );
  if (!response?.ok) {
    return { payload: null, status: response?.status ?? 503 };
  }

  const parsed = planningSplRecommendationListResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { payload: null, status: 422 };
  }

  return { payload: parsed.data, status: response.status };
}

export async function fetchServiceTemplates() {
  const response = await getWithCredentials("/api/planning/work-control/service-templates");
  return serviceTemplateListResponseSchema.parse(await response.json());
}

export async function createServiceIntake(input: {
  unitId: string;
  diagnosis: string;
  templateIds: string[];
  totalEstimatedHours: number;
  capacityStatus: "SPK_READY" | "SPK_WITH_SPL" | "TARGET_PERLU_DIREVISI";
  targetFinishDate: string;
}) {
  const response = await postWithCredentials(
    "/api/planning/work-control/service-intakes",
    input,
  );
  return serviceIntakeResponseSchema.parse(await response.json());
}

export async function saveCriticalPathSnapshot(input: {
  unitId: string;
  summary: unknown;
}) {
  const response = await postWithCredentials(
    "/api/planning/work-control/calculation-snapshots",
    input,
  );
  return criticalPathSnapshotResponseSchema.parse(await response.json());
}

export async function saveLabourOverride(input: {
  unitId: string;
  billableHours: number;
  nonBillableHours?: number;
  warrantyHours?: number;
}) {
  const response = await postWithCredentials(
    "/api/planning/work-control/labour-overrides",
    input,
  );
  return labourOverrideResponseSchema.parse(await response.json());
}
