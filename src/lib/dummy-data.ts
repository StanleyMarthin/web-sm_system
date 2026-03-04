// ============================================================
// Dummy Data — mirrors Flutter app's DummyEmployees / local data
// Used for MVP; will swap to real API calls via env.apiUrl
// ============================================================

import type {
  AuthUser,
  Division,
  Employee,
  Car,
  Task,
  WorkOrder,
  PlanJob,
  MonitoringJob,
  KpiSummary,
  MechanicKpi,
  QcJob,
  MonitoringCheckpoint,
  MechanicOption,
  AvailableCoreJob,
  Project,
  CoreJob,
  VendorWO,
  Approval,
  EfficiencyReport,
  WorkloadEntry,
  MasterPanel,
} from "@/types";

// ── Divisions ──
export const DIVISIONS: Division[] = [
  { id: 1, name: "Mechanic", code: "MEC" },
  { id: 2, name: "Body Work", code: "BDW" },
  { id: 3, name: "Body Paint", code: "BDP" },
  { id: 4, name: "Interior", code: "INT" },
  { id: 5, name: "Chrome", code: "CHR" },
  { id: 6, name: "Bubut", code: "BBT" },
];

// ── Demo Accounts ──
export const DEMO_USERS: (AuthUser & { password: string })[] = [
  {
    userId: "emp-001",
    employeeId: "emp-001",
    fullName: "Hardian",
    role: "pm",
    divisionName: "Management",
    divisionId: 0,
    password: "pm123",
  },
  {
    userId: "emp-002",
    employeeId: "emp-002",
    fullName: "Kandi Gunawan",
    role: "advisor",
    divisionName: "Advisory",
    divisionId: 0,
    password: "adv123",
  },
  {
    userId: "emp-004",
    employeeId: "emp-004",
    fullName: "Yudha Agustiana",
    role: "kd",
    divisionName: "Mechanic",
    divisionId: 1,
    password: "kd123",
  },
  {
    userId: "emp-013",
    employeeId: "emp-013",
    fullName: "Adam Hafiyan",
    role: "mechanic",
    divisionName: "Mechanic",
    divisionId: 1,
    password: "mec123",
  },
  {
    userId: "emp-014",
    employeeId: "emp-014",
    fullName: "Aries Risfan",
    role: "mechanic",
    divisionName: "Mechanic",
    divisionId: 1,
    password: "mec123",
  },
  {
    userId: "emp-015",
    employeeId: "emp-015",
    fullName: "Dian Maulana Makbul",
    role: "mechanic",
    divisionName: "Mechanic",
    divisionId: 1,
    password: "mec123",
  },
  {
    userId: "emp-020",
    employeeId: "emp-020",
    fullName: "Direktur Utama",
    role: "direksi",
    divisionName: "Direksi",
    divisionId: 0,
    password: "dir123",
  },
  {
    userId: "emp-030",
    employeeId: "emp-030",
    fullName: "Admin MIS",
    role: "mis",
    divisionName: "MIS",
    divisionId: 0,
    password: "mis123",
  },
];

// ── Employees ──
export const EMPLOYEES: Employee[] = DEMO_USERS.map((u) => ({
  id: u.employeeId,
  fullName: u.fullName,
  role: u.role,
  divisionName: u.divisionName,
  divisionId: u.divisionId,
}));

// ── Cars ──
export const CARS: Car[] = [
  { id: "car-001", unitName: "CHEVROLET", customerName: "Mr. NYOMAN", isMargin: true, restorationType: "FULL_RESTORASI", status: "In_Progress" },
  { id: "car-002", unitName: "FORD MUSTANG 1967", customerName: "Mr. AGUS", isMargin: false, restorationType: "PARTIAL", status: "In_Progress" },
  { id: "car-003", unitName: "JAGUAR XK120", customerName: "Mr. JAMES", isMargin: true, restorationType: "FULL_RESTORASI", status: "In_Progress" },
  { id: "car-004", unitName: "MERCEDES 300SL", customerName: "Mr. BUDI", isMargin: true, restorationType: "FULL_RESTORASI", status: "In_Progress" },
  { id: "car-005", unitName: "VW BEETLE 1965", customerName: "Mr. HENDRA", isMargin: false, restorationType: "PARTIAL", status: "In_Progress" },
];

