import type {
  ReportDefinition,
  ReportFilterDefinition,
  ReportSortOption,
  ReportType,
  ReportColumn,
} from "@smsystem/contracts/reports";

interface ReportFilterConfig {
  field: string;
  label: string;
}

export interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  columns: ReportColumn[];
  sortOptions: ReportSortOption[];
  filterConfigs: ReportFilterConfig[];
  defaultSortBy: string;
  defaultSortDirection: "asc" | "desc";
}

const REPORT_CONFIGS: Record<ReportType, ReportConfig> = {
  "delivery-accuracy": {
    type: "delivery-accuracy",
    title: "Delivery Accuracy",
    description: "Tracking target delivery versus final approval delivery readiness per unit.",
    columns: [
      { key: "unitName", label: "Unit", kind: "mono", sticky: true },
      { key: "customerName", label: "Customer" },
      { key: "incomingDate", label: "Incoming", kind: "mono" },
      { key: "contractDeliveryDate", label: "Target", kind: "mono" },
      { key: "qcApprovedAt", label: "Ready At", kind: "mono" },
      { key: "delayDays", label: "Delay", kind: "number", align: "right" },
      { key: "deliveryStatus", label: "Status", kind: "status" },
      { key: "carStatus", label: "Unit Status", kind: "status" },
    ],
    sortOptions: [
      { label: "Delay", value: "delayDays" },
      { label: "Target", value: "contractDeliveryDate" },
      { label: "Ready At", value: "qcApprovedAt" },
      { label: "Unit", value: "unitName" },
    ],
    filterConfigs: [{ field: "deliveryStatus", label: "Filter Delivery" }],
    defaultSortBy: "delayDays",
    defaultSortDirection: "desc",
  },
  manhour: {
    type: "manhour",
    title: "Manhour Report",
    description: "Actual work ledger by day, PIC, unit, and division.",
    columns: [
      { key: "workDate", label: "Work Date", kind: "mono", sticky: true },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "employeeName", label: "PIC" },
      { key: "durationHours", label: "Hours", kind: "number", align: "right" },
      { key: "overtimeHours", label: "OT Hours", kind: "number", align: "right" },
      { key: "progressPercent", label: "Progress", kind: "number", align: "right" },
      { key: "taskStatus", label: "Status", kind: "status" },
    ],
    sortOptions: [
      { label: "Work Date", value: "workDate" },
      { label: "Hours", value: "durationHours" },
      { label: "OT Hours", value: "overtimeHours" },
      { label: "Unit", value: "unitName" },
    ],
    filterConfigs: [
      { field: "divisionId", label: "Filter Divisi" },
      { field: "taskStatus", label: "Filter Status" },
    ],
    defaultSortBy: "workDate",
    defaultSortDirection: "desc",
  },
  "division-kpi": {
    type: "division-kpi",
    title: "Division KPI",
    description: "Summary KPI per division and unit from monitoring aggregate.",
    columns: [
      { key: "divisionName", label: "Divisi", sticky: true },
      { key: "unitName", label: "Unit" },
      { key: "totalManHoursSpent", label: "Manhour", kind: "number", align: "right" },
      { key: "avgProgressPercentage", label: "Avg Progress", kind: "number", align: "right" },
      { key: "countPanelPlan", label: "Panel Plan", kind: "number", align: "right" },
      { key: "countPanelDone", label: "Panel Done", kind: "number", align: "right" },
      { key: "completionRate", label: "Completion %", kind: "number", align: "right" },
      { key: "lastUpdatedAt", label: "Updated", kind: "mono" },
    ],
    sortOptions: [
      { label: "Completion", value: "completionRate" },
      { label: "Manhour", value: "totalManHoursSpent" },
      { label: "Progress", value: "avgProgressPercentage" },
      { label: "Updated", value: "lastUpdatedAt" },
    ],
    filterConfigs: [{ field: "divisionId", label: "Filter Divisi" }],
    defaultSortBy: "completionRate",
    defaultSortDirection: "desc",
  },
  "qc-reject": {
    type: "qc-reject",
    title: "QC Reject",
    description: "QC inspection trail with reject/rework visibility by unit and level.",
    columns: [
      { key: "inspectionDate", label: "Inspection", kind: "mono", sticky: true },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "qcLevel", label: "QC Level", kind: "status" },
      { key: "resultStatus", label: "Result", kind: "status" },
      { key: "hasRework", label: "Rework", kind: "status" },
      { key: "reworkPlanId", label: "Rework Plan", kind: "mono" },
    ],
    sortOptions: [
      { label: "Inspection", value: "inspectionDate" },
      { label: "QC Level", value: "qcLevel" },
      { label: "Result", value: "resultStatus" },
      { label: "Unit", value: "unitName" },
    ],
    filterConfigs: [
      { field: "resultStatus", label: "Filter Result" },
      { field: "qcLevel", label: "Filter QC" },
    ],
    defaultSortBy: "inspectionDate",
    defaultSortDirection: "desc",
  },
  issues: {
    type: "issues",
    title: "Issue Log Report",
    description: "Issue log backlog, urgency, and resolution tracking.",
    columns: [
      { key: "issueNumber", label: "Issue", kind: "mono", sticky: true },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "sourceType", label: "Source", kind: "status" },
      { key: "severity", label: "Severity", kind: "status" },
      { key: "status", label: "Status", kind: "status" },
      { key: "isUrgent", label: "Urgent", kind: "status" },
      { key: "createdAt", label: "Created", kind: "mono" },
      { key: "resolvedAt", label: "Resolved", kind: "mono" },
    ],
    sortOptions: [
      { label: "Created", value: "createdAt" },
      { label: "Severity", value: "severity" },
      { label: "Status", value: "status" },
      { label: "Unit", value: "unitName" },
    ],
    filterConfigs: [
      { field: "divisionId", label: "Filter Divisi" },
      { field: "severity", label: "Filter Severity" },
      { field: "status", label: "Filter Status" },
      { field: "sourceType", label: "Filter Source" },
    ],
    defaultSortBy: "createdAt",
    defaultSortDirection: "desc",
  },
  spk: {
    type: "spk",
    title: "SPK Report",
    description: "SPK header/detail performance and approval state per unit.",
    columns: [
      { key: "spkNumber", label: "SPK", kind: "mono", sticky: true },
      { key: "spkDate", label: "Date", kind: "mono" },
      { key: "status", label: "Status", kind: "status" },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "jobName", label: "Job" },
      { key: "targetDate", label: "Target Date", kind: "mono" },
      { key: "targetHours", label: "Target Hours", kind: "number", align: "right" },
      { key: "approvalState", label: "Approval", kind: "status" },
    ],
    sortOptions: [
      { label: "SPK Date", value: "spkDate" },
      { label: "Target Date", value: "targetDate" },
      { label: "Target Hours", value: "targetHours" },
      { label: "Status", value: "status" },
    ],
    filterConfigs: [
      { field: "status", label: "Filter SPK" },
      { field: "approvalState", label: "Filter Approval" },
      { field: "divisionName", label: "Filter Divisi" },
    ],
    defaultSortBy: "spkDate",
    defaultSortDirection: "desc",
  },
  "wo-aging": {
    type: "wo-aging",
    title: "WO Aging",
    description: "Aging and approval visibility for internal work orders.",
    columns: [
      { key: "woNumber", label: "WO", kind: "mono", sticky: true },
      { key: "requestDate", label: "Request Date", kind: "mono" },
      { key: "unitName", label: "Unit" },
      { key: "fromDivisionName", label: "From" },
      { key: "toDivisionName", label: "To" },
      { key: "estimatedHours", label: "Est Hours", kind: "number", align: "right" },
      { key: "status", label: "Status", kind: "status" },
      { key: "accTracking", label: "Tracking", kind: "number", align: "right" },
      { key: "ageDays", label: "Age", kind: "number", align: "right" },
      { key: "agingBucket", label: "Bucket", kind: "status" },
    ],
    sortOptions: [
      { label: "Age", value: "ageDays" },
      { label: "Request Date", value: "requestDate" },
      { label: "Status", value: "status" },
      { label: "Unit", value: "unitName" },
    ],
    filterConfigs: [
      { field: "status", label: "Filter Status" },
      { field: "toDivisionId", label: "Filter To Div" },
    ],
    defaultSortBy: "ageDays",
    defaultSortDirection: "desc",
  },
  "pr-aging": {
    type: "pr-aging",
    title: "PR Aging",
    description: "Purchase request aging by approval lane and item status.",
    columns: [
      { key: "prNumber", label: "PR", kind: "mono", sticky: true },
      { key: "createdAt", label: "Created", kind: "mono" },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "itemCount", label: "Items", kind: "number", align: "right" },
      { key: "estimatedTotal", label: "Est Total", kind: "number", align: "right" },
      { key: "actualTotal", label: "Actual Total", kind: "number", align: "right" },
      { key: "approvalStatus", label: "Approval", kind: "status" },
      { key: "status", label: "Status", kind: "status" },
      { key: "ageDays", label: "Age", kind: "number", align: "right" },
    ],
    sortOptions: [
      { label: "Age", value: "ageDays" },
      { label: "Created", value: "createdAt" },
      { label: "Estimated", value: "estimatedTotal" },
      { label: "Actual", value: "actualTotal" },
    ],
    filterConfigs: [
      { field: "status", label: "Filter Status" },
      { field: "approvalStatus", label: "Filter Approval" },
    ],
    defaultSortBy: "ageDays",
    defaultSortDirection: "desc",
  },
  "material-cost": {
    type: "material-cost",
    title: "Material Cost",
    description: "Material usage cost by unit, division, and item category.",
    columns: [
      { key: "usageDate", label: "Usage Date", kind: "mono", sticky: true },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "itemName", label: "Item" },
      { key: "itemCategory", label: "Category", kind: "status" },
      { key: "qty", label: "Qty", kind: "number", align: "right" },
      { key: "pricePerUnit", label: "Price", kind: "number", align: "right" },
      { key: "totalPrice", label: "Total", kind: "number", align: "right" },
    ],
    sortOptions: [
      { label: "Usage Date", value: "usageDate" },
      { label: "Total", value: "totalPrice" },
      { label: "Unit", value: "unitName" },
      { label: "Item", value: "itemName" },
    ],
    filterConfigs: [
      { field: "divisionId", label: "Filter Divisi" },
      { field: "itemCategory", label: "Filter Category" },
    ],
    defaultSortBy: "usageDate",
    defaultSortDirection: "desc",
  },
  "cash-flow": {
    type: "cash-flow",
    title: "Cash Flow Forecast",
    description: "Estimated and actual outgoing cash from PR, vendor WO, and material usage.",
    columns: [
      { key: "cashDate", label: "Cash Date", kind: "mono", sticky: true },
      { key: "sourceType", label: "Source", kind: "status" },
      { key: "documentNumber", label: "Document", kind: "mono" },
      { key: "unitName", label: "Unit" },
      { key: "divisionName", label: "Divisi" },
      { key: "vendorName", label: "Vendor" },
      { key: "estimatedAmount", label: "Estimated", kind: "number", align: "right" },
      { key: "actualAmount", label: "Actual", kind: "number", align: "right" },
      { key: "status", label: "Status", kind: "status" },
    ],
    sortOptions: [
      { label: "Cash Date", value: "cashDate" },
      { label: "Estimated", value: "estimatedAmount" },
      { label: "Actual", value: "actualAmount" },
      { label: "Source", value: "sourceType" },
    ],
    filterConfigs: [{ field: "sourceType", label: "Filter Source" }],
    defaultSortBy: "cashDate",
    defaultSortDirection: "desc",
  },
};

export function getReportConfig(type: ReportType): ReportConfig {
  return REPORT_CONFIGS[type];
}

export function buildReportDefinition(
  type: ReportType,
  filterOptions: Record<string, ReportFilterDefinition["options"]>,
): ReportDefinition {
  const config = getReportConfig(type);

  return {
    type,
    title: config.title,
    description: config.description,
    columns: config.columns,
    sortOptions: config.sortOptions,
    filters: config.filterConfigs.map((filter) => ({
      field: filter.field,
      label: filter.label,
      options: filterOptions[filter.field] ?? [],
    })),
    exportFormats: ["csv", "xlsx"],
  };
}
