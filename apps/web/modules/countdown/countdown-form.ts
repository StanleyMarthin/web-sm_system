import { formatCountdownStatus } from "./countdown-copy";

export interface CountdownFormReferenceOption {
  label: string;
  value: string;
  section?: string | null;
}

export interface CountdownFormReferences {
  units: CountdownFormReferenceOption[];
  panels: CountdownFormReferenceOption[];
  divisions: CountdownFormReferenceOption[];
  jobTypes: CountdownFormReferenceOption[];
  employees?: CountdownFormReferenceOption[];
}

export interface CountdownFormSummaryInput {
  carId: string;
  panelId: string;
  divisionId: string;
  picPlan: string;
  jobTypeId: string;
  taskCategory: string;
}

export const countdownTaskCategoryLabels: Record<string, string> = {
  MAIN: "Utama",
  ADDITIONAL: "Tambahan",
  WO: "Work Order",
  WOV: "Vendor",
};

function labelOf(options: CountdownFormReferenceOption[], value: string) {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? "";
}

/** Ringkasan konfirmasi memakai label master, bukan ID teknis. */
export function resolveCountdownFormSummary(
  input: CountdownFormSummaryInput,
  references: CountdownFormReferences,
) {
  return {
    unit: labelOf(references.units, input.carId),
    panel: labelOf(references.panels, input.panelId),
    division: labelOf(references.divisions, input.divisionId),
    employee: labelOf(references.employees ?? [], input.picPlan),
    jobType: labelOf(references.jobTypes, input.jobTypeId),
    taskCategory: input.taskCategory
      ? countdownTaskCategoryLabels[input.taskCategory] ?? formatCountdownStatus(input.taskCategory)
      : "",
  };
}

/** Bagian mengikuti panel yang dipilih, dipakai untuk mengisi field bagian otomatis. */
export function resolveSectionFromPanel(
  panels: CountdownFormReferenceOption[],
  panelId: string,
): string {
  if (!panelId) return "";
  const panel = panels.find((item) => item.value === panelId);
  return panel?.section ?? panel?.label ?? "";
}

export function collectMissingCountdownFields(
  errors: Record<string, unknown>,
  labels: Record<string, string>,
): string[] {
  return Object.entries(labels)
    .filter(([field]) => Object.prototype.hasOwnProperty.call(errors, field))
    .map(([, label]) => label);
}
