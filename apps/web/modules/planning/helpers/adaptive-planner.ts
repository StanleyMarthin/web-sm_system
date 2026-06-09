import type { UnitBomNode, UnitBomWorkspace } from "@smsystem/contracts/unit-bom";
import type { AssessmentCase, AssessmentItem, AssessmentItemKey, AssessmentStatus, DeliveryPrediction, EngineStatus, PlanningCapacitySnapshot, RecalculationLog, SpkSplDecision, WarrantyImpact } from "@/modules/planning/types/planning.types";
import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";

interface UnitProgressShape {
  carId: string;
  unitName: string;
  customerName: string | null;
  remainingHours: number;
  riskLevel: RiskLevel;
  targetDeliveryDate: string | null;
}

interface DivisionCapacityShape {
  divisionId: number;
  divisionName: string;
  totalMembers: number;
  activeMembers: number;
  absentMembers: number;
  normalCapacityHours: number;
  absenceHours: number;
  scheduledHours: number;
  availableCapacityHours: number;
}

export interface WarrantyReserveInput {
  divisionId: number;
  hours: number;
}

export interface ReadyBlockedHours {
  readyHours: number;
  blockedHours: number;
  waitingMaterialHours: number;
  waitingVendorHours: number;
  waitingOtherDivisionHours: number;
}

export interface AssessmentOverrideState {
  itemOverrides?: Partial<Record<AssessmentItemKey, boolean>>;
  kdReviewed?: boolean;
  locked?: boolean;
  notes?: string;
}

