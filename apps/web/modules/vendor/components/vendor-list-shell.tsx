"use client";

import type {
  VendorGridQuery,
  VendorGridReference,
  VendorRecord,
} from "@smsystem/contracts/vendor";
import type { GridFilter } from "@smsystem/contracts/grid";
import { RefreshCcw, SendToBack, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createVendor } from "@/shared/api/vendor";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

interface VendorListShellProps {
  rows: VendorRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: VendorGridQuery;
  references: VendorGridReference;
  summary: {
    pendingApproval: number;
    activeVendorCount: number;
    overdueCount: number;
    reworkCount: number;
  };
  canCreate: boolean;
}

interface VendorItemState {
  itemName: string;
  quantity: string;
  uom: string;
  goodsConditionOut: string;
  estimatedCost: string;
}

interface VendorCreateFormState {
  carId: string;
  vendorName: string;
  targetDateReturn: string;
  remarks: string;
  items: VendorItemState[];
}

function emptyForm(): VendorCreateFormState {
  return {
    carId: "",
    vendorName: "",
    targetDateReturn: "",
    remarks: "",
    items: [
      {
        itemName: "",
        quantity: "1",
        uom: "pcs",
        goodsConditionOut: "",
        estimatedCost: "",
      },
    ],
  };
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-lg text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-white/40">{helper}</p> : null}
    </div>
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Dibuat", value: "createdAt" },
  { label: "Nomor WOV", value: "wovNumber" },
  { label: "Unit", value: "unitName" },
  { label: "Vendor", value: "vendorName" },
  { label: "Persetujuan", value: "accTracking" },
  { label: "Status", value: "status" },
  { label: "Target Kembali", value: "targetDateReturn" },
  { label: "Aging", value: "agingDays" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-vendor",
    label: "Semua",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [],
  },
  {
    id: "approval",
    label: "Persetujuan",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [
      {
        field: "accTracking",
        operator: "contains",
        value: "PENDING",
      } satisfies GridFilter,
    ],
  },
  {
    id: "rework",
    label: "Rework",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "REWORK_VENDOR",
      } satisfies GridFilter,
    ],
  },
];

const columns: SmartDataGridColumn[] = [
  {
    key: "wovNumber",
    label: "WOV",
    kind: "mono",
    sticky: true,
    renderCell: (value, row) => (
      <Link
        href={`/vendor/${String(row.wovId)}`}
        className="text-amber-400 transition-colors hover:text-amber-300"
      >
        {String(value)}
      </Link>
    ),
  },
  { key: "unitName", label: "Unit" },
  { key: "vendorName", label: "Vendor" },
  { key: "itemName", label: "Item" },
  { key: "accTracking", label: "Approval", kind: "status" },
  { key: "status", label: "Status", kind: "status" },
  { key: "targetDateReturn", label: "Target Return" },
  { key: "qcStatus", label: "QC", kind: "status" },
  { key: "agingDays", label: "Aging", kind: "number", align: "right" },
  { key: "riskScore", label: "Risk", kind: "number", align: "right" },
];