// ── Mechanic Options ──
export const MECHANIC_OPTIONS: MechanicOption[] = [
  { employeeId: "emp-013", fullName: "Adam Hafiyan" },
  { employeeId: "emp-014", fullName: "Aries Risfan" },
  { employeeId: "emp-015", fullName: "Dian Maulana Makbul" },
];

// ── Available Core Jobs ──
export const AVAILABLE_CORE_JOBS: AvailableCoreJob[] = [
  {
    coreId: "core-001", carId: "car-003", unitName: "JAGUAR XK120", ownerName: "Mr. JAMES",
    panelName: "Blok Silinder", jobName: "Turunkan Mesin & Gearbox", divisionName: "Mechanic",
    remainingHours: 10.5, status: "PROSES", taskCategory: "MAIN",
  },
  {
    coreId: "core-002", carId: "car-001", unitName: "CHEVROLET", ownerName: "Mr. NYOMAN",
    panelName: "Transmisi", jobName: "Overhaul Transmisi Manual", divisionName: "Mechanic",
    remainingHours: 16, status: "PROSES", taskCategory: "MAIN",
  },
  {
    coreId: "core-003", carId: "car-004", unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI",
    panelName: "Rem", jobName: "Overhaul Master Rem", divisionName: "Mechanic",
    remainingHours: 6, status: "PROSES", taskCategory: "MAIN",
  },
];

// ── Tasks (Mechanic Today) ──
export const TASKS: Task[] = [
  {
    plandailyId: "550e8400-e29b-41d4-a716-446655440001",
    coreId: "core-001", carId: "car-003", unitName: "JAGUAR XK120", ownerName: "Mr. JAMES",
    panelName: "Blok Silinder", jobName: "Turunkan Mesin & Gearbox", divisionName: "Mechanic",
    status: "PROSES", isPanelLocked: false, dailyTargetHours: 8, targetHoursRevised: 16,
    totalActualHours: 5.5, remainingHours: 10.5, taskDate: "2026-02-27",
    createdAt: "2026-02-27T06:30:00Z", startedAt: null, completedAt: null,
    taskCategory: "MAIN", customDescription: "SETTING SHIFT FORK TRANSMISI DAN PENDATAAN PART ORDERAN",
    lockedByName: null,
  },
  {
    plandailyId: "550e8400-e29b-41d4-a716-446655440002",
    coreId: "core-002", carId: "car-001", unitName: "CHEVROLET", ownerName: "Mr. NYOMAN",
    panelName: "Transmisi", jobName: "Overhaul Transmisi Manual", divisionName: "Mechanic",
    status: "PROSES", isPanelLocked: true, dailyTargetHours: 8, targetHoursRevised: 24,
    totalActualHours: 12, remainingHours: 12, taskDate: "2026-02-27",
    createdAt: "2026-02-27T06:30:00Z", startedAt: "2026-02-27T08:00:00Z", completedAt: null,
    taskCategory: "MAIN", customDescription: "Bongkar gearbox dan cek synchromesh",
    lockedByName: "Dian Maulana Makbul",
  },
  {
    plandailyId: "550e8400-e29b-41d4-a716-446655440003",
    coreId: "core-003", carId: "car-004", unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI",
    panelName: "Rem", jobName: "Overhaul Master Rem", divisionName: "Mechanic",
    status: "DONE", isPanelLocked: false, dailyTargetHours: 4, targetHoursRevised: 8,
    totalActualHours: 8, remainingHours: 0, taskDate: "2026-02-27",
    createdAt: "2026-02-27T06:30:00Z", startedAt: "2026-02-27T08:15:00Z",
    completedAt: "2026-02-27T15:00:00Z",
    taskCategory: "MAIN", customDescription: "Overhaul master rem dan ganti seal",
    lockedByName: null,
  },
];

