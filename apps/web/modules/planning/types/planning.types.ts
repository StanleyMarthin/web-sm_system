import type { RiskLevel } from "@/modules/planning/helpers/planning-calculations";

export type EngineStatus =
  | "AMAN"
  | "BUTUH_LEMBUR"
  | "SPK_READY"
  | "SPK_WITH_SPL"
  | "DIVISI_OVERLOAD"
  | "TUNGGU_MATERIAL"
  | "TUNGGU_VENDOR"
  | "TUNGGU_DIVISI_LAIN"
  | "MINTA_REVIEW_KD"
  | "TARGET_PERLU_DIREVISI"
  | "MENUNGGU_APPROVAL";

export type BlockerType =
  | "HOLD_MATERIAL"
  | "HOLD_VENDOR"
  | "QC_REJECT"
  | "WAITING_DIVISION"
  | "WAITING_APPROVAL"
  | "NONE";

export type PanelStatus =
  | "ORDER_PR"
  | "AT_VENDOR"
  | "QC_REJECT"
  | "READY_GUDANG"
  | "INSTALLED"
  | "IN_DIVISION"
  | "DISASSEMBLED"
  | "CANNIBALIZED";

export type AssessmentStatus =
  | "ASSESSMENT_DRAFT"
  | "ASSESSMENT_IN_PROGRESS"
  | "NEED_REVIEW_KD"
  | "READY_TO_CALCULATE"
  | "CALCULATED"
  | "LOCKED";

export type AssessmentItemKey =
  | "identity"
  | "bom"
  | "panelWorkflow"
  | "materials"
  | "vendorWork"
  | "labourEstimate"
  | "riskReview"
  | "kdReview";

export interface AssessmentItem {
  key: AssessmentItemKey;
  label: string;
  isRequired: boolean;
  isComplete: boolean;
  blockerLabel: string | null;
  notes?: string | null;
  updatedAt?: string | null;
}

export interface AssessmentCase {
  unitId: string;
  carId: string;
  unitName: string;
  customerName: string | null;
  status: AssessmentStatus;
  gateLabel: string;
  canCalculate: boolean;
  canLockTarget: boolean;
  progressPercent: number;
  items: AssessmentItem[];
  missingKeys: AssessmentItemKey[];
  reviewedByKdEmployeeId?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
}

export interface PlanningCapacitySnapshot {
  divisionId: string;
  divisionName: string;
  periodStart: string;
  periodEnd: string;
  totalMembers: number;
  activeMembers: number;
  absentMembers: number;
  normalCapacityHours: number;
  absenceHours: number;
  scheduledHours: number;
  readyHours: number;
  blockedHours: number;
  warrantyReservedHours: number;
  availableHours: number;
  status: EngineStatus;
}

export interface DeliveryPrediction {
  p50: Date;
  p80: Date;
  p95: Date;
  riskLevel: RiskLevel;
}

export interface SpkSplDecision {
  status: EngineStatus;
  spkReady: boolean;
  splHours: number;
  uncoveredHours: number;
  reason?: string | null;
}

export interface WarrantyImpact {
  divisionId: string;
  capacityBefore: number;
  capacityAfter: number;
  deltaHours: number;
}

export interface RecalculationLog {
  unitId: string;
  triggerType: string;
  deltaP80Days: number;
  deltaP95Days: number;
  reason: string;
  createdAt?: string;
}

export interface CriticalPathNode {
  jobId: string;
  divisionId: string;
  earliestStart: Date;
  duration: number;
  finishDate: Date;
  blockedBy: BlockerType[];
  dependsOn: string[];
  isCritical: boolean;
}

export interface CriticalPathResult {
  nodes: CriticalPathNode[];
  unitDeliveryDate: Date;
  totalVariance: number;
  stdDev: number;
  p50Date: Date;
  p80Date: Date;
  p95Date: Date;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  divisionId: string;
  estimatedHours: number;
  applicableConditions: string[];
}

export interface ServiceIntake {
  unitId: string;
  diagnosis: string;
  templateIds: string[];
  totalEstimatedHours: number;
  capacityStatus: EngineStatus;
  targetFinishDate: Date;
}

export interface LabourSummary {
  unitId: string;
  targetHours: number;
  actualHours: number;
  billableHours: number;
  nonBillableHours: number;
  warrantyHours: number;
  lostHours: number;
}

export interface BomPlanningSnapshot {
  panelId: string;
  partId: string;
  status: PanelStatus;
  blockerType: BlockerType | null;
  blockedHours: number;
  readyHours: number;
  earliestAvailableDate: Date | null;
}

export interface MonteCarloConfig {
  iterations: number;
  seed?: number;
}

export interface MonteCarloResult {
  p50Date: Date;
  p80Date: Date;
  p95Date: Date;
  meanDays: number;
  stdDev: number;
  histogram: { bucket: number; frequency: number }[];
  ranAt: Date;
}

export interface UtilizationCalibration {
  divisionId: string;
  observedPeriods: number;
  avgActualUtilization: number;
  suggestedSafeUtilization: number;
  currentSafeUtilization: number;
  delta: number;
  recommendation: "increase" | "decrease" | "keep";
  lastCalibratedAt: Date;
}

export interface HistoricalFactor {
  divisionId: string;
  jobTypeId: string;
  sampleSize: number;
  avgEstimatedHours: number;
  avgActualHours: number;
  calibratedFactor: number;
  defaultFactor: number;
  confidence: "low" | "medium" | "high";
  lastCalibratedAt: Date;
}

export interface WarrantyRatePrediction {
  divisionId: string;
  historicalReturnRate: number;
  avgReworkHours: number;
  predictedLoadNextPeriod: number;
  confidence: "low" | "medium" | "high";
}

export interface PriorityInput {
  unitId: string;
  deadlineDaysRemaining: number;
  deliveryRiskScore: number;
  blockerCount: number;
  lockedPanelCount: number;
  remainingHours: number;
  incomeMarker: number;
  historicalDelayRate?: number;
  customerSlaLevel?: number;
}

export interface PriorityResult {
  unitId: string;
  score: number;
  rank: 1 | 2 | 3;
  dominantFactor: string;
  scoreBreakdown: Record<string, number>;
}
