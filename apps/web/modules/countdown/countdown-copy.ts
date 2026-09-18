export function formatCountdownStatus(status: string): string {
  return status.replaceAll("_", " ");
}

const countdownStatusLabels: Record<string, string> = {
  PLAN: "Menunggu",
  PROSES: "On Progress",
  QC_READY: "Siap QC",
  DONE: "Selesai",
};

/**
 * Satu label status untuk seluruh modul countdown. Keterlambatan menjadi bagian
 * dari status (bukan badge terpisah) karena kepala bengkel butuh tahu cepat.
 */
export function formatCountdownStatusLabel(input: {
  status: string;
  isOverdue: boolean;
  progressPercent: number;
}): string {
  const progress = Number(input.progressPercent ?? 0);
  if (input.isOverdue && progress < 100) return "Terlambat";
  return countdownStatusLabels[input.status] ?? formatCountdownStatus(input.status);
}

export function hasCountdownTargetRevision(input: {
  targetHoursInitial: number;
  targetHoursRevised: number;
}): boolean {
  return Number(input.targetHoursRevised) !== Number(input.targetHoursInitial);
}

const importFieldLabels: Record<string, string> = {
  carId: "Unit",
  divisionId: "Divisi",
  sectionName: "Bagian",
  panelId: "Panel",
  jobTypeId: "Jenis pekerjaan",
  targetHoursInitial: "Target awal",
  deadlineDate: "Batas waktu",
  taskCategory: "Kategori",
  prerequisiteCoreId: "Pekerjaan prasyarat",
  refWoId: "Referensi WO",
};

export function formatCountdownImportIssue(field: string, message: string): [string, string] {
  const label = importFieldLabels[field] ?? field.replaceAll("_", " ");
  return [label, message.replaceAll(field, label)];
}
