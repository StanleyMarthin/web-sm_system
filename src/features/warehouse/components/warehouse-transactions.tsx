"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Calendar, Download, Image as ImageIcon, Loader2, RefreshCcw, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { SERIF_STYLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  getLocations,
  getPendingApprovals,
  getTransactions,
  updateWarehouseTransaction,
  uploadWarehousePhoto,
  type WarehouseUpdateAction,
} from "@/features/warehouse/services/warehouse-service";
import {
  canApproveWarehouseStage,
  canOperateWarehouse,
  isWarehouseApproverOnly,
} from "@/features/warehouse/services/warehouse-access";
import type { WhtApprovalStatus, WhtItemCategory, WhtLocation, WhtTransaction, WhtView } from "@/types";

const VIEW_TABS: { label: string; value: WhtView }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Siap Diambil", value: "READY" },
  { label: "Di Lapangan", value: "FIELD" },
  { label: "Overdue", value: "OVERDUE" },
];

const APPROVAL_FILTERS: { label: string; value: WhtApprovalStatus | "ALL" }[] = [
  { label: "Semua Approval", value: "ALL" },
  { label: "Menunggu KD", value: "PENDING_KD" },
  { label: "Menunggu Kepala Gudang", value: "PENDING_KEPALA_GUDANG" },
  { label: "Menunggu PPIC", value: "PENDING_PPIC" },
  { label: "Disetujui", value: "APPROVED" },
  { label: "Ditolak", value: "REJECTED" },
];

const CATEGORY_FILTERS: { label: string; value: WhtItemCategory | "ALL" }[] = [
  { label: "Semua Kategori", value: "ALL" },
  { label: "Tools", value: "TOOLS" },
  { label: "Bahan", value: "BAHAN" },
  { label: "Spare Part", value: "SPARE_PART" },
  { label: "Consumable", value: "CONSUMABLE" },
];

const TRANSACTION_FILTERS: { label: string; value: WhtTransaction["transactionType"] | "ALL" }[] = [
  { label: "Semua Transaksi", value: "ALL" },
  { label: "Peminjaman", value: "PEMINJAMAN" },
  { label: "Pengambilan", value: "PENGAMBILAN" },
  { label: "Pengembalian", value: "PENGEMBALIAN" },
  { label: "Penyimpanan", value: "PENYIMPANAN" },
];