// ── Work Orders ──
export const WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-001", woNumber: "WO-MEC-2026-0042", woType: "WO",
    carId: "car-003", unitName: "JAGUAR XK120", ownerName: "Mr. JAMES",
    panelName: "Blok Silinder", coreId: "core-001",
    description: "Bubut crankshaft dan as roda belakang (toleransi presisi 0.02mm)",
    fromDivision: "Mechanic", toDivision: "Bubut", estimatedHours: 24,
    priority: "HIGH", status: "PENDING_ADVISOR",
    notes: "Butuh presisi tinggi, koordinasi dengan KD Bubut",
    requestedById: "emp-004", requestedByName: "Yudha Agustiana",
    createdAt: "2026-02-25T08:00:00Z", deadline: "2026-03-10",
    advisorApprovedAt: null, advisorApprovedBy: null,
    pmApprovedAt: null, pmApprovedBy: null,
    rejectedReason: null, rejectedBy: null,
    previousDeadline: null, extensionReason: null,
  },
  {
    id: "wo-002", woNumber: "WO-MEC-2026-0043", woType: "WOV",
    carId: "car-001", unitName: "CHEVROLET", ownerName: "Mr. NYOMAN",
    panelName: "Transmisi", coreId: "core-002",
    description: "Chrome ulang bumper depan dan belakang",
    fromDivision: "Mechanic", toDivision: "CV. Chrome Jaya", estimatedHours: 48,
    priority: "NORMAL", status: "APPROVED",
    notes: "Vendor terpercaya, sudah deal harga",
    requestedById: "emp-004", requestedByName: "Yudha Agustiana",
    createdAt: "2026-02-20T08:00:00Z", deadline: "2026-03-15",
    advisorApprovedAt: "2026-02-21T10:00:00Z", advisorApprovedBy: "Kandi Gunawan",
    pmApprovedAt: "2026-02-22T14:00:00Z", pmApprovedBy: "Hardian",
    rejectedReason: null, rejectedBy: null,
    previousDeadline: null, extensionReason: null,
  },
  {
    id: "wo-003", woNumber: "WO-MEC-2026-0044", woType: "WO",
    carId: "car-004", unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI",
    panelName: "Rem", coreId: "core-003",
    description: "Fabrikasi bracket kaliper rem custom",
    fromDivision: "Mechanic", toDivision: "Bubut", estimatedHours: 12,
    priority: "NORMAL", status: "DRAFT",
    notes: "Perlu koordinasi ukuran dengan divisi Bubut",
    requestedById: "emp-004", requestedByName: "Yudha Agustiana",
    createdAt: "2026-02-26T08:00:00Z", deadline: "2026-03-05",
    advisorApprovedAt: null, advisorApprovedBy: null,
    pmApprovedAt: null, pmApprovedBy: null,
    rejectedReason: null, rejectedBy: null,
    previousDeadline: null, extensionReason: null,
  },
];

// ── Plan Jobs ──
const checkpointsDone: MonitoringCheckpoint[] = [
  { time: "10:00", label: "Checkpoint 1", status: "VALIDATED", validatedAt: "2026-02-27T10:05:00Z", note: "Mesin sudah turun dari dudukan", progressPercent: 30 },
  { time: "15:00", label: "Checkpoint 2", status: "PENDING", validatedAt: null, note: null, progressPercent: null },
  { time: "17:00", label: "Checkpoint 3", status: "PENDING", validatedAt: null, note: null, progressPercent: null },
];

export const PLAN_JOBS: PlanJob[] = [
  {
    id: "plan-001", coreId: "core-001", carId: "car-003",
    unitName: "JAGUAR XK120", ownerName: "Mr. JAMES", panelName: "Blok Silinder",
    jobName: "Turunkan Mesin & Gearbox",
    detailPOK: "Pembongkaran mesin lengkap termasuk gearbox manual 4 speed",
    divisionName: "Mechanic", mechanicId: "emp-013", mechanicName: "Adam Hafiyan",
    planDate: "2026-02-27", shiftType: "NORMAL", dailyTargetHours: 8,
    remainingHours: 10.5, isPanelFree: true, priority: "HIGH", fromCountdown: false,
  },
  {
    id: "plan-002", coreId: "core-002", carId: "car-001",
    unitName: "CHEVROLET", ownerName: "Mr. NYOMAN", panelName: "Transmisi",
    jobName: "Overhaul Transmisi Manual",
    detailPOK: "Bongkar gearbox dan cek synchromesh ring, ganti seal input/output shaft",
    divisionName: "Mechanic", mechanicId: "emp-015", mechanicName: "Dian Maulana Makbul",
    planDate: "2026-02-27", shiftType: "NORMAL", dailyTargetHours: 8,
    remainingHours: 12, isPanelFree: false, priority: "NORMAL", fromCountdown: true,
  },
  {
    id: "plan-003", coreId: "core-003", carId: "car-004",
    unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI", panelName: "Rem",
    jobName: "Overhaul Master Rem",
    detailPOK: "Overhaul master rem dan ganti seal kit, bleeding system",
    divisionName: "Mechanic", mechanicId: "emp-014", mechanicName: "Aries Risfan",
    planDate: "2026-02-27", shiftType: "LEMBUR", dailyTargetHours: 4,
    remainingHours: 6, isPanelFree: true, priority: "HIGH", fromCountdown: false,
  },
];

