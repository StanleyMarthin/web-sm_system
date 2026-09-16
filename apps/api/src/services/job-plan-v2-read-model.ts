import type { JobPlanV2ReadItem } from "@smsystem/contracts/job-plan-v2";
import { jobPlanV2ListEnvelopeSchema } from "@smsystem/contracts/job-plan-v2";
import { getApiEnv } from "@/config/env";

type Fetcher = typeof fetch;

export interface JobPlanV2ReadModel {
  listByCoreIds(userId: string, coreIds: string[]): Promise<JobPlanV2ReadItem[]>;
}

function baseUrl(input?: string) {
  const value = input?.trim() || getApiEnv().JOB_PLAN_V2_BASE_URL;
  if (!value) {
    throw new Error("JOB_PLAN_V2_READ_MODEL_UNAVAILABLE");
  }

  return value.replace(/\/$/u, "");
}

export class HttpJobPlanV2ReadModel implements JobPlanV2ReadModel {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly upstreamBaseUrl?: string,
  ) {}

  async listByCoreIds(userId: string, coreIds: string[]): Promise<JobPlanV2ReadItem[]> {
    const uniqueCoreIds = [...new Set(coreIds.map((coreId) => coreId.trim()).filter(Boolean))];
    if (uniqueCoreIds.length === 0) return [];

    const itemGroups = await Promise.all(uniqueCoreIds.map((coreId) => this.fetchCore(userId, coreId)));
    return itemGroups.flat();
  }

  private async fetchCore(userId: string, coreId: string): Promise<JobPlanV2ReadItem[]> {
    const params = new URLSearchParams({
      userId,
      view: "browse",
      coreId,
    });
    const response = await this.fetcher(
      `${baseUrl(this.upstreamBaseUrl)}/sm/job-plans/v2?${params.toString()}`,
      { signal: AbortSignal.timeout(2_500) },
    );
    if (!response.ok) {
      throw new Error("JOB_PLAN_V2_READ_MODEL_UNAVAILABLE");
    }

    const payload = jobPlanV2ListEnvelopeSchema.parse(await response.json());
    return payload.data.items;
  }
}
