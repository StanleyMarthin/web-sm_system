import type { UnitBomNode, UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type {
  BlockerType,
  BomPlanningSnapshot,
  CriticalPathNode,
  CriticalPathResult,
  EngineStatus,
  LabourSummary,
  PanelStatus,
  ServiceIntake,
  ServiceTemplate,
} from "@/modules/planning/types/planning.types";
import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";

const RISK_SPREAD: Record<RiskLevel, number> = {
  LOW: 0.12,
  MEDIUM: 0.22,
  HIGH: 0.34,
  CRITICAL: 0.48,
};

const P80_Z = 0.842;
const P95_Z = 1.645;

export interface CriticalPathJobInput {
  jobId: string;
  divisionId: string | null;
  correctedHours: number;
  allocatedDailyCapacity: number;
  planningStartDate: Date;
  materialReadyDate?: Date | null;
  vendorReturnDate?: Date | null;
  dependsOn: string[];
  riskLevel: RiskLevel;
  blockedBy: BlockerType[];
}

interface ScheduledJob extends CriticalPathJobInput {
  duration: number;
  variance: number;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + Math.max(0, Math.ceil(days)));
  return next;
}

function maxDate(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function diffDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.ceil((end - start) / 86_400_000));
}

function flattenBomNodes(nodes: UnitBomNode[]): UnitBomNode[] {
  return nodes.flatMap((node) => [node, ...flattenBomNodes(node.children)]);
}

function riskAdjustedVariance(duration: number, riskLevel: RiskLevel): number {
  const spread = Math.max(1, duration * RISK_SPREAD[riskLevel]);
  return Number(((spread / 6) ** 2).toFixed(4));
}

function buildScheduledJob(input: CriticalPathJobInput): ScheduledJob {
  const duration = Math.max(1, Math.ceil(input.correctedHours / Math.max(1, input.allocatedDailyCapacity)));
  return {
    ...input,
    duration,
    variance: riskAdjustedVariance(duration, input.riskLevel),
  };
}

export function calculateCriticalPath(jobs: CriticalPathJobInput[]): CriticalPathResult {
  const scheduledJobs = jobs.map(buildScheduledJob);
  const byId = new Map(scheduledJobs.map((job) => [job.jobId, job]));
  const nodes = new Map<string, CriticalPathNode>();
  const visiting = new Set<string>();

  function schedule(jobId: string): CriticalPathNode {
    const existing = nodes.get(jobId);
    if (existing) return existing;

    const job = byId.get(jobId);
    if (!job) {
      throw new Error(`Missing critical path job ${jobId}`);
    }
    if (visiting.has(jobId)) {
      throw new Error(`Circular dependency detected at ${jobId}`);
    }

    visiting.add(jobId);
    const dependencyNodes = job.dependsOn
      .filter((dependencyId) => byId.has(dependencyId))
      .map((dependencyId) => schedule(dependencyId));
    visiting.delete(jobId);

    const earliestStart = maxDate([
      job.planningStartDate,
      ...(job.materialReadyDate ? [job.materialReadyDate] : []),
      ...(job.vendorReturnDate ? [job.vendorReturnDate] : []),
      ...dependencyNodes.map((node) => node.finishDate),
    ]);
    const finishDate = addDays(earliestStart, job.duration);
    const node: CriticalPathNode = {
      jobId: job.jobId,
      divisionId: job.divisionId ?? "",
      earliestStart,
      duration: job.duration,
      finishDate,
      blockedBy: job.blockedBy,
      dependsOn: job.dependsOn.filter((dependencyId) => byId.has(dependencyId)),
      isCritical: false,
    };
    nodes.set(jobId, node);
    return node;
  }

  for (const job of scheduledJobs) {
    schedule(job.jobId);
  }

  const allNodes = [...nodes.values()];
  const unitDeliveryDate = allNodes.length > 0 ? maxDate(allNodes.map((node) => node.finishDate)) : new Date();
  const criticalEnd = allNodes.find((node) => node.finishDate.getTime() === unitDeliveryDate.getTime());
  const criticalIds = new Set<string>();

  function markCritical(node: CriticalPathNode | undefined) {
    if (!node || criticalIds.has(node.jobId)) return;
    criticalIds.add(node.jobId);
    const dependencyNodes = node.dependsOn
      .map((dependencyId) => nodes.get(dependencyId))
      .filter((dependency): dependency is CriticalPathNode => Boolean(dependency));
    const predecessor = dependencyNodes.sort((left, right) => right.finishDate.getTime() - left.finishDate.getTime())[0];
    markCritical(predecessor);
  }

  markCritical(criticalEnd);

  const criticalNodes = allNodes.map((node) => ({
    ...node,
    isCritical: criticalIds.has(node.jobId),
  }));
  const totalVariance = Number(
    scheduledJobs
      .filter((job) => criticalIds.has(job.jobId))
      .reduce((sum, job) => sum + job.variance, 0)
      .toFixed(4),
  );
  const stdDev = Number(Math.sqrt(totalVariance).toFixed(4));
  const planningStartDate = jobs[0]?.planningStartDate ?? new Date();
  const meanDuration = diffDays(planningStartDate, unitDeliveryDate);

  return {
    nodes: criticalNodes.sort((left, right) => left.earliestStart.getTime() - right.earliestStart.getTime()),
    unitDeliveryDate,
    totalVariance,
    stdDev,
    p50Date: addDays(planningStartDate, meanDuration),
    p80Date: addDays(planningStartDate, meanDuration + P80_Z * stdDev),
    p95Date: addDays(planningStartDate, meanDuration + P95_Z * stdDev),
  };
}