// ── Monitoring Jobs ──
export const MONITORING_JOBS: MonitoringJob[] = [
  {
    id: "mon-001", coreId: "core-001", carId: "car-003",
    unitName: "JAGUAR XK120", ownerName: "Mr. JAMES", panelName: "Blok Silinder",
    jobName: "Turunkan Mesin & Gearbox",
    detailPOK: "Pembongkaran mesin lengkap termasuk gearbox manual 4 speed",
    divisionName: "Mechanic", mechanicId: "emp-013", mechanicName: "Adam Hafiyan",
    status: "IN_PROGRESS", shiftType: "NORMAL", dailyTargetHours: 8,
    totalActualHours: 5.5, targetHoursRevised: 16, remainingHours: 10.5,
    taskDate: "2026-02-27", startedAt: "2026-02-27T08:15:00Z",
    isUrgent: false, taskCategory: "MAIN", checkpoints: checkpointsDone,
  },
  {
    id: "mon-002", coreId: "core-002", carId: "car-001",
    unitName: "CHEVROLET", ownerName: "Mr. NYOMAN", panelName: "Transmisi",
    jobName: "Overhaul Transmisi Manual",
    detailPOK: "Bongkar gearbox dan cek synchromesh",
    divisionName: "Mechanic", mechanicId: "emp-015", mechanicName: "Dian Maulana Makbul",
    status: "IN_PROGRESS", shiftType: "NORMAL", dailyTargetHours: 8,
    totalActualHours: 12, targetHoursRevised: 24, remainingHours: 12,
    taskDate: "2026-02-27", startedAt: "2026-02-27T08:00:00Z",
    isUrgent: false, taskCategory: "MAIN",
    checkpoints: [
      { time: "10:00", label: "Checkpoint 1", status: "VALIDATED", validatedAt: "2026-02-27T10:10:00Z", note: "Gearbox sudah terpisah", progressPercent: 40 },
      { time: "15:00", label: "Checkpoint 2", status: "VALIDATED", validatedAt: "2026-02-27T15:05:00Z", note: "Synchromesh ring aus, perlu ganti", progressPercent: 70 },
      { time: "17:00", label: "Checkpoint 3", status: "PENDING", validatedAt: null, note: null, progressPercent: null },
    ],
  },
  {
    id: "mon-003", coreId: "core-003", carId: "car-004",
    unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI", panelName: "Rem",
    jobName: "Overhaul Master Rem",
    detailPOK: "Overhaul master rem dan ganti seal kit",
    divisionName: "Mechanic", mechanicId: "emp-014", mechanicName: "Aries Risfan",
    status: "DONE", shiftType: "NORMAL", dailyTargetHours: 4,
    totalActualHours: 4, targetHoursRevised: 8, remainingHours: 4,
    taskDate: "2026-02-27", startedAt: "2026-02-27T08:15:00Z",
    isUrgent: false, taskCategory: "MAIN",
    checkpoints: [
      { time: "10:00", label: "Checkpoint 1", status: "VALIDATED", validatedAt: "2026-02-27T10:00:00Z", note: "Master rem sudah dibongkar", progressPercent: 50 },
      { time: "15:00", label: "Checkpoint 2", status: "VALIDATED", validatedAt: "2026-02-27T14:50:00Z", note: "Seal kit sudah diganti, bleeding selesai", progressPercent: 100 },
    ],
  },
  {
    id: "mon-004", coreId: "core-urgent-001", carId: "car-005",
    unitName: "VW BEETLE 1965", ownerName: "Mr. HENDRA", panelName: "Kompresor AC",
    jobName: "Perbaikan AC Emergency",
    detailPOK: "AC mati total, perlu cek kompresor dan isi freon",
    divisionName: "Mechanic", mechanicId: "emp-014", mechanicName: "Aries Risfan",
    status: "TO_DO", shiftType: "NORMAL", dailyTargetHours: 4,
    totalActualHours: 0, targetHoursRevised: 4, remainingHours: 4,
    taskDate: "2026-02-27", startedAt: null,
    isUrgent: true, taskCategory: "ADDITIONAL",
    checkpoints: [],
  },
];

