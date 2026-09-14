export interface SmsGridClipboardColumn<TRow extends Record<string, unknown>> {
  key: Extract<keyof TRow, string>;
  header: string;
  hidden?: boolean;
  system?: boolean;
  action?: boolean;
  editable?: boolean | ((row: TRow) => boolean);
  format?: (value: unknown, row: TRow) => string;
  parse?: (value: string, row: TRow) => { value: unknown; error?: string };
}

export interface SmsGridPasteError {
  rowIndex: number;
  columnKey: string;
  value: string;
  message: string;
}

export interface ApplyGridPasteInput<TRow extends Record<string, unknown>> {
  rows: TRow[];
  columns: Array<SmsGridClipboardColumn<TRow>>;
  startRowIndex: number;
  startColumnKey: Extract<keyof TRow, string>;
  text: string;
  createDraftRow: () => TRow;
  isRowEditable: (row: TRow) => boolean;
  canAppendRows?: boolean;
}

function isBusinessColumn<TRow extends Record<string, unknown>>(column: SmsGridClipboardColumn<TRow>) {
  return !column.hidden && !column.system && !column.action;
}

function isEditableColumn<TRow extends Record<string, unknown>>(column: SmsGridClipboardColumn<TRow>, row: TRow) {
  if (!isBusinessColumn(column)) return false;
  if (typeof column.editable === "function") return column.editable(row);
  return column.editable !== false;
}

function formatValue<TRow extends Record<string, unknown>>(row: TRow, column: SmsGridClipboardColumn<TRow>) {
  if (column.format) return column.format(row[column.key], row);
  const value = row[column.key];
  return value == null ? "" : String(value);
}

export function parseClipboardTsv(text: string) {
  const normalized = text.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n");
  const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutTrailingNewline.split("\n").map((row) => row.split("\t"));
}

export function copyFocusedGridCell<TRow extends Record<string, unknown>>(
  row: TRow,
  column: SmsGridClipboardColumn<TRow>,
) {
  return isBusinessColumn(column) ? formatValue(row, column) : "";
}

export function copySelectedGridRows<TRow extends Record<string, unknown>>(
  rows: TRow[],
  columns: Array<SmsGridClipboardColumn<TRow>>,
) {
  const copyColumns = columns.filter(isBusinessColumn);
  return rows
    .map((row) => copyColumns.map((column) => formatValue(row, column)).join("\t"))
    .join("\n");
}

export function isCopyShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
}

export function isPasteShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v";
}

export function createEnumPasteParser(options: Array<{ value: string; label: string; aliases?: string[] }>) {
  const entries = options.flatMap((option) => [
    [option.value, option.value] as const,
    [option.label, option.value] as const,
    ...(option.aliases ?? []).map((alias) => [alias, option.value] as const),
  ]);
  const lookup = new Map(entries.map(([label, value]) => [label.trim().toLowerCase(), value]));

  return (input: string) => {
    const value = lookup.get(input.trim().toLowerCase());
    if (!value) {
      return { value: input, error: `Pilihan tidak dikenal: ${input}` };
    }
    return { value };
  };
}

export function applyGridPaste<TRow extends Record<string, unknown>>(
  input: ApplyGridPasteInput<TRow>,
) {
  const matrix = parseClipboardTsv(input.text);
  const canAppendRows = input.canAppendRows ?? true;
  const sourceRow = input.rows[input.startRowIndex];
  const nextRows = input.rows.map((row) => ({ ...row })) as TRow[];
  const errors: SmsGridPasteError[] = [];

  const startRowIndex = sourceRow && input.isRowEditable(sourceRow)
    ? input.startRowIndex
    : nextRows.length;

  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    let rowIndex = startRowIndex + rowOffset;

    if (!nextRows[rowIndex]) {
      if (!canAppendRows) break;
      nextRows.push(input.createDraftRow());
    }

    if (!input.isRowEditable(nextRows[rowIndex])) {
      if (!canAppendRows) continue;
      nextRows.push(input.createDraftRow());
      rowIndex = nextRows.length - 1;
    }

    const row = nextRows[rowIndex];
    const editableColumns = input.columns.filter((column) => isEditableColumn(column, row));
    const startColumnIndex = editableColumns.findIndex((column) => column.key === input.startColumnKey);
    const targetColumns = editableColumns.slice(Math.max(0, startColumnIndex));

    for (let columnOffset = 0; columnOffset < matrix[rowOffset].length; columnOffset += 1) {
      const column = targetColumns[columnOffset];
      if (!column) break;

      const rawValue = matrix[rowOffset][columnOffset] ?? "";
      const parsed = column.parse?.(rawValue, row) ?? { value: rawValue };

      if (parsed.error) {
        errors.push({
          rowIndex,
          columnKey: column.key,
          value: rawValue,
          message: parsed.error,
        });
        continue;
      }

      nextRows[rowIndex] = {
        ...nextRows[rowIndex],
        [column.key]: parsed.value,
      };
    }
  }

  return { rows: nextRows, errors };
}