function flattenNodes(nodes: UnitBomNode[]): UnitBomNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(baseDate: string, days: number): Date {
  const [year, month, day] = baseDate.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function computeReadyBlockedHours(bom: UnitBomWorkspace | null): ReadyBlockedHours {
  if (!bom) {
    return {
      readyHours: 0,
      blockedHours: 0,
      waitingMaterialHours: 0,
      waitingVendorHours: 0,
      waitingOtherDivisionHours: 0,
    };
  }

  const nodes = flattenNodes(bom.tree).filter((node) => node.nodeType === "PART");
  let readyHours = 0;
  let blockedHours = 0;
  let waitingMaterialHours = 0;
  let waitingVendorHours = 0;
  let waitingOtherDivisionHours = 0;

  for (const node of nodes) {
    const hours = Number(node.remainingHours ?? 0);
    if (hours <= 0) {
      continue;
    }

    const statusLabel = node.detail?.workStatusLabel ?? "";
    const isVendor = node.logisticStatus === "AT_VENDOR";
    const isMaterial = node.logisticStatus === "ORDER_PR" || node.logisticStatus === "CANNIBALIZED";
    const isWaitingDivision = node.physicalStatus === "DISASSEMBLED" && !isVendor && !isMaterial;
    const isReady = node.physicalStatus === "INSTALLED" || node.physicalStatus === "IN_DIVISION";

    if (isVendor) {
      waitingVendorHours += hours;
      blockedHours += hours;
      continue;
    }

    if (isMaterial) {
      waitingMaterialHours += hours;
      blockedHours += hours;
      continue;
    }

    if (isWaitingDivision || statusLabel.toUpperCase().includes("PLAN")) {
      waitingOtherDivisionHours += hours;
      blockedHours += hours;
      continue;
    }

    if (isReady) {
      readyHours += hours;
      continue;
    }

    blockedHours += hours;
  }

  return {
    readyHours: Number(readyHours.toFixed(2)),
    blockedHours: Number(blockedHours.toFixed(2)),
    waitingMaterialHours: Number(waitingMaterialHours.toFixed(2)),
    waitingVendorHours: Number(waitingVendorHours.toFixed(2)),
    waitingOtherDivisionHours: Number(waitingOtherDivisionHours.toFixed(2)),
  };
}

function itemComplete(
  key: AssessmentItemKey,
  defaults: Record<AssessmentItemKey, boolean>,
  override?: Partial<Record<AssessmentItemKey, boolean>>,
) {
  return override?.[key] ?? defaults[key];
}

export function buildAssessmentCase(
  unit: UnitProgressShape,
  bom: UnitBomWorkspace | null,
  override?: AssessmentOverrideState,
): AssessmentCase {
  const readyBlocked = computeReadyBlockedHours(bom);
  const totalParts = bom?.summary.totalParts ?? 0;
  const defaults: Record<AssessmentItemKey, boolean> = {
    identity: true,
    bom: totalParts > 0,
    panelWorkflow: Boolean(bom && flattenNodes(bom.tree).some((node) => (node.detail?.timeline.length ?? 0) > 0)),
    materials: readyBlocked.waitingMaterialHours === 0,
    vendorWork: readyBlocked.waitingVendorHours === 0,
    labourEstimate: unit.remainingHours > 0,
    riskReview: unit.riskLevel !== "CRITICAL",
    kdReview: Boolean(override?.kdReviewed),
  };

  const itemConfig: Array<Pick<AssessmentItem, "key" | "label" | "isRequired">> = [
    { key: "identity", label: "Identitas unit", isRequired: true },
    { key: "bom", label: "BOM awal", isRequired: true },
    { key: "panelWorkflow", label: "Alur panel", isRequired: true },
    { key: "materials", label: "Material utama", isRequired: true },
    { key: "vendorWork", label: "Pekerjaan vendor", isRequired: false },
    { key: "labourEstimate", label: "Estimasi jam kerja", isRequired: true },
    { key: "riskReview", label: "Review risiko", isRequired: true },
    { key: "kdReview", label: "Review KD", isRequired: true },
  ];

  const items: AssessmentItem[] = itemConfig.map((item) => {
    const isComplete = itemComplete(item.key, defaults, override?.itemOverrides);
    let blockerLabel: string | null = null;

    if (!isComplete) {
      if (item.key === "bom") blockerLabel = "Lengkapi BOM utama dulu";
      else if (item.key === "panelWorkflow") blockerLabel = "Panel belum punya alur kerja";
      else if (item.key === "materials") blockerLabel = "Masih ada material yang menunggu";
      else if (item.key === "riskReview") blockerLabel = "Perlu review risiko sebelum hitung";
      else if (item.key === "kdReview") blockerLabel = "Belum ditinjau KD";
      else blockerLabel = "Masih perlu dilengkapi";
    }

    return {
      key: item.key,
      label: item.label,
      isRequired: item.isRequired,
      isComplete,
      blockerLabel,
    };
  });

  const missingKeys = items.filter((item) => item.isRequired && !item.isComplete).map((item) => item.key);
  const requiredCount = items.filter((item) => item.isRequired).length;
  const completedRequiredCount = items.filter((item) => item.isRequired && item.isComplete).length;
  const progressPercent = requiredCount === 0 ? 0 : Math.round((completedRequiredCount / requiredCount) * 100);

  let status: AssessmentStatus = "ASSESSMENT_DRAFT";
  if (progressPercent > 0) status = "ASSESSMENT_IN_PROGRESS";
  if (missingKeys.length > 0 && completedRequiredCount >= Math.max(1, requiredCount - 2)) status = "NEED_REVIEW_KD";
  if (missingKeys.length === 0) status = "READY_TO_CALCULATE";
  if (missingKeys.length === 0 && readyBlocked.readyHours > 0) status = "CALCULATED";
  if (override?.locked) status = "LOCKED";

  return {
    unitId: unit.carId,
    carId: unit.carId,
    unitName: unit.unitName,
    customerName: unit.customerName,
    status,
    gateLabel:
      status === "LOCKED"
        ? "Target Dikunci"
        : status === "CALCULATED"
          ? "Siap Dihitung"
          : status === "READY_TO_CALCULATE"
            ? "Siap Review"
            : status === "NEED_REVIEW_KD"
              ? "Minta Review KD"
              : "Pendataan Berjalan",
    canCalculate: missingKeys.length === 0,
    canLockTarget: status === "CALCULATED" || status === "LOCKED",
    progressPercent,
    items,
    missingKeys,
    notes: override?.notes ?? null,
  };
}

export function buildDeliveryPrediction(input: {
  startDate: string;
  remainingHours: number;
  readyHours: number;
  blockedHours: number;
  dailyCapacityHours: number;
  riskLevel: RiskLevel;
}): DeliveryPrediction {
  const effectiveDailyCapacity = Math.max(1, input.dailyCapacityHours);
  const baseDays = input.remainingHours / effectiveDailyCapacity;
  const blockedPenalty = input.blockedHours > 0 ? Math.max(1, input.blockedHours / effectiveDailyCapacity) : 0;
  const readyBoost = input.readyHours > 0 ? Math.min(1.5, input.readyHours / Math.max(1, input.remainingHours)) : 0;

  const riskFactor =
    input.riskLevel === "CRITICAL" ? 1.45
      : input.riskLevel === "HIGH" ? 1.3
      : input.riskLevel === "MEDIUM" ? 1.16
      : 1.06;

  const p50Days = Math.max(1, Math.ceil(baseDays + blockedPenalty - readyBoost));
  const p80Days = Math.max(p50Days, Math.ceil((baseDays * riskFactor) + blockedPenalty));
  const p95Days = Math.max(p80Days, Math.ceil((baseDays * (riskFactor + 0.16)) + (blockedPenalty * 1.3)));

  return {
    p50: addDays(input.startDate, p50Days),
    p80: addDays(input.startDate, p80Days),
    p95: addDays(input.startDate, p95Days),
    riskLevel: input.riskLevel,
  };
}

export function applyWarrantyImpact(
  divisions: DivisionCapacityShape[],
  readyBlockedByDivision: Record<number, ReadyBlockedHours>,
  reserves: WarrantyReserveInput[],
  periodStart: string,
  periodEnd: string,
): {
  snapshots: PlanningCapacitySnapshot[];
  impacts: WarrantyImpact[];
} {
  return {
    snapshots: divisions.map((division) => {
      const reserve = reserves.find((item) => item.divisionId === division.divisionId)?.hours ?? 0;
      const readyBlocked = readyBlockedByDivision[division.divisionId] ?? {
        readyHours: 0,
        blockedHours: 0,
        waitingMaterialHours: 0,
        waitingVendorHours: 0,
        waitingOtherDivisionHours: 0,
      };
      const availableHours = Math.max(0, Number((division.availableCapacityHours - reserve).toFixed(2)));
      let status: EngineStatus = "AMAN";
      if (readyBlocked.waitingMaterialHours > 0) status = "TUNGGU_MATERIAL";
      else if (readyBlocked.waitingVendorHours > 0) status = "TUNGGU_VENDOR";
      else if (readyBlocked.waitingOtherDivisionHours > 0) status = "TUNGGU_DIVISI_LAIN";
      else if (availableHours <= 0) status = "DIVISI_OVERLOAD";
      else if (reserve > 0) status = "BUTUH_LEMBUR";

      return {
        divisionId: String(division.divisionId),
        divisionName: division.divisionName,
        periodStart,
        periodEnd,
        totalMembers: division.totalMembers,
        activeMembers: division.activeMembers,
        absentMembers: division.absentMembers,
        normalCapacityHours: division.normalCapacityHours,
        absenceHours: division.absenceHours,
        scheduledHours: division.scheduledHours,
        readyHours: readyBlocked.readyHours,
        blockedHours: readyBlocked.blockedHours,
        warrantyReservedHours: reserve,
        availableHours,
        status,
      };
    }),
    impacts: reserves
      .filter((item) => item.hours > 0)
      .map((item) => {
        const division = divisions.find((entry) => entry.divisionId === item.divisionId);
        const before = division?.availableCapacityHours ?? 0;
        const after = Math.max(0, before - item.hours);
        return {
          divisionId: String(item.divisionId),
          capacityBefore: before,
          capacityAfter: after,
          deltaHours: Number((after - before).toFixed(2)),
        };
      }),
  };
}

export function buildSpkSplDecision(input: {
  targetHours: number;
  availableHours: number;
  blockedHours: number;
  canCalculate: boolean;
}): SpkSplDecision {
  const uncoveredHours = Math.max(0, Number((input.targetHours - input.availableHours).toFixed(2)));
  if (!input.canCalculate) {
    return {
      status: "MINTA_REVIEW_KD",
      spkReady: false,
      splHours: 0,
      uncoveredHours,
      reason: "Assessment belum lengkap. Lengkapi pendataan dulu.",
    };
  }
  if (input.blockedHours > input.targetHours * 0.35) {
    return {
      status: "TUNGGU_MATERIAL",
      spkReady: false,
      splHours: 0,
      uncoveredHours,
      reason: "Jam siap kerja masih kalah oleh jam yang terhambat.",
    };
  }
  if (uncoveredHours <= 0) {
    return {
      status: "AMAN",
      spkReady: true,
      splHours: 0,
      uncoveredHours: 0,
      reason: "Target masih muat di jam normal.",
    };
  }
  return {
    status: "BUTUH_LEMBUR",
    spkReady: true,
    splHours: uncoveredHours,
    uncoveredHours,
    reason: "Target bisa jalan, tetapi butuh tambahan jam lembur.",
  };
}

export function buildRecalculationLog(
  unitId: string,
  triggerType: string,
  previous: DeliveryPrediction | null,
  next: DeliveryPrediction,
  reason: string,
): RecalculationLog {
  const previousP80 = previous ? toIsoDate(previous.p80) : toIsoDate(next.p80);
  const previousP95 = previous ? toIsoDate(previous.p95) : toIsoDate(next.p95);
  const nextP80 = toIsoDate(next.p80);
  const nextP95 = toIsoDate(next.p95);

  const deltaP80Days = Math.round((new Date(`${nextP80}T00:00:00.000Z`).getTime() - new Date(`${previousP80}T00:00:00.000Z`).getTime()) / 86_400_000);
  const deltaP95Days = Math.round((new Date(`${nextP95}T00:00:00.000Z`).getTime() - new Date(`${previousP95}T00:00:00.000Z`).getTime()) / 86_400_000);

  return {
    unitId,
    triggerType,
    deltaP80Days,
    deltaP95Days,
    reason,
    createdAt: new Date().toISOString(),
  };
}