// ── KPI Data ──
export const KPI_SUMMARY: KpiSummary = {
  division: "Mechanic",
  totalJobs: 24,
  completedJobs: 18,
  standardHours: 192,
  actualHours: 178,
  reworkCount: 2,
  efficiency: 92.7,
  qcPassRate: 88.9,
  onTimeRate: 83.3,
};

export const MECHANIC_KPIS: MechanicKpi[] = [
  { employeeId: "emp-013", fullName: "Adam Hafiyan", jobsCompleted: 7, standardHours: 56, actualHours: 52, efficiency: 93, qcPassRate: 100 },
  { employeeId: "emp-014", fullName: "Aries Risfan", jobsCompleted: 6, standardHours: 48, actualHours: 50, efficiency: 96, qcPassRate: 83 },
  { employeeId: "emp-015", fullName: "Dian Maulana Makbul", jobsCompleted: 5, standardHours: 40, actualHours: 38, efficiency: 95, qcPassRate: 80 },
];

// ── QC Data ──
export const QC_JOBS: QcJob[] = [
  {
    id: "qc-001", coreId: "core-003", carId: "car-004",
    unitName: "MERCEDES 300SL", ownerName: "Mr. BUDI",
    panelName: "Rem", jobName: "Overhaul Master Rem",
    mechanicName: "Aries Risfan", completedAt: "2026-02-27T15:00:00Z",
    qcStatus: "PENDING",
    checkItems: [
      { id: "qci-1", label: "Tidak ada kebocoran minyak rem", status: "PENDING" },
      { id: "qci-2", label: "Pedal rem tidak spongy", status: "PENDING" },
      { id: "qci-3", label: "Semua fitting sudah kencang", status: "PENDING" },
    ],
  },
  {
    id: "qc-002", coreId: "core-004", carId: "car-002",
    unitName: "FORD MUSTANG 1967", ownerName: "Mr. AGUS",
    panelName: "Suspensi Depan", jobName: "Ganti Ball Joint",
    mechanicName: "Adam Hafiyan", completedAt: "2026-02-26T16:00:00Z",
    qcStatus: "APPROVED",
    checkItems: [
      { id: "qci-4", label: "Ball joint terpasang dengan benar", status: "PASS" },
      { id: "qci-5", label: "Tidak ada play berlebihan", status: "PASS" },
      { id: "qci-6", label: "Grease sudah diaplikasikan", status: "PASS" },
    ],
  },
];

// ── Projects ──
export const PROJECTS: Project[] = [
  { carId: "car-001", unitName: "CHEVROLET", customerName: "Mr. NYOMAN", restorationType: "FULL_RESTORASI", contractDeliveryDate: "2026-06-01", startDate: "2026-01-15", endDate: "2026-06-01", progress: 45, status: "ACTIVE" },
  { carId: "car-002", unitName: "FORD MUSTANG 1967", customerName: "Mr. AGUS", restorationType: "PARTIAL", contractDeliveryDate: "2026-05-01", startDate: "2026-02-01", endDate: "2026-05-01", progress: 30, status: "ACTIVE" },
  { carId: "car-003", unitName: "JAGUAR XK120", customerName: "Mr. JAMES", restorationType: "FULL_RESTORASI", contractDeliveryDate: "2026-08-01", startDate: "2026-02-10", endDate: "2026-08-01", progress: 20, status: "ACTIVE" },
  { carId: "car-004", unitName: "MERCEDES 300SL", customerName: "Mr. BUDI", restorationType: "FULL_RESTORASI", contractDeliveryDate: "2026-07-15", startDate: "2026-01-20", endDate: "2026-07-15", progress: 55, status: "ACTIVE" },
  { carId: "car-005", unitName: "VW BEETLE 1965", customerName: "Mr. HENDRA", restorationType: "PARTIAL", contractDeliveryDate: "2026-04-01", startDate: "2026-01-10", endDate: "2026-04-01", progress: 85, status: "ACTIVE" },
];

