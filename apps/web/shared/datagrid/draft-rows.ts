export const SMS_GRID_PASTE_ROW_LIMIT = 500;

export interface SmsDraftRowState {
  isNew?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  error?: string | null;
}

export function addSmsDraftRow<TRow>(rows: TRow[], createRow: () => TRow) {
  return [...rows, createRow()];
}

export function addSmsDraftRows<TRow>(rows: TRow[], count: number, createRow: () => TRow) {
  if (count <= 0) return rows;
  if (count > SMS_GRID_PASTE_ROW_LIMIT) {
    throw new Error(`Maksimal ${SMS_GRID_PASTE_ROW_LIMIT} baris dalam satu paste.`);
  }
  return [...rows, ...Array.from({ length: count }, createRow)];
}

export function cancelSmsDraftRows<TRow extends SmsDraftRowState>(rows: TRow[]) {
  return rows.filter((row) => !row.isNew);
}

export function hasSmsDraftChanges<TRow extends SmsDraftRowState>(rows: TRow[]) {
  return rows.some((row) => row.isNew || row.isDirty);
}

export function markSmsDraftRowError<TRow extends SmsDraftRowState>(
  rows: TRow[],
  predicate: (row: TRow) => boolean,
  error: string | null,
) {
  return rows.map((row) => (
    predicate(row)
      ? { ...row, error }
      : row
  ));
}

export function enforceSmsPasteRowLimit(rowCount: number) {
  if (rowCount > SMS_GRID_PASTE_ROW_LIMIT) {
    return `Paste maksimal ${SMS_GRID_PASTE_ROW_LIMIT} baris.`;
  }
  return null;
}
