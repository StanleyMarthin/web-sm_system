import type { JobPlanRuntimeReadItem } from "@smsystem/contracts/job-plan-runtime";
import { jobPlanRuntimeListEnvelopeSchema } from "@smsystem/contracts/job-plan-runtime";
import { getApiEnv } from "@/config/env";

type Fetcher = typeof fetch;

export interface JobPlanRuntimeReadModel {
  listByCoreIds(userId: string, coreIds: string[]): Promise<JobPlanRuntimeReadItem[]>;
}

function baseUrl(input?: string) {
  const value = input?.trim() || getApiEnv().JOB_PLAN_RUNTIME_BASE_URL;
  if (!value) {
    throw new Error("JOB_PLAN_RUNTIME_READ_MODEL_UNAVAILABLE");
  }

  return value.replace(/\/$/u, "");
}

export class HttpJobPlanRuntimeReadModel implements JobPlanRuntimeReadModel {
  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly upstreamBaseUrl?: string,
  ) {}

  async listByCoreIds(userId: string, coreIds: string[]): Promise<JobPlanRuntimeReadItem[]> {
    const uniqueCoreIds = [...new Set(coreIds.map((coreId) => coreId.trim()).filter(Boolean))];
    if (uniqueCoreIds.length === 0) return [];

    const itemGroups = await Promise.all(uniqueCoreIds.map((coreId) => this.fetchCore(userId, coreId)));
    return itemGroups.flat();
  }

  private async fetchCore(userId: string, coreId: string): Promise<JobPlanRuntimeReadItem[]> {
    const params = new URLSearchParams({
      userId,
      view: "browse",
      coreId,
      limit: "200",
    });
    const items: JobPlanRuntimeReadItem[] = [];
    const seen = new Set<string>();
    for (let page = 1; ; page++) {
      params.set("page", String(page));
      const response = await this.fetcher(
        `${baseUrl(this.upstreamBaseUrl)}/sm/job-plans/v2?${params.toString()}`,
        { signal: AbortSignal.timeout(2_500) },
      );
      if (!response.ok) throw new Error("JOB_PLAN_RUNTIME_READ_MODEL_UNAVAILABLE");
      const payload = jobPlanRuntimeListEnvelopeSchema.parse(await response.json());
      for (const item of payload.data.items) {
        if (seen.has(item.plan_id)) throw new Error("JOB_PLAN_RUNTIME_PAGE_REPEATED");
        seen.add(item.plan_id);
        items.push(item);
      }
      if (payload.data.items.length < 200) return items;
    }
  }
}
