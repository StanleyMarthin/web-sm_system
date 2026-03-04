// ============================================================
// SM System — Shared Type Definitions (from API Contract)
// ============================================================

// ---- Auth ----
export type UserRole = "pm" | "advisor" | "kd" | "mechanic" | "direksi" | "mis";

export interface AuthUser {
  userId: string;
  employeeId: string;
  fullName: string;
  role: UserRole;
  divisionName: string;
  divisionId: number;
}

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  token: string;
  refreshToken: string;
}

// ---- API Response Wrappers ----
export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---- Master Data ----
export interface Division {
  id: number;
  name: string;
  code: string;
}

export interface Employee {
  id: string;
  fullName: string;
  role: UserRole;
  divisionName: string;
  divisionId: number;
}

export interface Car {
  id: string;
  unitName: string;
  customerName: string;
  isMargin: boolean;
  restorationType: string;
  status: string;
}

export interface Panel {
  division: string;
  name: string;
  category: string;
}

// ---- Task Execution ----
export type TaskStatus = "PROSES" | "QC_READY" | "DONE";
export type TaskCategory = "MAIN" | "ADDITIONAL" | "WO" | "WOV";
export type ShiftType = "NORMAL" | "LEMBUR";

export interface Task {
  plandailyId: string;
  coreId: string;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  jobName: string;
  divisionName: string;
  status: TaskStatus;
  isPanelLocked: boolean;
  dailyTargetHours: number;
  targetHoursRevised: number;
  totalActualHours: number;
  remainingHours: number;
  taskDate: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  taskCategory: TaskCategory;
  customDescription: string;
  lockedByName: string | null;
}

// ---- Work Order ----
export type WoType = "WO" | "WOV";
export type WoPriority = "NORMAL" | "HIGH";
export type WoStatus =
  | "DRAFT"
  | "PENDING_ADVISOR"
  | "PENDING_PM"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "DONE";

export interface WorkOrder {
  id: string;
  woNumber: string;
  woType: WoType;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  coreId: string;
  description: string;
  fromDivision: string;
  toDivision: string;
  estimatedHours: number;
  priority: WoPriority;
  status: WoStatus;
  notes: string;
  requestedById: string;
  requestedByName: string;
  createdAt: string;
  deadline: string | null;
  advisorApprovedAt: string | null;
  advisorApprovedBy: string | null;
  pmApprovedAt: string | null;
  pmApprovedBy: string | null;
  rejectedReason: string | null;
  rejectedBy: string | null;
  previousDeadline: string | null;
  extensionReason: string | null;
}

// ---- Planning ----
export interface PlanJob {
  id: string;
  coreId: string;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  jobName: string;
  detailPOK: string;
  divisionName: string;
  mechanicId: string;
  mechanicName: string;
  planDate: string;
  shiftType: ShiftType;
  dailyTargetHours: number;
  remainingHours: number;
  isPanelFree: boolean;
  priority: WoPriority;
  fromCountdown: boolean;
}

export interface AvailableCoreJob {
  coreId: string;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  jobName: string;
  divisionName: string;
  remainingHours: number;
  status: TaskStatus;
  taskCategory: TaskCategory;
}

export interface MechanicOption {
  employeeId: string;
  fullName: string;
}

// ---- Monitoring ----
export type MonitoringJobStatus = "TO_DO" | "IN_PROGRESS" | "DONE";
export type CheckpointStatus = "PENDING" | "VALIDATED";

export interface MonitoringCheckpoint {
  time: string;
  label: string;
  status: CheckpointStatus;
  validatedAt: string | null;
  note: string | null;
  progressPercent: number | null;
}

export interface MonitoringJob {
  id: string;
  coreId: string;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  jobName: string;
  detailPOK: string;
  divisionName: string;
  mechanicId: string;
  mechanicName: string;
  status: MonitoringJobStatus;
  shiftType: ShiftType;
  dailyTargetHours: number;
  totalActualHours: number;
  targetHoursRevised: number;
  remainingHours: number;
  taskDate: string;
  startedAt: string | null;
  isUrgent: boolean;
  taskCategory: TaskCategory;
  checkpoints: MonitoringCheckpoint[];
}

// ---- KPI ----
export interface KpiSummary {
  division: string;
  totalJobs: number;
  completedJobs: number;
  standardHours: number;
  actualHours: number;
  reworkCount: number;
  efficiency: number;
  qcPassRate: number;
  onTimeRate: number;
}

export interface MechanicKpi {
  employeeId: string;
  fullName: string;
  jobsCompleted: number;
  standardHours: number;
  actualHours: number;
  efficiency: number;
  qcPassRate: number;
}

// ---- QC ----
export type QcItemStatus = "PASS" | "FAIL" | "PENDING";

export interface QcCheckItem {
  id: string;
  label: string;
  status: QcItemStatus;
}

export interface QcJob {
  id: string;
  coreId: string;
  carId: string;
  unitName: string;
  ownerName: string;
  panelName: string;
  jobName: string;
  mechanicName: string;
  completedAt: string;
  qcStatus: "PENDING" | "APPROVED" | "REWORK";
  checkItems: QcCheckItem[];
}

// ---- Projects (Calendar / Gantt) ----
export type ProjectStatus = "ACTIVE" | "COMPLETED" | "ON_HOLD";

export interface Project {
  carId: string;
  unitName: string;
  customerName: string;
  restorationType: string;
  contractDeliveryDate: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: ProjectStatus;
}

// ---- Core Jobs (WBS / Jobdesc) ----
export type CoreJobStatus = "PLAN" | "IN_PROGRESS" | "DONE";

export interface CoreJob {
  coreId: string;
  carId: string;
  unitName: string;
  panel: string;
  job: string;
  divisionId: number;
  divisionName: string;
  targetHours: number;
  status: CoreJobStatus;
  deadline: string;
  prerequisiteCoreId: string | null;
}

// ---- Vendor WO ----
export type VendorWOStatus = "PROSES_VENDOR" | "RETURNED" | "LATE";

export interface VendorWO {
  wovId: string;
  carId: string;
  unitName: string;
  coreId: string;
  vendorName: string;
  itemName: string;
  targetReturn: string;
  daysLate: number;
  status: VendorWOStatus;
}

// ---- Approval Center ----
export type ApprovalType = "TIME_EXT" | "SCOPE_CHANGE" | "BUDGET_ADD";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Approval {
  reqId: string;
  type: ApprovalType;
  carId: string;
  unitName: string;
  reqHours: number;
  requestedBy: string;
  status: ApprovalStatus;
  notes: string;
  createdAt: string;
}

// ---- Reporting ----
export interface EfficiencyReport {
  carId: string;
  unitName: string;
  totalTarget: number;
  totalActual: number;
  efficiencyRate: number;
}

// ---- Calendar Workload ----
export interface WorkloadEntry {
  divisionName: string;
  date: string;
  bookedHours: number;
  capacityHours: number;
}

// ---- Master Data ----
export interface MasterPanel {
  panelId: number;
  panelName: string;
  category: string;
}
