import { z } from "zod";
import type {
  PlanDivisionInput,
  PlanOvertimeInput,
  PlanUnitInput,
  WeeklyPlanRequest,
} from "@smsystem/contracts/calendar";
import {
  divisionCapacitySummarySchema,
  planRecommendationSchema,
  planningWorkspaceEnvelopeSchema,
  planAlertSchema,
  weeklyGapResultSchema,
  weeklyPlanPublishEnvelopeSchema,
  weeklyPlanSchema,
} from "@smsystem/contracts/calendar";
import {
  planningEvaluationEnvelopeSchema,
  type PlanningEvaluationDivisionRecord,
  type PlanningEvaluationMode,
  type PlanningEvaluationSpan,
  type PlanningEvaluationSummary,
} from "@smsystem/contracts/planning-evaluation";
import { getApiBaseUrl } from "@/shared/api/config";

const overtimeRecordSchema = z.object({
  divisionId: z.number(),
  divisionName: z.string(),
  overtimeDate: z.string(),
  dayType: z.enum(["WEEKDAY", "SATURDAY", "SUNDAY"]),
  overtimeHours: z.number(),
  memberCount: z.number(),
  includeHead: z.boolean(),
  notes: z.string().nullable(),
});

const unitAllocationRecordSchema = z.object({
  carId: z.string(),
  divisionId: z.number(),
  divisionName: z.string(),
  allocatedHours: z.number(),
  priorityRank: z.number().nullable(),
  notes: z.string().nullable(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  isMargin: z.boolean(),
  materialStatus: z.enum(["READY", "HUNTING", "ORDERED", "VENDOR"]),
  materialReady: z.boolean(),
  materialNote: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  remainingHours: z.number(),
});

const planningUnitRecordSchema = z.object({
  carId: z.string(),
  unitName: z.string(),
  customerName: z.string().nullable(),
  targetDeliveryDate: z.string().nullable(),
  remainingHours: z.number(),
  isMargin: z.boolean(),
  materialStatus: z.enum(["READY", "HUNTING", "ORDERED", "VENDOR"]),
  materialReady: z.boolean(),
  materialNote: z.string().nullable(),
  lockedDivisionName: z.string().nullable(),
});

const weeklyPlanDetailEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    plan: weeklyPlanSchema.nullable(),
    capacity: z.array(divisionCapacitySummarySchema),
    gap: weeklyGapResultSchema,
    alerts: z.array(planAlertSchema),
    recommendations: planRecommendationSchema.nullable(),
    overtime: z.array(overtimeRecordSchema),
    divisionInputs: z.array(
      z.object({
        divisionId: z.number(),
        divisionName: z.string(),
        autoMemberCount: z.number(),
        memberCount: z.number(),
      }),
    ),
    units: z.array(unitAllocationRecordSchema),
    planningUnits: z.array(planningUnitRecordSchema),
  }),
});

const weeklyPlanEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: weeklyPlanSchema,
});

const weeklyPlanCapacityEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(divisionCapacitySummarySchema),
});

const weeklyPlanSnapshotEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    snapshotCount: z.number(),
    capacity: z.array(divisionCapacitySummarySchema),
  }),
});

const weeklyPlanGapEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: weeklyGapResultSchema,
});

const weeklyPlanAlertsEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(planAlertSchema),
});

export type WeeklyPlanOvertimeRecord = z.infer<typeof overtimeRecordSchema>;
export type WeeklyPlanUnitAllocationRecord = z.infer<typeof unitAllocationRecordSchema>;
export type WeeklyPlanUnitRiskRecord = z.infer<typeof planningUnitRecordSchema>;
export type WeeklyPlanDetailPayload = z.infer<typeof weeklyPlanDetailEnvelopeSchema>["data"];
export type PlanningWorkspacePayload = z.infer<typeof planningWorkspaceEnvelopeSchema>["data"];
export type PlanningEvaluationPayload = {
  date: string;
  dateTo: string;
  span: PlanningEvaluationSpan;
  mode: PlanningEvaluationMode;
  summary: PlanningEvaluationSummary;
  divisions: PlanningEvaluationDivisionRecord[];
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

async function postWithCredentials(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    return {
      ...(await parseFailure(response)),
      success: false as const,
    };
  }

  return {
    success: true as const,
    payload: await response.json(),
  };
}

export async function fetchWeeklyPlan(cookieHeader: string, weekStartDate: string) {
  const response = await fetchWithCookie(
    `/api/planning/weekly-plan/${encodeURIComponent(weekStartDate)}`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: weeklyPlanDetailEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchPlanningWorkspaceSummary(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = toUrlSearchParams(searchParams);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetchWithCookie(`/api/planning/workspace${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: planningWorkspaceEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchPlanningEvaluation(
  cookieHeader: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = toUrlSearchParams(searchParams);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetchWithCookie(`/api/planning/evaluation${suffix}`, cookieHeader);

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: planningEvaluationEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function upsertWeeklyPlan(input: WeeklyPlanRequest) {
  const result = await postWithCredentials("/api/planning/weekly-plan", input);
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanEnvelopeSchema.parse(result.payload).data,
  };
}

export async function setWeeklyPlanOvertime(planId: string, rows: PlanOvertimeInput[]) {
  const result = await postWithCredentials(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/overtime`,
    { rows },
  );
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanCapacityEnvelopeSchema.parse(result.payload).data,
  };
}

export async function setWeeklyPlanDivisions(planId: string, rows: PlanDivisionInput[]) {
  const result = await postWithCredentials(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/divisions`,
    { rows },
  );
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanCapacityEnvelopeSchema.parse(result.payload).data,
  };
}

export async function setWeeklyPlanUnits(planId: string, rows: PlanUnitInput[]) {
  const result = await postWithCredentials(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/units`,
    { rows },
  );
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanCapacityEnvelopeSchema.parse(result.payload).data,
  };
}

export async function snapshotWeeklyPlanAbsence(planId: string) {
  const result = await postWithCredentials(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/snapshot-absence`,
  );
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanSnapshotEnvelopeSchema.parse(result.payload).data,
  };
}

export async function publishWeeklyPlan(planId: string) {
  const result = await postWithCredentials(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/publish`,
  );
  if (!result.success) {
    return result;
  }

  return {
    success: true as const,
    result: weeklyPlanPublishEnvelopeSchema.parse(result.payload).data,
  };
}

export async function fetchWeeklyPlanGap(cookieHeader: string, planId: string) {
  const response = await fetchWithCookie(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/gap`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: weeklyPlanGapEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}

export async function fetchWeeklyPlanAlerts(cookieHeader: string, planId: string) {
  const response = await fetchWithCookie(
    `/api/planning/weekly-plan/${encodeURIComponent(planId)}/alerts`,
    cookieHeader,
  );

  if (!response || !response.ok) {
    return {
      payload: null,
      status: response?.status ?? 503,
    };
  }

  return {
    payload: weeklyPlanAlertsEnvelopeSchema.parse(await response.json()),
    status: response.status,
  };
}
