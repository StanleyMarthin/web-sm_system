"use client";

import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import type { AuthUser } from "@smsystem/contracts/auth";
import type { CreateUnitRequest, UnitBoardRow, UpdateUnitRequest } from "@smsystem/contracts/unit";
import { permissionCodes } from "@smsystem/permissions";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { createUnit, deleteUnit, updateUnit } from "@/shared/api/units";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface UnitBoardShellProps {
  rows: UnitBoardRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: GridQueryState;
  user: AuthUser | null;
}

interface UnitFormState {
  unitId: string;
  unitName: string;
  plateNumber: string;
  customerName: string;
  restorationType: string;
  isMargin: boolean;
  contractDeliveryDate: string;
  incomingDate: string;
  revisionContract: string;
  status: "In_Progress" | "Done";
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Target Delivery", value: "targetDeliveryDate" },
  { label: "Unit", value: "unitName" },
  { label: "Customer", value: "customerName" },
  { label: "ETA", value: "etaDate" },
  { label: "Risk", value: "riskLevel" },
  { label: "Progress", value: "progressPercent" },
  { label: "Remaining Hours", value: "remainingHours" },
  { label: "WO Open", value: "woOpenCount" },
  { label: "Issue Open", value: "issueOpenCount" },
  { label: "Status", value: "status" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-units",
    label: "All",
    sortBy: "targetDeliveryDate",
    sortDirection: "asc",
    filters: [],
  },
  {
    id: "critical-risk",
    label: "Critical",
    sortBy: "targetDeliveryDate",
    sortDirection: "asc",
    filters: [
      {
        field: "riskLevel",
        operator: "eq",
        value: "RED",
      } satisfies GridFilter,
    ],
  },
];

const filters: SmartDataGridFilterDefinition[] = [
  {
    field: "riskLevel",
    label: "Filter Risk",
    options: [
      { label: "GREEN", value: "GREEN" },
      { label: "YELLOW", value: "YELLOW" },
      { label: "ORANGE", value: "ORANGE" },
      { label: "RED", value: "RED" },
      { label: "UNKNOWN", value: "UNKNOWN" },
    ],
  },
  {
    field: "status",
    label: "Status",
    options: [
      { label: "Sedang Berjalan", value: "In_Progress" },
      { label: "Selesai", value: "Done" },
    ],
  },
];

function emptyForm(): UnitFormState {
  return {
    unitId: "",
    unitName: "",
    plateNumber: "",
    customerName: "",
    restorationType: "FULL_RESTORASI",
    isMargin: true,
    contractDeliveryDate: "",
    incomingDate: "",
    revisionContract: "",
    status: "In_Progress",
  };
}

function formFromUnit(row: UnitBoardRow): UnitFormState {
  return {
    unitId: row.unitId,
    unitName: row.unitName,
    plateNumber: row.plateNumber ?? "",
    customerName: row.customerName ?? "",
    restorationType: row.restorationType ?? "FULL_RESTORASI",
    isMargin: row.isMargin,
    contractDeliveryDate: row.targetDeliveryDate ?? "",
    incomingDate: row.incomingDate ?? "",
    revisionContract: row.revisionContract ?? "",
    status: row.status === "Done" ? "Done" : "In_Progress",
  };
}

