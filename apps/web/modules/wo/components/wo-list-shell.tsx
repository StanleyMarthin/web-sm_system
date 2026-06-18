"use client";

import type {
  WoGridQuery,
  WoGridReference,
  WoRecord,
} from "@smsystem/contracts/wo";
import type { GridFilter } from "@smsystem/contracts/grid";
import { AlertTriangle, ClipboardPlus, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createWo } from "@/shared/api/wo";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridSavedView,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";

interface WoListShellProps {
  rows: WoRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: WoGridQuery;
  references: WoGridReference;
  summary: {
    pendingApproval: number;
    approvedOpen: number;
    urgentCount: number;
  };
  urgentRows: WoRecord[];
  canCreate: boolean;
}

interface WoItemState {
  jobDetail: string;
  panelName: string;
  panelCategory: string;
  addPanelToMaster: boolean;
  estimatedHours: string;
  notes: string;
}

interface WoFormState {
  carId: string;
  toDivisionId: string;
  requestDate: string;
  isPriority: boolean;
  items: WoItemState[];
}

function getTodayIsoDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function emptyForm(): WoFormState {
  return {
    carId: "",
    toDivisionId: "",
    requestDate: getTodayIsoDate(),
    isPriority: false,
    items: [
      {
        jobDetail: "",
        panelName: "",
        panelCategory: "",
        addPanelToMaster: false,
        estimatedHours: "",
        notes: "",
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
    <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-gray-950 dark:text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-gray-400 dark:text-white/40">{helper}</p> : null}
    </div>
  );
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal Permintaan", value: "requestDate" },
  { label: "Status", value: "status" },
  { label: "Unit", value: "unitName" },
  { label: "Dari Divisi", value: "fromDivisionName" },
  { label: "Ke Divisi", value: "toDivisionName" },
  { label: "Estimasi", value: "estimatedHours" },
  { label: "Aging", value: "agingHours" },
  { label: "Risiko", value: "agingScore" },
  { label: "Dibuat", value: "createdAt" },
];

const savedViews: SmartDataGridSavedView[] = [
  {
    id: "active-wo",
    label: "Aktif",
    sortBy: "requestDate",
    sortDirection: "desc",
    filters: [],
  },
  {
    id: "pending-approval",
    label: "Menunggu",
    sortBy: "requestDate",
    sortDirection: "desc",
    filters: [
      {
        field: "status",
        operator: "eq",
        value: "SUBMITTED",
      } satisfies GridFilter,
    ],
  },
  {
    id: "done-wo",
    label: "Selesai",
    sortBy: "requestDate",
    sortDirection: "desc",
    search: "",
    filters: [],
  },
];

const columns: SmartDataGridColumn[] = [
  {
    key: "woNumber",
    label: "WO",
    kind: "mono",
    sticky: true,
    renderCell: (value, row) => (
      <Link
        href={`/wo/${String(row.woId)}`}
        className="text-amber-400 transition-colors hover:text-amber-300"
      >
        {String(value)}
      </Link>
    ),
  },
  { key: "unitName", label: "Unit" },
  { key: "fromDivisionName", label: "Dari" },
  { key: "toDivisionName", label: "Ke" },
  { key: "jobDetail", label: "Pekerjaan" },
  { key: "status", label: "Status", kind: "status" },
  { key: "requestDate", label: "Tanggal" },
  { key: "agingHours", label: "Aging", kind: "number", align: "right" },
  { key: "agingScore", label: "Risk", kind: "number", align: "right" },
  {
    key: "priority",
    label: "Prioritas",
    renderCell: (_value, row) => (
      <span className={String(row.isPriority) === "true" ? "font-mono text-red-300" : "font-mono text-gray-500 dark:text-white/35"}>
        {String(row.isPriority) === "true" ? "Tinggi" : "Normal"}
      </span>
    ),
  },
  {
    key: "linkedCountdownId",
    label: "Countdown Terkait",
    kind: "mono",
  },
];

export function WoListShell({
  rows,
  meta,
  state,
  references,
  summary,
  urgentRows,
  canCreate,
}: WoListShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<WoFormState>(emptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filters: SmartDataGridFilterDefinition[] = useMemo(
    () => [
      {
        field: "status",
        label: "Status",
        options: references.statuses,
      },
      {
        field: "carId",
        label: "Unit",
        options: references.units,
      },
      {
        field: "fromDivisionId",
        label: "Divisi Asal",
        options: references.divisions,
      },
      {
        field: "toDivisionId",
        label: "Divisi Tujuan",
        options: references.divisions,
      },
      {
        field: "isPriority",
        label: "Prioritas",
        options: [
          { label: "Tinggi", value: "1" },
          { label: "Normal", value: "0" },
        ],
      },
    ],
    [references.divisions, references.statuses, references.units],
  );

  function pushViewMode(value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("viewMode", value);
    nextParams.set("page", "1");
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  async function handleCreate() {
    setMessage(null);
    setError(null);
    setIsCreating(true);

    try {
      const result = await createWo({
        carId: form.carId,
        toDivisionId: Number(form.toDivisionId),
        requestDate: form.requestDate,
        isPriority: form.isPriority,
        panelName: null,
        jobDetail: null,
        estimatedHours: null,
        notes: null,
        items: form.items.map((item) => ({
          jobDetail: item.jobDetail.trim(),
          panelName: item.panelName.trim() || null,
          sectionName: item.panelName.trim() || null,
          panelCategory: item.panelCategory.trim() || null,
          addPanelToMaster: item.addPanelToMaster,
          estimatedHours: item.estimatedHours ? Number(item.estimatedHours) : null,
          notes: item.notes.trim() || null,
        })),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage("WO berhasil dibuat.");
      setForm(emptyForm());
      router.push(`/wo/${result.result.woId}`);
      router.refresh();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="grid gap-2 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
        <SummaryCard
          label="Menunggu Persetujuan"
          value={String(summary.pendingApproval)}
          helper="WO yang masih menunggu approval."
        />
        <SummaryCard
          label="Disetujui Belum Selesai"
          value={String(summary.approvedOpen)}
          helper="WO approved yang belum selesai."
        />
        <SummaryCard
          label="Prioritas Tinggi"
          value={String(summary.urgentCount)}
          helper="Prioritas tinggi atau aging risk yang mulai naik."
        />
      </section>

      <section className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border border-gray-300 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0a0a0c]">
                <ClipboardPlus className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  WO Ticket
                </p>
                <h3 className="mt-1 text-[13px] font-medium text-gray-950 dark:text-white">
                  Cross-division work order dan urgent board
                </h3>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-gray-600 dark:text-white/45">
              WO tetap tiket berbasis tabel existing. Countdown terkait dibaca lewat relasi
              `ref_taks_id`, bukan kolom baru.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={state.viewMode}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  pushViewMode(nextValue);
                });
              }}
              className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none transition-colors focus:border-amber-500/30"
            >
              <option value="active">Aktif</option>
              <option value="done">Selesai</option>
              <option value="all">Semua</option>
            </select>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex h-8 items-center gap-2 border border-gray-300 dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/55 hover:text-gray-900 dark:text-white/80"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {isPending ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="overflow-hidden border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114]">
            <div className="flex items-center gap-3 border-b border-gray-300 dark:border-white/[0.06] px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
                  Urgent WO Board
                </p>
                <p className="text-[11px] text-gray-400 dark:text-white/40">
                  Tiket dengan priority tinggi atau aging risk tinggi.
                </p>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {urgentRows.length === 0 ? (
                <div className="px-4 py-6 text-[11px] text-gray-500 dark:text-white/35">
                  Belum ada urgent WO untuk scope aktif.
                </div>
              ) : (
                urgentRows.map((row) => (
                  <Link
                    key={row.woId}
                    href={`/wo/${row.woId}`}
                    className="grid grid-cols-[1fr_0.9fr_0.5fr_0.5fr] gap-3 border-b border-white/[0.04] px-3 py-2 text-[12px] text-gray-800 dark:text-white/75 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.02] last:border-b-0"
                  >
                    <div>
                      <p className="font-mono text-[11px] text-amber-400">{row.woNumber}</p>
                      <p className="mt-1">{row.unitName}</p>
                    </div>
                    <div>
                      <p>{row.toDivisionName}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/35">{row.status}</p>
                    </div>
                    <div className="text-right font-mono tabular-nums">{row.agingHours}</div>
                    <div className="text-right font-mono tabular-nums text-red-300">{row.agingScore}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              Create WO
            </p>
            <p className="mt-2 text-[11px] text-gray-600 dark:text-white/45">
              Form ini menulis ke `sm_jobdesc_wo` tanpa menambah kolom baru.
            </p>

            <div className="mt-3 space-y-2.5">
              <select
                value={form.carId}
                onChange={(event) =>
                  setForm((currentValue) => ({ ...currentValue, carId: event.target.value }))
                }
                disabled={!canCreate}
                className="h-8 w-full border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none transition-colors focus:border-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Pilih Unit</option>
                {references.units.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={form.toDivisionId}
                onChange={(event) =>
                  setForm((currentValue) => ({ ...currentValue, toDivisionId: event.target.value }))
                }
                disabled={!canCreate}
                className="h-8 w-full border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none transition-colors focus:border-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Pilih Divisi Tujuan</option>
                {references.divisions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="pl-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">Tanggal WO</span>
                  <input
                    type="date"
                    value={form.requestDate}
                    onChange={(event) =>
                      setForm((currentValue) => ({ ...currentValue, requestDate: event.target.value }))
                    }
                    disabled={!canCreate}
                    className="h-8 w-full border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none transition-colors focus:border-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1 justify-end pb-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/65">
                    <input
                      type="checkbox"
                      checked={form.isPriority}
                      onChange={(event) =>
                        setForm((currentValue) => ({ ...currentValue, isPriority: event.target.checked }))
                      }
                      disabled={!canCreate}
                      className="h-4 w-4 border-white/20 bg-transparent text-amber-500 focus:ring-0"
                    />
                    Prioritas tinggi
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-300 dark:border-white/[0.06] my-2 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">List Pekerjaan ({form.items.length})</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({
                      ...current,
                      items: [...current.items, { jobDetail: "", panelName: "", panelCategory: "", addPanelToMaster: false, estimatedHours: "", notes: "" }]
                    }))}
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-400 transition-colors hover:text-amber-300"
                  >
                    + Tambah Pekerjaan
                  </button>
                </div>

                <div className="max-h-[350px] space-y-3 overflow-y-auto pr-1">
                  {form.items.map((item, index) => (
                    <div key={index} className="relative space-y-2 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/40">Pekerjaan #{index + 1}</span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({
                              ...current,
                              items: current.items.filter((_, idx) => idx !== index)
                            }))}
                            className="font-mono text-[10px] uppercase tracking-[0.12em] text-red-400 transition-colors hover:text-red-300"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      <input
                        value={item.panelName}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], panelName: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Nama Panel / Section"
                        className="h-8 w-full border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2.5 text-[11px] text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20 focus:border-amber-500/30"
                      />

                      <div className="grid gap-2 grid-cols-2">
                        <input
                          value={item.panelCategory}
                          onChange={(event) => {
                            const val = event.target.value;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], panelCategory: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          placeholder="Kategori Panel (e.g. BODY)"
                          className="h-8 border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[11px] text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20 focus:border-amber-500/30"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={item.estimatedHours}
                          onChange={(event) => {
                            const val = event.target.value;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], estimatedHours: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          placeholder="Estimasi Jam"
                          className="h-8 border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[11px] text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20 focus:border-amber-500/30"
                        />
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 pl-1 text-[11px] text-gray-500 dark:text-white/50">
                        <input
                          type="checkbox"
                          checked={item.addPanelToMaster}
                          onChange={(event) => {
                            const val = event.target.checked;
                            setForm((current) => {
                              const newItems = [...current.items];
                              newItems[index] = { ...newItems[index], addPanelToMaster: val };
                              return { ...current, items: newItems };
                            });
                          }}
                          disabled={!canCreate}
                          className="h-3.5 w-3.5 border-white/20 bg-transparent text-amber-500 focus:ring-0"
                        />
                        Tambahkan Panel ke Master
                      </label>

                      <textarea
                        value={item.jobDetail}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], jobDetail: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Detail pekerjaan..."
                        className="min-h-16 w-full border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2.5 py-2 text-[11px] text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20 focus:border-amber-500/30"
                      />

                      <textarea
                        value={item.notes}
                        onChange={(event) => {
                          const val = event.target.value;
                          setForm((current) => {
                            const newItems = [...current.items];
                            newItems[index] = { ...newItems[index], notes: val };
                            return { ...current, items: newItems };
                          });
                        }}
                        disabled={!canCreate}
                        placeholder="Catatan opsional item"
                        className="min-h-16 w-full border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2.5 py-2 text-[11px] text-gray-950 dark:text-white outline-none placeholder:text-gray-400 dark:text-white/20 focus:border-amber-500/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {message ? (
              <p className="mt-3 border border-emerald-500/30 px-3 py-2 text-[11px] text-emerald-300">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 border border-red-500/30 px-3 py-2 text-[11px] text-red-300">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={
                !canCreate ||
                isCreating ||
                !form.carId ||
                !form.toDivisionId ||
                form.items.some((it) => !it.jobDetail.trim())
              }
              onClick={() => {
                void handleCreate();
              }}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 border border-amber-500/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ClipboardPlus className="h-4 w-4" />
              {isCreating ? "Creating..." : "Buat WO"}
            </button>
          </div>
        </div>
      </section>

      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="WO Register"
        description="Server-side register untuk WO lintas divisi, approval status, aging, dan linked countdown."
        columns={columns}
        rows={rows.map((row) => ({
          woId: row.woId,
          woNumber: row.woNumber,
          unitName: row.unitName,
          fromDivisionName: row.fromDivisionName,
          toDivisionName: row.toDivisionName,
          jobDetail: row.jobDetail,
          status: row.status,
          requestDate: row.requestDate,
          agingHours: row.agingHours,
          agingScore: row.agingScore,
          isPriority: String(row.isPriority),
          linkedCountdownId: row.linkedCountdownId,
        }))}
        meta={meta}
        state={state}
        searchPlaceholder="Cari WO, unit, divisi, panel, atau pekerjaan..."
        filters={filters}
        sortOptions={sortOptions}
        savedViews={savedViews}
        emptyMessage="Belum ada WO untuk query ini."
      />
    </div>
  );
}