export function VendorListShell({
  rows,
  meta,
  state,
  references,
  summary,
  canCreate,
}: VendorListShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<VendorCreateFormState>(emptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filters: SmartDataGridFilterDefinition[] = [
    {
      field: "status",
      label: "Status",
      options: references.statuses,
    },
    {
      field: "accTracking",
      label: "Persetujuan",
      options: references.approvalStages,
    },
    {
      field: "vendorName",
      label: "Vendor",
      options: references.vendors,
    },
  ];

  async function handleCreate() {
    setMessage(null);
    setError(null);
    setIsCreating(true);

    try {
      const result = await createVendor({
        carId: form.carId,
        coreId: null,
        prId: null,
        vendorId: null,
        vendorName: form.vendorName.trim(),
        picVendor: null,
        itemName: null,
        quantity: null,
        uom: null,
        goodsConditionOut: null,
        targetDateReturn: form.targetDateReturn || null,
        estimatedCost: null,
        remarks: form.remarks.trim() || null,
        items: form.items.map((item) => ({
          itemName: item.itemName.trim(),
          quantity: item.quantity ? Number(item.quantity) : null,
          uom: item.uom.trim() || null,
          goodsConditionOut: item.goodsConditionOut.trim() || null,
          estimatedCost: item.estimatedCost ? Number(item.estimatedCost) : null,
        })),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("Vendor WO berhasil dibuat.");
      setForm(emptyForm());
      router.push(`/vendor/${result.result.wovId}`);
      router.refresh();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <SummaryCard
          label="Menunggu Persetujuan"
          value={String(summary.pendingApproval)}
          helper="Header WOV yang masih menunggu approval lane berikutnya."
        />
        <SummaryCard
          label="WOV Aktif"
          value={String(summary.activeVendorCount)}
          helper="Ticket vendor yang belum masuk status closed."
        />
        <SummaryCard
          label="Overdue"
          value={String(summary.overdueCount)}
          helper="Target return lewat dari tanggal hari ini."
        />
        <SummaryCard
          label="Rework"
          value={String(summary.reworkCount)}
          helper="Ticket vendor yang kembali ke vendor untuk rework."
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-[#050505] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <SendToBack className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
                  Vendor WO
                </p>
                <h3 className="mt-1 text-lg font-medium text-white">
                  Approval, progress vendor luar, dan receive checkpoint
                </h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/45">
              Modul ini membaca `sms_purchase.vnd_wo_vendor` dan membatasi read berdasarkan unit
              assignment serta divisi requester, bukan role hardcode.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                router.refresh();
              });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/55 ring-1 ring-white/[0.06] hover:text-white/80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-red-500/12 bg-red-500/[0.05] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-300/75">
              Overdue Snapshot
            </p>
            {rows.filter((row) => row.isCritical).length === 0 ? (
              <p className="mt-3 text-sm text-white/35">Belum ada WOV urgent di scope aktif.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {rows
                  .filter((row) => row.isCritical)
                  .slice(0, 4)
                  .map((row) => (
                    <Link
                      key={row.wovId}
                      href={`/vendor/${row.wovId}`}
                      className="block rounded-2xl border border-red-500/15 bg-black/20 px-4 py-3 transition-colors hover:border-red-400/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[12px] text-amber-300">{row.wovNumber}</p>
                          <p className="mt-1 text-sm text-white">{row.vendorName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/35">
                            {row.status} · target {row.targetDateReturn ?? "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-red-200">
                          <TriangleAlert className="h-4 w-4" />
                          {row.riskScore}
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500/70">
              Create Vendor WO
            </p>
            <div className="mt-3 grid gap-3">
              <select
                value={form.carId}
                onChange={(event) => setForm((current) => ({ ...current, carId: event.target.value }))}
                disabled={!canCreate}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30 disabled:opacity-40"
              >
                <option value="">Pilih Unit</option>
                {references.units.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                value={form.vendorName}
                onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))}
                disabled={!canCreate}
                placeholder="Nama Vendor"
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-500/30 disabled:opacity-40"
              />

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/45 uppercase tracking-wider pl-1 font-medium">Target Tanggal Kembali</span>
                <input
                  type="date"
                  value={form.targetDateReturn}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetDateReturn: event.target.value }))
                  }
                  disabled={!canCreate}
                  className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-amber-500/30 disabled:opacity-40"
                />
              </div>

              <textarea
                value={form.remarks}
                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                disabled={!canCreate}
                placeholder="Remarks (Header)"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-500/30 disabled:opacity-40"
              />

              <div className="border-t border-white/[0.06] my-2 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-widest text-amber-500/80 font-medium">List Item ({form.items.length})</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({
                      ...current,
                      items: [...current.items, { itemName: "", quantity: "1", uom: "pcs", goodsConditionOut: "", estimatedCost: "" }]
                    }))}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                  >
                    + Tambah Item Vendor
                  </button>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {form.items.map((item, index) => (
                    <div key={index} className="relative rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/50">Item #{index + 1}</span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({
                              ...current,
                              items: current.items.filter((_, idx) => idx !== index)
                            }))}
                            className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-medium"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      <input
                        value={item.itemName}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], itemName: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Item / Pekerjaan Vendor"
                        className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
                      />

                      <div className="grid gap-2 grid-cols-2">
                        <input
                          value={item.quantity}
                          onChange={(event) => {
                            const val = event.target.value;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], quantity: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          placeholder="Qty"
                          className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
                        />
                        <input
                          value={item.uom}
                          onChange={(event) => {
                            const val = event.target.value;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], uom: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          placeholder="UOM"
                          className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
                        />
                      </div>

                      <input
                        value={item.estimatedCost}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], estimatedCost: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Estimasi biaya per item (optional)"
                        className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
                      />

                      <textarea
                        value={item.goodsConditionOut}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], goodsConditionOut: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Kondisi barang keluar..."
                        className="w-full min-h-16 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-amber-500/30"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {message ? (
                <p className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-200">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-2xl border border-red-500/15 bg-red-500/[0.08] px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  !canCreate ||
                  isCreating ||
                  !form.carId ||
                  !form.vendorName.trim() ||
                  !form.targetDateReturn ||
                  form.items.some((it) => !it.itemName.trim() || !it.quantity.trim() || !it.uom.trim())
                }
                onClick={() => {
                  void handleCreate();
                }}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-40"
              >
                {isCreating ? "Menyimpan..." : "Buat Vendor WO"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <SmartDataGrid
        title="Vendor WO List"
        description="Server-side SmartDataGrid untuk monitoring WOV, approval, aging, dan status receive."
        columns={columns}
        rows={rows as unknown as Array<Record<string, string | number | boolean | null>>}
        meta={meta}
        state={state}
        searchPlaceholder="Cari WOV, unit, vendor, item, atau divisi..."
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        emptyMessage="Belum ada Vendor WO yang cocok dengan query saat ini."
      />
    </div>
  );
}