// ── Core Jobs (WBS / Jobdesc) ──
export const CORE_JOBS: CoreJob[] = [
  { coreId: "core-001", carId: "car-003", unitName: "JAGUAR XK120", panel: "Blok Silinder", job: "Turunkan Mesin & Gearbox", divisionId: 1, divisionName: "Mechanic", targetHours: 16, status: "IN_PROGRESS", deadline: "2026-03-10", prerequisiteCoreId: null },
  { coreId: "core-002", carId: "car-001", unitName: "CHEVROLET", panel: "Transmisi", job: "Overhaul Transmisi Manual", divisionId: 1, divisionName: "Mechanic", targetHours: 24, status: "IN_PROGRESS", deadline: "2026-03-15", prerequisiteCoreId: null },
  { coreId: "core-003", carId: "car-004", unitName: "MERCEDES 300SL", panel: "Rem", job: "Overhaul Master Rem", divisionId: 1, divisionName: "Mechanic", targetHours: 8, status: "DONE", deadline: "2026-03-05", prerequisiteCoreId: null },
  { coreId: "core-004", carId: "car-002", unitName: "FORD MUSTANG 1967", panel: "Suspensi Depan", job: "Ganti Ball Joint", divisionId: 1, divisionName: "Mechanic", targetHours: 6, status: "DONE", deadline: "2026-03-01", prerequisiteCoreId: null },
  { coreId: "core-005", carId: "car-005", unitName: "VW BEETLE 1965", panel: "Kompresor AC", job: "Perbaikan AC Emergency", divisionId: 1, divisionName: "Mechanic", targetHours: 4, status: "PLAN", deadline: "2026-03-20", prerequisiteCoreId: null },
  { coreId: "core-006", carId: "car-001", unitName: "CHEVROLET", panel: "Kap Mesin", job: "Dempul & Primer", divisionId: 2, divisionName: "Body Work", targetHours: 12, status: "PLAN", deadline: "2026-03-25", prerequisiteCoreId: "core-001" },
  { coreId: "core-007", carId: "car-003", unitName: "JAGUAR XK120", panel: "Pintu", job: "Restorasi Panel Pintu", divisionId: 2, divisionName: "Body Work", targetHours: 18, status: "PLAN", deadline: "2026-04-01", prerequisiteCoreId: "core-001" },
];

// ── Vendor WO ──
export const VENDOR_WOS: VendorWO[] = [
  { wovId: "wov-001", carId: "car-001", unitName: "CHEVROLET", coreId: "core-002", vendorName: "CV. Chrome Jaya", itemName: "Bumper Depan & Belakang", targetReturn: "2026-03-15", daysLate: 0, status: "PROSES_VENDOR" },
  { wovId: "wov-002", carId: "car-003", unitName: "JAGUAR XK120", coreId: "core-001", vendorName: "Sinar Chrome", itemName: "Grille & Emblem", targetReturn: "2026-03-10", daysLate: 2, status: "LATE" },
  { wovId: "wov-003", carId: "car-004", unitName: "MERCEDES 300SL", coreId: "core-003", vendorName: "PT. Rubber Seal Indo", itemName: "Seal Kit Master Rem", targetReturn: "2026-02-28", daysLate: 0, status: "RETURNED" },
];