export function blockerFromPanelStatus(status: PanelStatus): BlockerType | null {
  if (status === "ORDER_PR" || status === "CANNIBALIZED") return "HOLD_MATERIAL";
  if (status === "AT_VENDOR") return "HOLD_VENDOR";
  if (status === "QC_REJECT") return "QC_REJECT";
  if (status === "DISASSEMBLED") return "WAITING_DIVISION";
  return null;
}

function panelStatusFromBomNode(node: UnitBomNode): PanelStatus {
  if (node.detail?.workStatusLabel.toUpperCase().includes("TIDAK_LOLOS")) return "QC_REJECT";
  if (node.logisticStatus) return node.logisticStatus;
  if (node.physicalStatus) return node.physicalStatus;
  return "DISASSEMBLED";
}

export function buildBomPlanningSnapshots(bom: UnitBomWorkspace | null): BomPlanningSnapshot[] {
  if (!bom) return [];
  return flattenBomNodes(bom.tree)
    .filter((node) => node.nodeType === "PART")
    .map((node) => {
      const status = panelStatusFromBomNode(node);
      const blockerType = blockerFromPanelStatus(status);
      const hours = Math.max(0, Number(node.remainingHours ?? 0));
      return {
        panelId: String(node.panelId ?? node.nodeId),
        partId: node.actualId ?? node.nodeId,
        status,
        blockerType,
        blockedHours: blockerType ? hours : 0,
        readyHours: blockerType ? 0 : hours,
        earliestAvailableDate: null,
      };
    });
}

export function buildLabourSummary(input: {
  unitId: string;
  targetHours: number;
  actualHours: number;
  billableHours?: number | null;
  warrantyHours?: number;
}): LabourSummary {
  const billableHours = Math.max(0, input.billableHours ?? input.actualHours);
  const warrantyHours = Math.max(0, input.warrantyHours ?? 0);
  const nonBillableHours = Math.max(0, input.actualHours - billableHours);
  return {
    unitId: input.unitId,
    targetHours: Math.max(0, input.targetHours),
    actualHours: Math.max(0, input.actualHours),
    billableHours,
    nonBillableHours,
    warrantyHours,
    lostHours: Math.max(0, input.actualHours - billableHours),
  };
}

export function summarizeLabourByDivision(
  divisions: Array<{ divisionId: number; divisionName: string; targetHours?: number; actualHours?: number }>,
): Array<{ divisionId: string; divisionName: string; targetHours: number; actualHours: number; billableHours: number; lostHours: number }> {
  const grouped = new Map<string, { divisionName: string; targetHours: number; actualHours: number }>();
  for (const division of divisions) {
    const key = String(division.divisionId);
    const current = grouped.get(key) ?? {
      divisionName: division.divisionName,
      targetHours: 0,
      actualHours: 0,
    };
    current.targetHours += Math.max(0, division.targetHours ?? 0);
    current.actualHours += Math.max(0, division.actualHours ?? 0);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([divisionId, row]) => ({
    divisionId,
    divisionName: row.divisionName,
    targetHours: Number(row.targetHours.toFixed(2)),
    actualHours: Number(row.actualHours.toFixed(2)),
    billableHours: Number(row.actualHours.toFixed(2)),
    lostHours: 0,
  }));
}

export function buildServiceIntake(input: {
  unitId: string;
  diagnosis: string;
  templateIds: string[];
  templates: ServiceTemplate[];
  availableHours: number;
  startDate: Date;
}): ServiceIntake {
  const templates = input.templates;
  const selected = templates.filter((template) => input.templateIds.includes(template.id));
  const totalEstimatedHours = selected.reduce((sum, template) => sum + template.estimatedHours, 0);
  const capacityStatus: EngineStatus =
    totalEstimatedHours <= input.availableHours
      ? "SPK_READY"
      : totalEstimatedHours <= input.availableHours * 1.25
        ? "SPK_WITH_SPL"
        : "TARGET_PERLU_DIREVISI";

  return {
    unitId: input.unitId,
    diagnosis: input.diagnosis,
    templateIds: input.templateIds,
    totalEstimatedHours,
    capacityStatus,
    targetFinishDate: addDays(input.startDate, Math.max(1, Math.ceil(totalEstimatedHours / 8))),
  };
}
