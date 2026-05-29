import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import type { ReactNode } from "react";

export type SmartDataGridCellValue = string | number | boolean | null;

export interface SmartDataGridColumn {
  key: string;
  label: string;
  hideHeader?: boolean;
  kind?: "text" | "mono" | "status" | "number";
  align?: "left" | "center" | "right";
  widthClassName?: string;
  sticky?: boolean;
  renderCell?: (
    value: SmartDataGridCellValue,
    row: Record<string, SmartDataGridCellValue>,
  ) => ReactNode;
  filterKey?: string;
  filterOptions?: Array<{ label: string; value: string }>;
  sortable?: boolean;
  sortKey?: string;
}

export interface SmartDataGridFilterDefinition {
  field: string;
  label: string;
  options: Array<{
    label: string;
    value: string;
  }>;
}

export interface SmartDataGridSortOption {
  label: string;
  value: string;
}

export interface SmartDataGridSavedView {
  id: string;
  label: string;
  search?: string;
  sortBy?: string;
  sortDirection?: GridQueryState["sortDirection"];
  filters?: GridFilter[];
}

export interface SmartDataGridBulkInsertConfig {
  title: string;
  description: string;
  requiredColumns: string[];
  template: string;
}

export type SmartDataGridRow = Record<string, SmartDataGridCellValue>;