type ActionDialogState = {
  action: WarehouseUpdateAction;
  item: WhtTransaction;
} | null;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function exportToCsv(filename: string, rows: WhtTransaction[]) {
  const headers = [
    "No Ref",
    "Tipe",
    "Kategori",
    "Barang",
    "Qty",
    "Peminta",
    "Divisi",
    "Unit",
    "Jobdesc",
    "Tgl Request",
    "Approval",
    "Status",
  ];

  const csvRows = rows.map((row) => [
    row.id,
    row.transactionType,
    row.itemCategory,
    row.itemName,
    String(row.qty),
    row.requester,
    row.division,
    row.unitName ?? "",
    row.jobdesc ?? "",
    row.requestDate,
    row.approvalStatus,
    row.itemStatus,
  ]);

  const content = [headers, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function approvalBadge(status: WhtApprovalStatus) {
  const labelMap: Record<WhtApprovalStatus, string> = {
    PENDING_KD: "Menunggu KD",
    PENDING_KEPALA_GUDANG: "Menunggu Kepala Gudang",
    PENDING_PPIC: "Menunggu PPIC",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  const toneMap: Record<WhtApprovalStatus, string> = {
    PENDING_KD: "bg-amber-500/10 text-amber-400",
    PENDING_KEPALA_GUDANG: "bg-orange-500/10 text-orange-400",
    PENDING_PPIC: "bg-violet-500/10 text-violet-400",
    APPROVED: "bg-emerald-500/10 text-emerald-400",
    REJECTED: "bg-red-500/10 text-red-400",
  };
  return <Badge className={cn("border-0 text-[10px]", toneMap[status])}>{labelMap[status]}</Badge>;
}

function itemStatusBadge(item: WhtTransaction) {
  const labelMap: Record<WhtTransaction["itemStatus"], string> = {
    OPEN: item.approvalStatus === "APPROVED" ? "Menunggu Gudang" : "Menunggu Persetujuan",
    READY: "Siap Diambil",
    RELEASED: "Di Lapangan",
    RETURNED: "Sudah Kembali",
    STORED: "Tersimpan",
    LOST: "Hilang",
  };
  const toneMap: Record<WhtTransaction["itemStatus"], string> = {
    OPEN: item.approvalStatus === "APPROVED" ? "bg-slate-500/10 text-slate-300" : "bg-white/[0.06] text-white/45",
    READY: "bg-blue-500/10 text-blue-400",
    RELEASED: "bg-amber-500/10 text-amber-400",
    RETURNED: "bg-emerald-500/10 text-emerald-400",
    STORED: "bg-cyan-500/10 text-cyan-400",
    LOST: "bg-red-500/10 text-red-400",
  };
  return <Badge className={cn("border-0 text-[10px]", toneMap[item.itemStatus])}>{labelMap[item.itemStatus]}</Badge>;
}

function typeBadge(type: WhtTransaction["transactionType"]) {
  const labelMap: Record<WhtTransaction["transactionType"], string> = {
    PEMINJAMAN: "Peminjaman",
    PENGAMBILAN: "Pengambilan",
    PENGEMBALIAN: "Pengembalian",
    PENYIMPANAN: "Penyimpanan",
  };
  return (
    <span className="inline-flex rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-white/60">
      {labelMap[type]}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
        tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:border-amber-500/30 hover:text-amber-400",
      )}
    >
      {label}
    </button>
  );
}

function WarehouseActionDialog({
  state,
  locations,
  userId,
  onClose,
  onDone,
}: {
  state: ActionDialogState;
  locations: WhtLocation[];
  userId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [qtyReturned, setQtyReturned] = useState("");
  const [itemCondition, setItemCondition] = useState("BAIK");
  const [storageLocationId, setStorageLocationId] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) {
      return;
    }
    setNotes("");
    setQtyReturned(state.item.qty ? String(state.item.qty) : "");
    setItemCondition(state.item.itemCondition ?? "BAIK");
    setStorageLocationId(state.item.storageLocationId ? String(state.item.storageLocationId) : "");
    setLocationDetail(state.item.locationDetail ?? "");
    setPhoto(null);
  }, [state]);

  if (!state) {
    return null;
  }

  const dialog = state;

  const titleMap: Record<WarehouseUpdateAction, string> = {
    approve: "Setujui Request",
    reject: "Tolak Request",
    ready: "Siapkan Barang",
    release: "Konfirmasi Pengambilan",
    return: "Terima Pengembalian",
    store: "Simpan ke Gudang",
    locate: "Assign Lokasi Rak",
  };

  const submitLabelMap: Record<WarehouseUpdateAction, string> = {
    approve: "Setujui",
    reject: "Tolak",
    ready: "Tandai Siap",
    release: "Konfirmasi",
    return: "Simpan Pengembalian",
    store: "Simpan",
    locate: "Simpan Lokasi",
  };

  const needsLocation = state.action === "ready" || state.action === "store" || state.action === "locate";
  const needsReturnFields = state.action === "return";
  const needsReason = state.action === "reject";

  async function handleSubmit() {
    if (needsReason && !notes.trim()) {
      alert("Catatan penolakan wajib diisi.");
      return;
    }
    if (needsLocation && !storageLocationId && !locationDetail.trim()) {
      alert("Lokasi rak atau detail lokasi wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const photoUrls: string[] = [];
      if (dialog.action === "ready" && photo) {
        const uploaded = await uploadWarehousePhoto(photo);
        if (!uploaded) {
          alert("Upload foto gagal.");
          setSaving(false);
          return;
        }
        photoUrls.push(uploaded);
      }

      const ok = await updateWarehouseTransaction({
        action: dialog.action,
        userId,
        logId: dialog.item.id,
        approved: dialog.action === "approve" ? true : dialog.action === "reject" ? false : undefined,
        notes: notes.trim() || undefined,
        qtyReturned: needsReturnFields ? Number(qtyReturned || 0) : undefined,
        itemCondition: needsReturnFields ? itemCondition : undefined,
        storageLocationId: storageLocationId ? Number(storageLocationId) : undefined,
        locationDetail: locationDetail.trim() || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });

      if (!ok) {
        alert("Aksi gagal diproses.");
        return;
      }

      await onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-white/90">{titleMap[state.action]}</h3>
            <p className="mt-1 text-[11px] text-white/35">{dialog.item.itemName}</p>
          </div>
          <button onClick={onClose} className="text-white/35 transition-colors hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {(state.action === "approve" || state.action === "release") && (
            <p className="text-xs text-white/60">
              Pastikan barang dan data request sudah sesuai sebelum melanjutkan.
            </p>
          )}

          {needsLocation && (
            <>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Lokasi Rak
                </label>
                <select
                  value={storageLocationId}
                  onChange={(event) => setStorageLocationId(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none focus:border-amber-500/40"
                >
                  <option value="">Pilih lokasi</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Detail Lokasi
                </label>
                <input
                  value={locationDetail}
                  onChange={(event) => setLocationDetail(event.target.value)}
                  placeholder="Contoh: Rak A3 sisi kiri"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none focus:border-amber-500/40"
                />
              </div>
            </>
          )}

          {state.action === "ready" && (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Foto Barang (Opsional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/60"
              />
            </div>
          )}

          {needsReturnFields && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Qty Kembali
                </label>
                <input
                  type="number"
                  min="0"
                  value={qtyReturned}
                  onChange={(event) => setQtyReturned(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none focus:border-amber-500/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Kondisi Barang
                </label>
                <select
                  value={itemCondition}
                  onChange={(event) => setItemCondition(event.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none focus:border-amber-500/40"
                >
                  <option value="BAIK">Baik</option>
                  <option value="RUSAK_RINGAN">Rusak Ringan</option>
                  <option value="RUSAK_BERAT">Rusak Berat</option>
                  <option value="HILANG">Hilang</option>
                </select>
              </div>
            </div>
          )}

          {(state.action === "reject" || state.action === "return") && (
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder={state.action === "reject" ? "Alasan penolakan" : "Catatan tambahan"}
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none focus:border-amber-500/40"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-white/45 transition-colors hover:border-white/[0.16] hover:text-white/75"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {saving ? "Memproses..." : submitLabelMap[state.action]}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WarehouseTransactions() {
  const user = useAuthStore((state) => state.user);
  const currentRole = user?.role;
  const approverOnly = isWarehouseApproverOnly(user?.role);
  const canOperate = canOperateWarehouse(user?.role);

  const [activeView, setActiveView] = useState<WhtView>("ALL");
  const [approvalFilter, setApprovalFilter] = useState<WhtApprovalStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<WhtItemCategory | "ALL">("ALL");
  const [transactionFilter, setTransactionFilter] = useState<WhtTransaction["transactionType"] | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<ActionDialogState>(null);

  const { data, isLoading, error, mutate } = useSWR(
    user
      ? [
          "warehouse-transactions",
          user.userId,
          approverOnly ? "approvals" : activeView,
          approvalFilter,
          categoryFilter,
          transactionFilter,
        ]
      : null,
    async () => {
      if (approverOnly) {
        return getPendingApprovals({ userId: user!.userId });
      }
      return getTransactions({
        userId: user!.userId,
        view: activeView,
        approvalStatus: approvalFilter,
        itemCategory: categoryFilter === "ALL" ? undefined : categoryFilter,
        transactionType: transactionFilter === "ALL" ? undefined : transactionFilter,
        limit: 300,
      });
    },
    { revalidateOnFocus: false },
  );

  const { data: locations = [] } = useSWR(
    canOperate ? ["warehouse-locations", user?.userId] : null,
    () => getLocations({ isActive: true }),
    { revalidateOnFocus: false },
  );

  const rows = useMemo(() => {
    let items = data ?? [];

    if (!approverOnly && dateFilter) {
      items = items.filter((item) => item.requestDate.startsWith(dateFilter));
    }

    return items;
  }, [approverOnly, data, dateFilter]);

  const columns = useMemo<DataTableColumn<WhtTransaction>[]>(() => {
    const baseColumns: DataTableColumn<WhtTransaction>[] = [
      {
        key: "id",
        label: "No Ref",
        sortable: true,
        sortValue: (row) => row.id,
        render: (row) => <span className="font-mono text-[10px] text-white/35">{row.id.slice(0, 8)}</span>,
      },
      {
        key: "type",
        label: "Jenis",
        render: (row) => typeBadge(row.transactionType),
      },
      {
        key: "item",
        label: "Barang",
        sortable: true,
        sortValue: (row) => row.itemName,
        render: (row) => (
          <div>
            <p className="text-[12px] font-medium text-white/85">{row.itemName}</p>
            <p className="text-[10px] text-white/30">
              {row.qty} {row.uom} · {row.itemCategory.replace("_", " ")}
            </p>
          </div>
        ),
      },
      {
        key: "requester",
        label: "Peminta",
        sortable: true,
        sortValue: (row) => row.requester,
        render: (row) => (
          <div>
            <p className="text-[12px] text-white/70">{row.requester}</p>
            <p className="text-[10px] text-white/30">{row.division}</p>
          </div>
        ),
      },
      {
        key: "unit",
        label: "Unit / Jobdesc",
        render: (row) => (
          <div>
            <p className="text-[11px] text-white/65">{row.unitName ?? "—"}</p>
            <p className="text-[10px] text-white/30">{row.jobdesc ?? "—"}</p>
          </div>
        ),
      },
      {
        key: "requestDate",
        label: "Tanggal",
        sortable: true,
        sortValue: (row) => row.requestDate,
        render: (row) => (
          <div className="space-y-1">
            <p className="text-[11px] text-white/55">{formatDate(row.requestDate)}</p>
            <p className="text-[10px] text-white/28">
              Deadline: {row.deadlineDate ? formatDate(row.deadlineDate) : "—"}
            </p>
          </div>
        ),
      },
      {
        key: "approval",
        label: "Approval",
        sortable: true,
        sortValue: (row) => row.approvalStatus,
        render: (row) => approvalBadge(row.approvalStatus),
      },
    ];

    if (!approverOnly) {
      baseColumns.push({
        key: "status",
        label: "Status Gudang",
        sortable: true,
        sortValue: (row) => row.itemStatus,
        render: (row) => (
          <div className="space-y-1">
            {itemStatusBadge(row)}
            {(row.daysOverdue ?? 0) > 0 && (
              <p className="text-[10px] text-red-400">Overdue +{row.daysOverdue} hari</p>
            )}
          </div>
        ),
      });
    }

    baseColumns.push({
      key: "photo",
      label: "Foto",
      align: "center",
      render: (row) => (
        <button
          type="button"
          disabled={!row.photoUrls[0]}
          onClick={() => row.photoUrls[0] && setPreviewImage(row.photoUrls[0])}
          className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/30 transition-colors disabled:cursor-default disabled:opacity-50"
          title={row.photoUrls[0] ? "Lihat foto" : "Tidak ada foto"}
        >
          {row.photoUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.photoUrls[0]} alt={row.itemName} className="h-full w-full rounded-lg object-cover" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
        </button>
      ),
    });

    baseColumns.push({
      key: "actions",
      label: "Aksi",
      render: (row) => {
        const actions: React.ReactNode[] = [];

        if (canApproveWarehouseStage(currentRole, row.approvalStatus)) {
          actions.push(
            <ActionButton key="approve" label="Setujui" onClick={() => setDialogState({ action: "approve", item: row })} />,
            <ActionButton
              key="reject"
              label="Tolak"
              tone="danger"
              onClick={() => setDialogState({ action: "reject", item: row })}
            />,
          );
        }

        if (canOperate) {
          if (row.approvalStatus === "APPROVED" && row.itemStatus === "OPEN" && row.transactionType !== "PENYIMPANAN") {
            actions.push(
              <ActionButton key="ready" label="Siapkan" onClick={() => setDialogState({ action: "ready", item: row })} />,
            );
          }
          if (row.itemStatus === "READY") {
            actions.push(
              <ActionButton
                key="release"
                label="Serahkan"
                onClick={() => setDialogState({ action: "release", item: row })}
              />,
            );
          }
          if (row.itemStatus === "RELEASED") {
            actions.push(
              <ActionButton
                key="return"
                label="Terima Kembali"
                onClick={() => setDialogState({ action: "return", item: row })}
              />,
            );
          }
          if (row.itemStatus === "RETURNED" && row.itemCategory === "TOOLS") {
            actions.push(
              <ActionButton key="store" label="Simpan" onClick={() => setDialogState({ action: "store", item: row })} />,
            );
          }
          if (row.itemStatus === "STORED" && row.transactionType === "PENYIMPANAN") {
            actions.push(
              <ActionButton
                key="locate"
                label="Assign Rak"
                onClick={() => setDialogState({ action: "locate", item: row })}
              />,
            );
          }
        }

        if (actions.length === 0) {
          return <span className="text-[10px] text-white/25">Tidak ada aksi</span>;
        }

        return <div className="flex flex-wrap gap-1.5">{actions}</div>;
      },
    });

    return baseColumns;
  }, [approverOnly, canOperate, currentRole]);

  const approvalCounts = useMemo(() => {
    return rows.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.approvalStatus] = (accumulator[row.approvalStatus] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-light tracking-wide text-white/90" style={SERIF_STYLE}>
            {approverOnly ? "Persetujuan Gudang" : "Transaksi Gudang"}
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
            {approverOnly
              ? `${rows.length} request menunggu persetujuan`
              : `${rows.length} transaksi sesuai filter`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] text-white/55 transition-colors hover:text-white/80"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={() => exportToCsv(`warehouse-${approverOnly ? "approval" : activeView.toLowerCase()}`, rows)}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {approverOnly ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Menunggu KD</p>
            <p className="mt-3 text-3xl font-light text-white/90 tabular-nums" style={SERIF_STYLE}>
              {approvalCounts.PENDING_KD ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Menunggu Kepala Gudang</p>
            <p className="mt-3 text-3xl font-light text-white/90 tabular-nums" style={SERIF_STYLE}>
              {approvalCounts.PENDING_KEPALA_GUDANG ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Menunggu PPIC</p>
            <p className="mt-3 text-3xl font-light text-white/90 tabular-nums" style={SERIF_STYLE}>
              {approvalCounts.PENDING_PPIC ?? 0}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveView(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-[11px] font-medium transition-colors",
                  activeView === tab.value ? "bg-amber-500/15 text-amber-400" : "text-white/35 hover:text-white/65",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
            <select
              value={approvalFilter}
              onChange={(event) => setApprovalFilter(event.target.value as WhtApprovalStatus | "ALL")}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none"
            >
              {APPROVAL_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as WhtItemCategory | "ALL")}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none"
            >
              {CATEGORY_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={transactionFilter}
              onChange={(event) => setTransactionFilter(event.target.value as WhtTransaction["transactionType"] | "ALL")}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/75 outline-none"
            >
              {TRANSACTION_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-white/35" />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full bg-transparent text-xs text-white/75 outline-none"
                style={{ colorScheme: "dark" }}
              />
              {dateFilter && (
                <button onClick={() => setDateFilter("")} className="text-[10px] text-white/35 hover:text-red-400">
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500/50" />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-400/70">Gagal memuat transaksi gudang.</p>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.id}
          searchable
          searchPlaceholder="Cari barang, peminta, divisi, unit, jobdesc..."
          searchFn={(row, query) =>
            row.itemName.toLowerCase().includes(query) ||
            row.requester.toLowerCase().includes(query) ||
            row.division.toLowerCase().includes(query) ||
            row.id.toLowerCase().includes(query) ||
            (row.unitName ?? "").toLowerCase().includes(query) ||
            (row.jobdesc ?? "").toLowerCase().includes(query)
          }
          emptyMessage={approverOnly ? "Tidak ada request yang menunggu persetujuan." : "Tidak ada transaksi yang sesuai filter."}
        />
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-4xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Preview" className="max-h-[85vh] max-w-full rounded-lg border border-white/[0.08] object-contain" />
          </div>
        </div>
      )}

      {user && dialogState && (
        <WarehouseActionDialog
          state={dialogState}
          locations={locations}
          userId={user.userId}
          onClose={() => setDialogState(null)}
          onDone={async () => {
            await mutate();
          }}
        />
      )}
    </div>
  );
}