function nullableText(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function nullableDate(value: string) {
  return value.trim() ? value : null;
}

function canManageUnitMaster(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  return (
    user.scope.canViewAllUnits ||
    user.permissions.includes(permissionCodes.viewAllUnits) ||
    user.permissions.includes(permissionCodes.manageUsers) ||
    user.permissions.includes(permissionCodes.unitPanelManage)
  );
}

function getMutationErrorDetail(result: {
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
}): string {
  const dependencySummary = result.data?.dependencySummary;
  const dependencyText = Array.isArray(dependencySummary) && dependencySummary.length > 0
    ? `\n\nDipakai di: ${dependencySummary.map(String).join(", ")}`
    : "";
  const errorCode = result.errorCode ? `\nKode: ${result.errorCode}` : "";

  return `${result.message}${dependencyText}${errorCode}`;
}

export function UnitBoardShell({ rows, meta, state, user }: UnitBoardShellProps) {
  const router = useRouter();
  const sweetAlert = useSweetAlert();
  const canManageUnits = canManageUnitMaster(user);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<UnitFormState>(emptyForm());
  const [pending, setPending] = useState(false);

  function openCreate() {
    setForm(emptyForm());
    setDialogMode("create");
  }

  function openEdit(unitId: string) {
    const unit = rows.find((row) => row.unitId === unitId);
    if (!unit) return;
    setForm(formFromUnit(unit));
    setDialogMode("edit");
  }

  async function handleSubmit() {
    setPending(true);
    const input: UpdateUnitRequest = {
      unitName: form.unitName,
      plateNumber: nullableText(form.plateNumber),
      customerName: nullableText(form.customerName),
      restorationType: form.restorationType.trim() || "FULL_RESTORASI",
      isMargin: form.isMargin,
      contractDeliveryDate: nullableDate(form.contractDeliveryDate),
      incomingDate: nullableDate(form.incomingDate),
      revisionContract: nullableDate(form.revisionContract),
      status: form.status,
    };

    const result = dialogMode === "create"
      ? await createUnit({ unitId: form.unitId.trim(), ...input } satisfies CreateUnitRequest)
      : await updateUnit(form.unitId, input);

    setPending(false);
    if (!result.success) {
      sweetAlert.notifyError("Unit belum tersimpan", getMutationErrorDetail(result));
      return;
    }

    sweetAlert.notifySuccess(dialogMode === "create" ? "Unit dibuat" : "Unit diperbarui");
    setDialogMode(null);
    router.refresh();
  }

  async function handleDelete(unitId: string, unitName: string) {
    const confirmed = await sweetAlert.confirm({
      title: "Hapus unit?",
      description: `${unitName} hanya bisa dihapus jika belum dipakai data operasional.`,
      confirmLabel: "Hapus",
      cancelLabel: "Batal",
      tone: "warning",
    });
    if (!confirmed) return;

    const result = await deleteUnit(unitId);
    if (!result.success) {
      sweetAlert.notifyError("Unit belum terhapus", getMutationErrorDetail(result));
      return;
    }

    sweetAlert.notifySuccess("Unit dihapus");
    router.refresh();
  }

  const columns: SmartDataGridColumn[] = [
    {
      key: "unitName",
      label: "Unit",
      kind: "text",
      sticky: true,
      renderCell: (value, row) => (
        <div className="space-y-1">
          <p className="font-mono text-[14px] font-medium text-foreground">{String(value ?? "-")}</p>
          <p className="font-mono text-[14px] text-muted-foreground">{String(row.unitId ?? "-")}</p>
        </div>
      ),
    },
    { key: "customerName", label: "Customer", kind: "text" },
    { key: "kpName", label: "KP", kind: "text" },
    { key: "advisorName", label: "Advisor", kind: "text" },
    { key: "targetDeliveryDate", label: "Target", kind: "mono" },
    { key: "etaDate", label: "ETA", kind: "mono" },
    {
      key: "riskLevel",
      label: "Risk",
      kind: "status",
      align: "center",
      filterKey: "riskLevel",
      filterOptions: [
        { label: "GREEN", value: "GREEN" },
        { label: "YELLOW", value: "YELLOW" },
        { label: "ORANGE", value: "ORANGE" },
        { label: "RED", value: "RED" },
        { label: "UNKNOWN", value: "UNKNOWN" },
      ],
    },
    { key: "progressPercent", label: "Progress %", kind: "number", align: "right" },
    { key: "remainingHours", label: "Sisa Jam", kind: "number", align: "right" },
    { key: "woOpenCount", label: "WO", kind: "number", align: "center" },
    { key: "prOpenCount", label: "PR", kind: "number", align: "center" },
    { key: "qcIssueOpenCount", label: "QC", kind: "number", align: "center" },
    { key: "issueOpenCount", label: "Issue", kind: "number", align: "center" },
    {
      key: "workspace",
      label: "Action",
      kind: "text",
      align: "center",
      renderCell: (_value, row) => (
        <div className="flex items-center justify-center gap-1.5">
          <Link
            href={`/units/${String(row.unitId ?? "")}`}
            className="inline-flex border border-primary/30 bg-primary/[0.04] px-2 py-0.5 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:border-primary/60 hover:bg-primary/10 hover:text-app-accent-ink"
          >
            Workspace
          </Link>
          {canManageUnits ? (
            <>
              <button
                type="button"
                onClick={() => openEdit(String(row.unitId ?? ""))}
                className="inline-flex h-6 w-6 items-center justify-center border border-border bg-transparent text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-app-accent-ink"
                title="Edit unit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(String(row.unitId ?? ""), String(row.unitName ?? "-"))}
                className="inline-flex h-6 w-6 items-center justify-center border border-border bg-transparent text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                title="Hapus unit"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <SmartDataGrid
        title="Unit Board"
        description=""
        columns={columns}
        rows={rows.map((row) => ({
          unitId: row.unitId,
          unitName: row.unitName,
          plateNumber: row.plateNumber,
          customerName: row.customerName,
          restorationType: row.restorationType,
          isMargin: row.isMargin,
          incomingDate: row.incomingDate,
          revisionContract: row.revisionContract,
          kpName: row.kpName,
          advisorName: row.advisorName,
          targetDeliveryDate: row.targetDeliveryDate,
          etaDate: row.etaDate,
          riskLevel: row.riskLevel,
          progressPercent: row.progressPercent,
          remainingHours: row.remainingHours,
          woOpenCount: row.woOpenCount,
          prOpenCount: row.prOpenCount,
          qcIssueOpenCount: row.qcIssueOpenCount,
          issueOpenCount: row.issueOpenCount,
          status: row.status,
          workspace: row.unitId,
        }))}
        meta={meta}
        state={state}
        searchPlaceholder="Cari unit / customer / KP..."
        searchMinLength={3}
        searchSuggestionFields={["unitName", "unitId", "customerName", "plateNumber", "kpName"]}
        searchSuggestionFormatter={(row) => {
          const unitName = String(row.unitName ?? "").trim();
          const unitId = String(row.unitId ?? "").trim();
          const customerName = String(row.customerName ?? "").trim();
          const plateNumber = String(row.plateNumber ?? "").trim();
          const kpName = String(row.kpName ?? "").trim();
          const title = unitName || unitId;
          if (!title) {
            return null;
          }

          const meta = [
            unitId ? `ID ${unitId}` : null,
            customerName || null,
            plateNumber || null,
            kpName ? `KP ${kpName}` : null,
          ].filter(Boolean).join(" · ");

          return {
            value: unitId || unitName,
            title,
            meta: meta || null,
          };
        }}
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        emptyMessage="Belum ada unit sesuai query saat ini."
        onRowClick={(row) => router.push(`/units/${String(row.unitId)}`)}
        getRowAriaLabel={(row) => `Buka workspace ${String(row.unitName ?? row.unitId)}`}
        viewportClassName="max-h-[calc(100svh-260px)]"
        headerActions={canManageUnits ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 border border-primary/40 bg-primary/10 px-3 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink shadow-sm transition-colors hover:bg-primary/20 hover:text-app-accent-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Unit
          </button>
        ) : null}
      />

      {dialogMode ? (
        <UnitMutationDialog
          mode={dialogMode}
          form={form}
          pending={pending}
          onChange={setForm}
          onClose={() => setDialogMode(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
      {sweetAlert.alertElement}
    </>
  );
}

function UnitMutationDialog({
  mode,
  form,
  pending,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: UnitFormState;
  pending: boolean;
  onChange: (value: UnitFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const fieldClass =
    "h-8 w-full border border-border bg-card px-3 text-[15px] font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40";
  const labelClass = "space-y-1.5";
  const captionClass = "block text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 dark:bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-primary/20 bg-primary/[0.02] px-4 py-3">
          <div>
            <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-app-accent-ink">
              {mode === "create" ? "Tambah Unit" : "Edit Unit"}
            </p>
            <p className="mt-1 text-[15px] font-mono text-muted-foreground">{form.unitName || "Data unit baru"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground transition-colors bg-transparent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
          <label className={labelClass}>
            <span className={captionClass}>ID Unit</span>
            <input
              value={form.unitId}
              disabled={mode === "edit"}
              onChange={(event) => onChange({ ...form, unitId: event.target.value })}
              className={`${fieldClass} disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground`}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Nama Unit</span>
            <input
              value={form.unitName}
              onChange={(event) => onChange({ ...form, unitName: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Plat Nomor</span>
            <input
              value={form.plateNumber}
              onChange={(event) => onChange({ ...form, plateNumber: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Customer</span>
            <input
              value={form.customerName}
              onChange={(event) => onChange({ ...form, customerName: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Tipe Restorasi</span>
            <input
              value={form.restorationType}
              onChange={(event) => onChange({ ...form, restorationType: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Status</span>
            <select
              value={form.status}
              onChange={(event) => onChange({ ...form, status: event.target.value === "Done" ? "Done" : "In_Progress" })}
              className={`${fieldClass} dark:[color-scheme:dark]`}
            >
              <option value="In_Progress">Sedang Berjalan</option>
              <option value="Done">Selesai</option>
            </select>
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Tanggal Masuk</span>
            <input
              type="date"
              value={form.incomingDate}
              onChange={(event) => onChange({ ...form, incomingDate: event.target.value })}
              className={`${fieldClass} dark:[color-scheme:dark]`}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Target Kontrak</span>
            <input
              type="date"
              value={form.contractDeliveryDate}
              onChange={(event) => onChange({ ...form, contractDeliveryDate: event.target.value })}
              className={`${fieldClass} dark:[color-scheme:dark]`}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Revisi Target</span>
            <input
              type="date"
              value={form.revisionContract}
              onChange={(event) => onChange({ ...form, revisionContract: event.target.value })}
              className={`${fieldClass} dark:[color-scheme:dark]`}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-[15px] font-mono text-muted-foreground">
            <input
              type="checkbox"
              checked={form.isMargin}
              onChange={(event) => onChange({ ...form, isMargin: event.target.checked })}
              className="h-3.5 w-3.5 border-border bg-card checked:bg-primary checked:border-primary"
            />
            Unit margin
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-4 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground hover:border-border bg-transparent"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={pending || !form.unitId.trim() || !form.unitName.trim()}
            onClick={onSubmit}
            className="border border-primary/40 bg-primary/10 px-4 py-1.5 text-[14px] font-mono uppercase tracking-[0.12em] text-app-accent-ink shadow-sm transition-colors hover:bg-primary/20 hover:text-app-accent-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
