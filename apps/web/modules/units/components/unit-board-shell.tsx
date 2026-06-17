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
          <p className="font-mono text-[12px] font-medium text-white">{String(value ?? "-")}</p>
          <p className="font-mono text-[10px] text-white/40">{String(row.unitId ?? "-")}</p>
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
            className="inline-flex border border-amber-500/30 bg-amber-500/[0.04] px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-400"
          >
            Workspace
          </Link>
          {canManageUnits ? (
            <>
              <button
                type="button"
                onClick={() => openEdit(String(row.unitId ?? ""))}
                className="inline-flex h-6 w-6 items-center justify-center border border-white/10 bg-transparent text-white/40 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
                title="Edit unit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(String(row.unitId ?? ""), String(row.unitName ?? "-"))}
                className="inline-flex h-6 w-6 items-center justify-center border border-white/10 bg-transparent text-white/35 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
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
        searchMinLength={2}
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        emptyMessage="Belum ada unit sesuai query saat ini."
        onRowClick={(row) => router.push(`/units/${String(row.unitId)}`)}
        getRowAriaLabel={(row) => `Buka workspace ${String(row.unitName ?? row.unitId)}`}
        headerActions={canManageUnits ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 shadow-sm transition-colors hover:bg-amber-500/20 hover:text-amber-400"
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
    "h-8 w-full border border-white/10 bg-black px-3 text-[11px] font-mono text-white/80 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/40";
  const labelClass = "space-y-1.5";
  const captionClass = "block text-[10px] font-mono uppercase tracking-[0.12em] text-white/40";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl border border-white/10 bg-[#111114] shadow-2xl">
        <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/[0.02] px-4 py-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-amber-500">
              {mode === "create" ? "Tambah Unit" : "Edit Unit"}
            </p>
            <p className="mt-1 text-[11px] font-mono text-white/50">{form.unitName || "Data unit baru"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-white/40 hover:border-white/10 hover:text-white transition-colors bg-transparent"
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
              className={`${fieldClass} disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-white/30`}
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
              className={`${fieldClass} [color-scheme:dark]`}
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
              className={`${fieldClass} [color-scheme:dark]`}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Target Kontrak</span>
            <input
              type="date"
              value={form.contractDeliveryDate}
              onChange={(event) => onChange({ ...form, contractDeliveryDate: event.target.value })}
              className={`${fieldClass} [color-scheme:dark]`}
            />
          </label>
          <label className={labelClass}>
            <span className={captionClass}>Revisi Target</span>
            <input
              type="date"
              value={form.revisionContract}
              onChange={(event) => onChange({ ...form, revisionContract: event.target.value })}
              className={`${fieldClass} [color-scheme:dark]`}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-[11px] font-mono text-white/50">
            <input
              type="checkbox"
              checked={form.isMargin}
              onChange={(event) => onChange({ ...form, isMargin: event.target.checked })}
              className="h-3.5 w-3.5 border-white/20 bg-black checked:bg-amber-500 checked:border-amber-500"
            />
            Unit margin
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 bg-[#0a0a0c] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white hover:border-white/30 bg-transparent"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={pending || !form.unitId.trim() || !form.unitName.trim()}
            onClick={onSubmit}
            className="border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 shadow-sm transition-colors hover:bg-amber-500/20 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