// ── Approvals ──
export const APPROVALS: Approval[] = [
  { reqId: "apr-001", type: "TIME_EXT", carId: "car-003", unitName: "JAGUAR XK120", reqHours: 10, requestedBy: "Yudha Agustiana", status: "PENDING", notes: "Butuh tambahan waktu untuk bongkar gearbox", createdAt: "2026-03-01T08:00:00Z" },
  { reqId: "apr-002", type: "SCOPE_CHANGE", carId: "car-001", unitName: "CHEVROLET", reqHours: 16, requestedBy: "Yudha Agustiana", status: "PENDING", notes: "Tambahan pekerjaan chrome ulang", createdAt: "2026-03-02T09:00:00Z" },
  { reqId: "apr-003", type: "TIME_EXT", carId: "car-004", unitName: "MERCEDES 300SL", reqHours: 8, requestedBy: "Aries Risfan", status: "APPROVED", notes: "Seal kit harus diganti semua", createdAt: "2026-02-25T10:00:00Z" },
  { reqId: "apr-004", type: "BUDGET_ADD", carId: "car-005", unitName: "VW BEETLE 1965", reqHours: 0, requestedBy: "Yudha Agustiana", status: "REJECTED", notes: "Budget tambahan material AC", createdAt: "2026-02-20T14:00:00Z" },
];

// ── Efficiency Reports ──
export const EFFICIENCY_REPORTS: EfficiencyReport[] = [
  { carId: "car-001", unitName: "CHEVROLET", totalTarget: 200, totalActual: 190, efficiencyRate: 105.3 },
  { carId: "car-002", unitName: "FORD MUSTANG 1967", totalTarget: 120, totalActual: 130, efficiencyRate: 92.3 },
  { carId: "car-003", unitName: "JAGUAR XK120", totalTarget: 300, totalActual: 280, efficiencyRate: 107.1 },
  { carId: "car-004", unitName: "MERCEDES 300SL", totalTarget: 250, totalActual: 240, efficiencyRate: 104.2 },
  { carId: "car-005", unitName: "VW BEETLE 1965", totalTarget: 80, totalActual: 85, efficiencyRate: 94.1 },
];

// ── Calendar Workload ──
export const WORKLOAD_ENTRIES: WorkloadEntry[] = [
  { divisionName: "Mechanic", date: "2026-03-03", bookedHours: 40, capacityHours: 48 },
  { divisionName: "Mechanic", date: "2026-03-04", bookedHours: 44, capacityHours: 48 },
  { divisionName: "Mechanic", date: "2026-03-05", bookedHours: 36, capacityHours: 48 },
  { divisionName: "Body Work", date: "2026-03-03", bookedHours: 24, capacityHours: 32 },
  { divisionName: "Body Work", date: "2026-03-04", bookedHours: 30, capacityHours: 32 },
  { divisionName: "Body Work", date: "2026-03-05", bookedHours: 28, capacityHours: 32 },
  { divisionName: "Body Paint", date: "2026-03-03", bookedHours: 16, capacityHours: 24 },
  { divisionName: "Body Paint", date: "2026-03-04", bookedHours: 20, capacityHours: 24 },
  { divisionName: "Interior", date: "2026-03-03", bookedHours: 8, capacityHours: 16 },
  { divisionName: "Interior", date: "2026-03-04", bookedHours: 12, capacityHours: 16 },
];

// ── Master Panels ──
export const MASTER_PANELS: MasterPanel[] = [
  { panelId: 1, panelName: "Kap Mesin", category: "Exterior" },
  { panelId: 2, panelName: "Pintu Depan Kiri", category: "Exterior" },
  { panelId: 3, panelName: "Pintu Depan Kanan", category: "Exterior" },
  { panelId: 4, panelName: "Fender Depan", category: "Exterior" },
  { panelId: 5, panelName: "Bumper Depan", category: "Exterior" },
  { panelId: 6, panelName: "Bumper Belakang", category: "Exterior" },
  { panelId: 7, panelName: "Dashboard", category: "Interior" },
  { panelId: 8, panelName: "Jok Depan", category: "Interior" },
  { panelId: 9, panelName: "Jok Belakang", category: "Interior" },
  { panelId: 10, panelName: "Blok Silinder", category: "Engine" },
  { panelId: 11, panelName: "Transmisi", category: "Engine" },
  { panelId: 12, panelName: "Rem", category: "Chassis" },
  { panelId: 13, panelName: "Suspensi Depan", category: "Chassis" },
  { panelId: 14, panelName: "Kompresor AC", category: "Electrical" },
];
