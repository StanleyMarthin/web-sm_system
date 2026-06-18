"use client";

import type {
  PrGridQuery,
  PrGridReference,
  PrRecord,
} from "@smsystem/contracts/pr";
import type { GridFilter } from "@smsystem/contracts/grid";
import { AlertTriangle, PackageSearch, RefreshCcw, Loader2, UploadCloud, X, FileImage } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPr, requestPrUploadTicket } from "@/shared/api/pr";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

interface PrListShellProps {
  rows: PrRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: PrGridQuery;
  references: PrGridReference;
  summary: {
    pendingApproval: number;
    huntingCount: number;
    orderedCount: number;
    criticalCount: number;
  };
  criticalRows: PrRecord[];
  canCreate: boolean;
}

interface PrItemState {
  itemName: string;
  description: string;
  originType: "LOKAL" | "LN";
  qty: string;
  uom: string;
  estimatedPrice: string;
  photoUrl: string;
  isUploading?: boolean;
}

interface PrCreateFormState {
  carId: string;
  divisionName: string;
  targetDate: string;
  priority: string;
  notes: string;
  items: PrItemState[];
}

function emptyForm(): PrCreateFormState {
  return {
    carId: "",
    divisionName: "",
    targetDate: "",
    priority: "NORMAL",
    notes: "",
    items: [
      {
        itemName: "",
        description: "",
        originType: "LOKAL",
        qty: "1",
        uom: "pcs",
        estimatedPrice: "",
        photoUrl: "",
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
      <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">{label}</p>
      <p className="mt-3 text-lg text-foreground">{value}</p>
      {helper ? <p className="mt-2 text-sm text-foreground/40">{helper}</p> : null}
    </div>
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Dibuat", value: "createdAt" },
  { label: "Nomor PR", value: "prNumber" },
  { label: "Unit", value: "unitName" },
  { label: "Divisi", value: "divisionName" },
  { label: "Persetujuan", value: "accTracking" },
  { label: "Status", value: "status" },
  { label: "Jumlah Item", value: "totalItems" },
  { label: "Total Qty", value: "totalQty" },
  { label: "Aging", value: "agingDays" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "all-pr",
    label: "All",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [],
  },
  {
    id: "approval",
    label: "Approval",
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
    id: "hunting",
    label: "Hunting",
    sortBy: "createdAt",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "HUNTING",
      } satisfies GridFilter,
    ],
  },
];

const columns: SmartDataGridColumn[] = [
  {
    key: "prNumber",
    label: "PR",
    kind: "mono",
    sticky: true,
    renderCell: (value, row) => (
      <Link
        href={`/pr/${String(row.prId)}`}
        className="text-app-accent-ink transition-colors hover:text-app-accent-ink"
      >
        {String(value)}
      </Link>
    ),
  },
  { key: "unitName", label: "Unit" },
  { key: "divisionName", label: "Divisi" },
  { key: "requestedByName", label: "Requester" },
  { key: "accTracking", label: "Approval", kind: "status" },
  { key: "status", label: "Status", kind: "status" },
  { key: "totalItems", label: "Item", kind: "number", align: "right" },
  { key: "vendorSummary", label: "Vendor" },
  { key: "agingDays", label: "Aging", kind: "number", align: "right" },
  { key: "riskScore", label: "Risk", kind: "number", align: "right" },
];

export function PrListShell({
  rows,
  meta,
  state,
  references,
  summary,
  criticalRows,
  canCreate,
}: PrListShellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PrCreateFormState>(emptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleUploadFile(index: number, file: File) {
    if (!file) return;

    setForm((current) => {
      const newItems = [...current.items];
      newItems[index] = { ...newItems[index], isUploading: true };
      return { ...current, items: newItems };
    });

    try {
      const ticketResult = await requestPrUploadTicket({
        filename: file.name,
        contentType: file.type || "image/jpeg",
      });

      if (!ticketResult.success) {
        throw new Error(ticketResult.message || "Gagal mendapatkan tiket upload.");
      }

      const uploadResponse = await fetch(ticketResult.result.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/jpeg",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload ke penyimpanan gagal.");
      }

      setForm((current) => {
        const newItems = [...current.items];
        newItems[index] = {
          ...newItems[index],
          photoUrl: ticketResult.result.publicUrl,
          isUploading: false,
        };
        return { ...current, items: newItems };
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Gagal mengunggah foto.";
      alert(errMsg);
      setForm((current) => {
        const newItems = [...current.items];
        newItems[index] = { ...newItems[index], isUploading: false };
        return { ...current, items: newItems };
      });
    }
  }

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
      field: "divisionName",
      label: "Divisi",
      options: references.divisions,
    },
  ];

  async function handleCreate() {
    setMessage(null);
    setError(null);
    setIsCreating(true);

    try {
      const result = await createPr({
        carId: form.carId,
        divisionName: form.divisionName.trim() || null,
        targetDate: form.targetDate || null,
        priority: form.priority || "NORMAL",
        notes: form.notes.trim() || null,
        items: form.items.map((item) => ({
          itemName: item.itemName.trim(),
          description: item.description.trim() || null,
          originType: item.originType,
          qty: Number(item.qty),
          uom: item.uom.trim(),
          estimatedPrice: item.estimatedPrice ? Number(item.estimatedPrice) : null,
          photoUrl: item.photoUrl.trim() || null,
        })),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("PR berhasil dibuat.");
      setForm(emptyForm());
      router.push(`/pr/${result.result.prId}`);
      router.refresh();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        <SummaryCard
          label="Pending Approval"
          value={String(summary.pendingApproval)}
          helper="Header PR yang masih menunggu approval lane berikutnya."
        />
        <SummaryCard
          label="Hunting"
          value={String(summary.huntingCount)}
          helper="PR yang sudah approved dan sedang procurement."
        />
        <SummaryCard
          label="Ordered"
          value={String(summary.orderedCount)}
          helper="PR yang sudah locked vendor dan menunggu barang datang."
        />
        <SummaryCard
          label="Critical"
          value={String(summary.criticalCount)}
          helper="Aging tinggi atau masih tertahan di fase aktif."
        />
      </section>

      <section className="rounded-[28px] border border-white/[0.06] bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <PackageSearch className="h-5 w-5 text-app-accent-ink" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
                  Purchase Request
                </p>
                <h3 className="mt-1 text-lg font-medium text-foreground">
                  Intake PR, approval lane, hunting, dan receiving
                </h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground/45">
              Data PR dibaca dari `sms_purchase.pur_pr_header` dan `pur_pr_items`, dengan scope
              unit/divisi tetap mengikuti session aktif dan assignment user.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                router.refresh();
              });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-foreground/55 ring-1 ring-white/[0.06] hover:text-foreground/80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {isPending ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)]">
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Critical PR
            </p>
            {criticalRows.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/35">Belum ada PR critical di scope saat ini.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {criticalRows.slice(0, 4).map((row) => (
                  <Link
                    key={row.prId}
                    href={`/pr/${row.prId}`}
                    className="block rounded-2xl border border-destructive/15 bg-destructive/[0.07] px-4 py-3 transition-colors hover:border-destructive/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[12px] text-app-accent-ink">{row.prNumber}</p>
                        <p className="mt-1 text-sm text-foreground">{row.unitName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-foreground/35">
                          {row.accTracking} · {row.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        {row.riskScore}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-accent-ink/70">
              Create PR
            </p>
            <div className="mt-3 grid gap-3">
              <select
                value={form.carId}
                onChange={(event) => setForm((current) => ({ ...current, carId: event.target.value }))}
                disabled={!canCreate}
                className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30 disabled:opacity-40"
              >
                <option value="">Pilih Unit</option>
                {references.units.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-foreground/45 uppercase tracking-wider pl-1 font-medium">Target Date</span>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
                    disabled={!canCreate}
                    className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30 disabled:opacity-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-foreground/45 uppercase tracking-wider pl-1 font-medium">Prioritas</span>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                    disabled={!canCreate}
                    className="h-11 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-sm text-foreground outline-none focus:border-primary/30 disabled:opacity-40"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                disabled={!canCreate}
                placeholder="Catatan PR (Header)"
                className="min-h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30 disabled:opacity-40"
              />

              <div className="border-t border-white/[0.06] my-2 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-widest text-app-accent-ink/80 font-medium">List Item ({form.items.length})</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({
                      ...current,
                      items: [...current.items, { itemName: "", description: "", originType: "LOKAL", qty: "1", uom: "pcs", estimatedPrice: "", photoUrl: "" }]
                    }))}
                    className="text-xs text-app-accent-ink hover:text-app-accent-ink font-semibold transition-colors"
                  >
                    + Tambah Item
                  </button>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {form.items.map((item, index) => (
                    <div key={index} className="relative rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground/50">Item #{index + 1}</span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({
                              ...current,
                              items: current.items.filter((_, idx) => idx !== index)
                            }))}
                            className="text-[10px] text-destructive hover:text-destructive transition-colors font-medium"
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
                        placeholder="Nama barang"
                        className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                      />

                      <div className="grid gap-2 grid-cols-3">
                        <select
                          value={item.originType}
                          onChange={(event) => {
                            const val = event.target.value as "LOKAL" | "LN";
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], originType: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs text-foreground outline-none focus:border-primary/30"
                        >
                          <option value="LOKAL">LOKAL</option>
                          <option value="LN">LN</option>
                        </select>
                        <input
                          value={item.qty}
                          onChange={(event) => {
                            const val = event.target.value;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], qty: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          placeholder="Qty"
                          className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
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
                          className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                        />
                      </div>

                      <input
                        value={item.estimatedPrice}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], estimatedPrice: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Estimasi harga per item (optional)"
                        className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                      />

                      <div className="space-y-1.5">
                        {item.isUploading ? (
                          <div className="flex items-center justify-center w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-foreground/50">
                            <Loader2 className="h-4 w-4 animate-spin text-app-accent-ink mr-2" />
                            <span>Mengunggah foto...</span>
                          </div>
                        ) : item.photoUrl ? (
                          <div className="flex items-center justify-between w-full h-10 rounded-xl border border-primary/30 bg-primary/5 px-3 text-xs text-foreground">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={item.photoUrl}
                                alt="Item attachment"
                                className="w-6 h-6 rounded object-cover border border-white/10"
                              />
                              <span className="truncate text-foreground/70 max-w-[180px]">
                                {item.photoUrl.split("/").pop()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((current) => {
                                  const newItems = [...current.items];
                                  newItems[index] = { ...newItems[index], photoUrl: "" };
                                  return { ...current, items: newItems };
                                });
                              }}
                              className="text-foreground/40 hover:text-foreground transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative flex items-center justify-center w-full h-10 rounded-xl border border-dashed border-white/15 bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer group">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={!canCreate}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  handleUploadFile(index, file);
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex items-center gap-2 text-foreground/40 group-hover:text-foreground/70 transition-colors pointer-events-none">
                              <UploadCloud className="h-4 w-4" />
                              <span className="text-xs">Upload Foto Item (Optional)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <textarea
                        value={item.description}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], description: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Deskripsi item / catatan teknis"
                        className="w-full min-h-16 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-foreground outline-none placeholder:text-foreground/20 focus:border-primary/30"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {message ? (
                <p className="rounded-2xl border border-success/15 bg-success/[0.08] px-3 py-2 text-sm text-success">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-2xl border border-destructive/15 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                disabled={
                  !canCreate ||
                  isCreating ||
                  !form.carId ||
                  !form.targetDate ||
                  form.items.some((it) => !it.itemName.trim() || !it.qty.trim() || !it.uom.trim())
                }
                onClick={() => {
                  void handleCreate();
                }}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary disabled:opacity-40"
              >
                {isCreating ? "Menyimpan..." : "Buat PR"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="PR List"
        description="Server-side SmartDataGrid untuk monitoring header PR lintas approval, hunting, dan receiving."
        columns={columns}
        rows={rows as unknown as Array<Record<string, string | number | boolean | null>>}
        meta={meta}
        state={state}
        searchPlaceholder="Cari PR, unit, requester, vendor, atau item..."
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        emptyMessage="Belum ada PR yang cocok dengan query saat ini."
      />
    </div>
  );
}
