import ExcelJS from "exceljs";

export type ExcelCellPrimitive = string | number | boolean | Date | null;
type ExcelLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

function normalizeCellValue(value: ExcelJS.CellValue): ExcelCellPrimitive {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }

  if ("result" in value) {
    return normalizeCellValue(value.result as ExcelJS.CellValue);
  }

  return String(value);
}

export async function writeWorkbookBuffer(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer as ArrayBuffer);
}

export function addRowsWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: ExcelCellPrimitive[][],
  widths?: number[],
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRows(rows);
  if (widths) {
    worksheet.columns = widths.map((width) => ({ width }));
  }
  return worksheet;
}

export async function loadWorkbookFromBuffer(buffer: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as unknown as ExcelLoadBuffer);
  return workbook;
}

export async function readFirstWorksheetRows(
  buffer: Uint8Array,
): Promise<Record<string, unknown>[] | null> {
  const workbook = await loadWorkbookFromBuffer(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return null;
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(normalizeCellValue(cell.value) ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const objectRow: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      const value = normalizeCellValue(row.getCell(index + 1).value);
      if (value !== "") {
        hasValue = true;
      }
      objectRow[header] = value;
    });

    if (hasValue) {
      rows.push(objectRow);
    }
  });

  return rows;
}
