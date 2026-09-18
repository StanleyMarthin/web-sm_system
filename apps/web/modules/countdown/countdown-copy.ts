export function formatCountdownStatus(status: string): string {
  return status.replaceAll("_", " ");
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
