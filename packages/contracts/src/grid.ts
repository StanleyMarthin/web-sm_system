import { z } from "zod";

export const GRID_LIMIT_OPTIONS = [10, 25, 50, 100] as const;

export const gridSortDirectionSchema = z.enum(["asc", "desc"]);
export const gridFilterOperatorSchema = z.enum(["eq", "contains"]);

export const gridFilterSchema = z.object({
  field: z.string().trim().min(1).max(50),
  operator: gridFilterOperatorSchema,
  value: z.string().trim().min(1).max(100),
});

export const gridQueryStateSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(""),
  sortBy: z.string().trim().min(1).max(50).default("employeeId"),
  sortDirection: gridSortDirectionSchema.default("asc"),
  view: z.string().trim().min(1).max(50).nullable().default(null),
  filters: z.array(gridFilterSchema).default([]),
});

export const gridMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export interface BulkGridValidationIssue {
  rowNumber: number;
  field: string;
  message: string;
}

export interface BulkGridValidationResult {
  isValid: boolean;
  headers: string[];
  rowCount: number;
  rows: Array<Record<string, string>>;
  issues: BulkGridValidationIssue[];
}

export interface BulkGridValidationOptions {
  requiredColumns: string[];
}

function parseIntegerParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/u, "").trim();
}

function detectDelimiter(firstLine: string): string {
  return firstLine.includes("\t") ? "\t" : ",";
}

export function parseGridFilterToken(token: string): GridFilter | null {
  const [field, operator, ...valueParts] = token.split(":");
  const value = valueParts.join(":").trim();

  const parsed = gridFilterSchema.safeParse({
    field: field?.trim(),
    operator: operator?.trim(),
    value,
  });

  return parsed.success ? parsed.data : null;
}

export function encodeGridFilterToken(filter: GridFilter): string {
  return `${filter.field}:${filter.operator}:${filter.value}`;
}

export function parseGridQueryParams(searchParams: URLSearchParams): GridQueryState {
  return gridQueryStateSchema.parse({
    page: parseIntegerParam(searchParams.get("page"), 1),
    limit: parseIntegerParam(searchParams.get("limit"), 25),
    search: searchParams.get("search") ?? "",
    sortBy: searchParams.get("sortBy") ?? "employeeId",
    sortDirection: searchParams.get("sortDirection") ?? "asc",
    view: searchParams.get("view")?.trim() || null,
    filters: searchParams
      .getAll("filter")
      .map(parseGridFilterToken)
      .filter((filter): filter is GridFilter => filter !== null),
  });
}

export function validateBulkGridInput(
  input: string,
  options: BulkGridValidationOptions,
): BulkGridValidationResult {
  const normalizedInput = input.trim().replace(/\r\n/gu, "\n");
  if (!normalizedInput) {
    return {
      isValid: false,
      headers: [],
      rowCount: 0,
      rows: [],
      issues: [
        {
          rowNumber: 0,
          field: "input",
          message: "Input is required.",
        },
      ],
    };
  }

  const lines = normalizedInput.split("\n").filter(Boolean);
  const delimiter = detectDelimiter(lines[0] ?? "");
  const headers = (lines[0] ?? "").split(delimiter).map(normalizeHeader);
  const issues: BulkGridValidationIssue[] = [];

  for (const requiredColumn of options.requiredColumns) {
    if (!headers.includes(requiredColumn)) {
      issues.push({
        rowNumber: 1,
        field: requiredColumn,
        message: "Column is required.",
      });
    }
  }

  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = line.split(delimiter).map((value) => value.trim());
    const row = headers.reduce<Record<string, string>>((accumulator, header, headerIndex) => {
      accumulator[header] = values[headerIndex] ?? "";
      return accumulator;
    }, {});

    for (const requiredColumn of options.requiredColumns) {
      if (!(row[requiredColumn] ?? "").trim()) {
        issues.push({
          rowNumber: rowIndex + 2,
          field: requiredColumn,
          message: "Value is required.",
        });
      }
    }

    return row;
  });

  return {
    isValid: issues.length === 0,
    headers,
    rowCount: rows.length,
    rows,
    issues,
  };
}

export type GridFilter = z.infer<typeof gridFilterSchema>;
export type GridQueryState = z.infer<typeof gridQueryStateSchema>;
export type GridMeta = z.infer<typeof gridMetaSchema>;
