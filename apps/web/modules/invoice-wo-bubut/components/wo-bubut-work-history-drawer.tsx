"use client";

import type {
  BubutInvoiceSnapshot,
  BubutInvoiceType,
  BubutInvoiceWorkOrderRow,
  BubutInvoiceWorkHistory,
} from "@smsystem/contracts/bubut-invoice";
import { CameraOff, ExternalLink, Loader2, PackageX, Pencil, Printer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BubutInvoiceStatusBadge } from "@/modules/bubut-invoice/components/bubut-invoice-status-badge";
import { getProxiedImageUrl } from "@/shared/api/config";
import {
  fetchBubutInvoicePreview,
  fetchBubutInvoiceWorkHistory,
  getBubutInvoice,
  updateBubutInvoice,
  fetchBubutInvoiceWorkOrdersClient,
} from "@/shared/api/bubut-invoice";

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function text(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function statusToBadgeStatus(status: BubutInvoiceWorkHistory["header"]["invoiceStatus"]) {
  if (status === "BOTH_RELEASED") return "RILIS_KEDUANYA";
  if (status === "DIREKSI_RELEASED") return "RILIS_DIREKSI";
  if (status === "CUSTOMER_RELEASED") return "RILIS_CUSTOMER";
  return "BELUM_RILIS";
}

type BubutInvoiceSourceSnapshot = {
  selectedPictures?: {
    before?: string[];
    after?: string[];
  };
  mergedWoIds?: string[];
};

function asBubutInvoiceSourceSnapshot(value: BubutInvoiceSnapshot["sourceSnapshot"]): BubutInvoiceSourceSnapshot {
  return value;
}

function ResultBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span>-</span>;
  const s = status.toUpperCase();
  if (s === "DONE") return <span className="inline-flex border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-emerald-400">DONE</span>;
  if (s === "ON PROGRESS") return <span className="inline-flex border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-amber-400">ON PROGRESS</span>;
  return <span className="inline-flex border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-white/70">{s}</span>;
}

export function WoBubutWorkHistoryDrawer({
  sourceKey,
  canRelease,
  canPrint,
  onClose,
  onRelease,
  onEdit,
}: {
  sourceKey: string;
  canRelease: boolean;
  canPrint: boolean;
  onClose: () => void;
  onRelease: (sourceWoId: string, invoiceType: BubutInvoiceType) => void;
  onEdit?: (invoiceId: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"work" | "material" | "docs" | "summary">("work");
  const [data, setData] = useState<BubutInvoiceWorkHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit mode state
  type EditMode = { invoiceId: number; invoiceType: BubutInvoiceType } | null;
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editSalesDate, setEditSalesDate] = useState("");
  const [editPoNo, setEditPoNo] = useState("");
  const [editPoDate, setEditPoDate] = useState("");
  const [editPreview, setEditPreview] = useState<BubutInvoiceSnapshot | null>(null);
  const [editBeforeUrls, setEditBeforeUrls] = useState<string[]>([]);
  const [editAfterUrls, setEditAfterUrls] = useState<string[]>([]);
  const [editMergedWoIds, setEditMergedWoIds] = useState<string[]>([]);
  const [editMaterialOverrides, setEditMaterialOverrides] = useState<Array<{ materialName: string, qty: number, price: number }> | null>(null);
  const [mergeableWos, setMergeableWos] = useState<import("@smsystem/contracts/bubut-invoice").BubutInvoiceWorkOrderRow[]>([]);
  const [isLoadingWos, setIsLoadingWos] = useState(false);
  const [showWoPicker, setShowWoPicker] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      setData(null);
    });

    fetchBubutInvoiceWorkHistory(sourceKey)
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch(() => {
        if (isMounted) setError("Riwayat pengerjaan WO belum bisa dimuat.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sourceKey]);

  const documentationUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const row of data?.workRows ?? []) {
      for (const url of row.documentationUrls) urls.add(url);
    }
    return [...urls];
  }, [data]);

  // Load existing invoice when entering edit mode
  useEffect(() => {
    if (!editMode) return;
    let alive = true;
    getBubutInvoice(editMode.invoiceId)
      .then((inv) => {
        if (!alive || !inv) return;
        setEditSalesDate(inv.salesInvoiceDate);
        setEditPoNo(inv.poNo ?? "");
        setEditPoDate(inv.poDate ?? "");
        
        const snap = asBubutInvoiceSourceSnapshot(inv.sourceSnapshot);
        setEditBeforeUrls(snap.selectedPictures?.before ?? inv.pictures.filter(p => p.caption?.toUpperCase().includes("BEFORE")).map(p => p.url));
        setEditAfterUrls(snap.selectedPictures?.after ?? inv.pictures.filter(p => p.caption?.toUpperCase().includes("AFTER")).map(p => p.url));
        setEditMergedWoIds(snap.mergedWoIds ?? []);
        
        // Populate overrides from current invoice's materials
        const overrides = inv.materials.map(m => ({
          materialName: m.materialName,
          qty: m.qty,
          price: m.price
        }));
        setEditMaterialOverrides(overrides);
      })
      .catch(() => setEditError("Gagal memuat data invoice."));
    return () => { alive = false; };
  }, [editMode]);

  // Fetch preview for edit mode
  useEffect(() => {
    if (!editMode || !editSalesDate || !editMaterialOverrides) return;
    let alive = true;
    fetchBubutInvoicePreview({
      sourceWoId: data?.sourceKey ?? sourceKey,
      invoiceType: editMode.invoiceType,
      salesInvoiceDate: editSalesDate,
      poNo: editPoNo || null,
      poDate: editPoDate || null,
      roundingStep: 1000,
      mergedWoIds: editMergedWoIds,
      materialOverrides: editMaterialOverrides,
    })
      .then((p) => { if (alive) setEditPreview(p); })
      .catch(() => { if (alive) setEditError("Preview tidak bisa dimuat."); });
    return () => { alive = false; };
  }, [editMode, editSalesDate, editPoNo, editPoDate, editMergedWoIds, editMaterialOverrides, data, sourceKey]);

  // Fetch mergeable WOs when in edit mode
  useEffect(() => {
    if (!editMode || !data) return;
    let alive = true;
    queueMicrotask(() => {
      if (alive) setIsLoadingWos(true);
    });
    fetchBubutInvoiceWorkOrdersClient({
      carId: data.header.carId ? String(data.header.carId) : undefined,
      sparepartName: data.header.sparepartName ? String(data.header.sparepartName) : undefined,
      limit: "50",
      invoiceType: editMode.invoiceType,
    })
      .then(res => {
        if (alive) {
          // Filter out the current WO from the suggestions
          setMergeableWos(res.filter((wo: BubutInvoiceWorkOrderRow) => wo.sourceKey !== data.sourceKey));
        }
      })
      .catch(console.error)
      .finally(() => { if (alive) setIsLoadingWos(false); });
    
    return () => { alive = false; };
  }, [editMode, data]);

  function enterEditMode(invoiceId: number, invoiceType: BubutInvoiceType) {
    setEditMode({ invoiceId, invoiceType });
    setEditPreview(null);
    setEditMaterialOverrides(null);
    setEditMergedWoIds([]);
    setEditError(null);
  }

  function exitEditMode() {
    setEditMode(null);
    setEditPreview(null);
    setEditError(null);
  }

  function toggleEditPicture(kind: "before" | "after", url: string) {
    const setter = kind === "before" ? setEditBeforeUrls : setEditAfterUrls;
    setter((curr) => {
      if (curr.includes(url)) return curr.filter((u) => u !== url);
      if (curr.length >= 2) return curr;
      return [...curr, url];
    });
  }

  function saveEdit() {
    if (!editMode) return;
    setEditError(null);
    startTransition(async () => {
      try {
        await updateBubutInvoice(editMode.invoiceId, {
          salesInvoiceDate: editSalesDate,
          poNo: editPoNo || null,
          poDate: editPoDate || null,
          roundingStep: 1000,
          notes: null,
          beforePictureUrls: editBeforeUrls,
          afterPictureUrls: editAfterUrls,
          mergedWoIds: editMergedWoIds,
          materialOverrides: editMaterialOverrides || undefined,
        });
        exitEditMode();
        // Refresh work history data
        fetchBubutInvoiceWorkHistory(sourceKey).then(setData).catch(() => null);
      } catch {
        setEditError("Gagal menyimpan perubahan invoice.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-5xl flex-col border-l border-white/5 bg-[#0a0a0c] text-white shadow-2xl">
        {/* ── HEADER ── */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#111114] px-4 py-3">
          <div>
            {editMode ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Edit Invoice
                </p>
                <h2 className="mt-0.5 text-[13px] font-mono text-amber-400">
                  {editMode.invoiceType === "CUSTOMER" ? "Customer" : "Direksi"} — {data?.header.wobNo}
                </h2>
              </>
            ) : (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Riwayat Pengerjaan WO
                </p>
                <h2 className="mt-0.5 text-[13px] font-mono text-white/80">
                  {data?.header.wobNo ?? sourceKey}
                </h2>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {data && !editMode && <BubutInvoiceStatusBadge status={statusToBadgeStatus(data.header.invoiceStatus)} />}
            <div className="h-6 w-[1px] bg-white/5" />
            <button
              type="button"
              onClick={editMode ? exitEditMode : onClose}
              className="flex h-7 w-7 items-center justify-center border border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white transition-colors"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-3 text-sm text-white/40 font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              MEMUAT DATA...
            </div>
          ) : error ? (
            <div className="m-6 border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : data ? (
            <div className="flex flex-col">
              {/* Ringkasan WO */}
              <div className="px-4 pt-3 pb-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 border border-white/5 bg-[#111114] px-4 py-3">
                  <InfoItem label="No WOB" value={data.header.wobNo} />
                  <InfoItem label="WO Date" value={data.header.woDate} />
                  <InfoItem label="Team / PM" value={data.header.teamName} />
                  <InfoItem label="Kendaraan" value={data.header.carName} />
                  <InfoItem label="Divisi" value={data.header.divisionName} />
                  <InfoItem label="Operator" value={data.header.operatorName} />
                  <InfoItem label="Sparepart / Panel" value={data.header.sparepartName} />
                  <InfoItem label="Qty" value={data.header.qtyLabel} />
                  <div className="md:col-span-2">
                    <InfoItem label="Jobdesc" value={data.header.jobdesc} />
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border-b border-white/5 px-4">
                {[
                  ["work", "Riwayat Pengerjaan"],
                  ["material", "Bahan Terpakai"],
                  ["docs", "Dokumentasi"],
                  ["summary", "Ringkasan Biaya"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={[
                      "border-b-2 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors",
                      activeTab === tab
                        ? "border-amber-500 text-amber-500"
                        : "border-transparent text-white/40 hover:text-white/70",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="px-4 py-3">
                {activeTab === "work" && (
                  <div className="flex flex-col gap-0">
                    <div className="overflow-x-auto border border-white/5 bg-[#111114]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20">
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Tanggal</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Jam Kerja</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Durasi</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Operator</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Panel/Part</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Jobdesc</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Result</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40 text-right">Total Harga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.workRows.length > 0 ? (
                          data.workRows.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white/[0.01] hover:bg-white/[0.03] transition-colors" : "hover:bg-white/[0.03] transition-colors"}>
                              <td className="px-4 py-3 font-mono text-white/70">{text(row.workDate)}</td>
                              <td className="px-4 py-3 font-mono text-white/50">
                                {text(row.startTime)} – {text(row.finishTime)}
                              </td>
                              <td className={`px-4 py-3 font-mono font-semibold ${row.workingHourDecimal > 4 ? "text-amber-500" : "text-white/80"}`}>{row.workingHourText}</td>
                              <td className="px-4 py-3 text-white/80">{text(row.operatorName)}</td>
                              <td className="px-4 py-3 text-white/80">{text(row.panelPartName)}</td>
                              <td className="px-4 py-3 text-white/60 max-w-[150px] truncate" title={row.jobdesc || undefined}>{text(row.jobdesc)}</td>
                              <td className="px-4 py-3"><ResultBadge status={row.resultStatus} /></td>
                              <td className="px-4 py-3 font-mono text-right text-white/90">{rupiah(row.workingHourCost)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-white/40 italic">
                              Belum ada detail pengerjaan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editMode && (
                    <div className="mt-4 border border-white/5 bg-[#111114] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">Gabungkan WO Lain</h3>
                          <p className="mt-1 text-xs text-white/40">WO dengan kendaraan dan panel yang sama dapat digabung ke invoice ini.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowWoPicker(!showWoPicker)}
                          className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                            showWoPicker ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {showWoPicker ? "Tutup" : "+ Tampilkan WO"}
                        </button>
                      </div>

                      {showWoPicker && (
                        <div className="mt-4 border-t border-white/5 pt-4">
                          {isLoadingWos ? (
                            <p className="font-mono text-xs text-white/40">Mencari WO yang cocok...</p>
                          ) : mergeableWos.length > 0 ? (
                            <div className="grid gap-2">
                              {mergeableWos.map((wo) => {
                                const isChecked = !!wo.sourceKey && editMergedWoIds.includes(wo.sourceKey);
                                return (
                                  <label
                                    key={wo.sourceKey}
                                    className={`flex cursor-pointer items-start gap-3 border p-3 transition-colors ${
                                      isChecked ? "border-amber-500/40 bg-amber-500/5" : "border-white/5 bg-black/20 hover:border-white/10"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 accent-amber-500"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked && wo.sourceKey) setEditMergedWoIds((prev) => [...prev, wo.sourceKey!]);
                                        else if (wo.sourceKey) setEditMergedWoIds((prev) => prev.filter((id) => id !== wo.sourceKey));
                                      }}
                                    />
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] font-bold text-white/90">{wo.sourceWobNo}</span>
                                        <span className="font-mono text-[10px] text-white/40">&bull; {wo.woDate}</span>
                                      </div>
                                      <span className="text-xs text-white/60">{text(wo.sparepartName)}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="font-mono text-xs text-white/40">Tidak ada WO lain yang dapat digabungkan.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                )}

                {activeTab === "material" && (
                  <div className="overflow-x-auto border border-white/5 bg-[#111114]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20">
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Nama Material</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40 text-right">QTY</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40">Satuan</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40 text-right">Harga Satuan</th>
                          <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/40 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {editMode ? (
                          <>
                            {(editMaterialOverrides || []).map((row, idx) => (
                              <tr key={idx} className={idx % 2 === 0 ? "bg-white/[0.01]" : ""}>
                                <td className="px-4 py-2">
                                  <input
                                    type="text"
                                    value={row.materialName}
                                    onChange={(e) => {
                                      const newArr = [...(editMaterialOverrides || [])];
                                      newArr[idx].materialName = e.target.value;
                                      setEditMaterialOverrides(newArr);
                                    }}
                                    className="w-full border-b border-transparent bg-transparent py-1 text-white/80 outline-none focus:border-amber-500/50"
                                    placeholder="Nama Material"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    value={row.qty || ""}
                                    onChange={(e) => {
                                      const newArr = [...(editMaterialOverrides || [])];
                                      newArr[idx].qty = parseFloat(e.target.value) || 0;
                                      setEditMaterialOverrides(newArr);
                                    }}
                                    className="w-full border-b border-transparent bg-transparent py-1 text-right font-mono text-white/70 outline-none focus:border-amber-500/50"
                                  />
                                </td>
                                <td className="px-4 py-2 text-white/50">-</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    value={row.price || ""}
                                    onChange={(e) => {
                                      const newArr = [...(editMaterialOverrides || [])];
                                      newArr[idx].price = parseFloat(e.target.value) || 0;
                                      setEditMaterialOverrides(newArr);
                                    }}
                                    className="w-full border-b border-transparent bg-transparent py-1 text-right font-mono text-white/70 outline-none focus:border-amber-500/50"
                                  />
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-amber-500/80">
                                  {rupiah(row.qty * row.price)}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newArr = [...(editMaterialOverrides || [])];
                                      newArr.splice(idx, 1);
                                      setEditMaterialOverrides(newArr);
                                    }}
                                    className="ml-3 text-red-500/50 hover:text-red-500"
                                  >
                                    <X className="inline h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={5} className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditMaterialOverrides([
                                      ...(editMaterialOverrides || []),
                                      { materialName: "", qty: 1, price: 0 },
                                    ])
                                  }
                                  className="font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
                                >
                                  + Tambah Bahan Baru
                                </button>
                              </td>
                            </tr>
                          </>
                        ) : data.materialRows.length > 0 ? (
                          data.materialRows.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? "bg-white/[0.01] hover:bg-white/[0.03] transition-colors" : "hover:bg-white/[0.03] transition-colors"}>
                              <td className="px-4 py-3 text-white/80">{row.materialName}</td>
                              <td className="px-4 py-3 font-mono text-right text-white/70">{row.qty}</td>
                              <td className="px-4 py-3 text-white/50">{text(row.quom)}</td>
                              <td className="px-4 py-3 font-mono text-right text-white/70">{rupiah(row.price)}</td>
                              <td className="px-4 py-3 font-mono text-right text-amber-500/80">{rupiah(row.total)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-16 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <PackageX className="h-8 w-8 text-white/20" />
                                <span className="font-mono text-xs uppercase tracking-wider text-white/40">Tidak memakai bahan</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "docs" && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {documentationUrls.length > 0 ? (
                      documentationUrls.map((url) => {
                        const resolvedUrl = getProxiedImageUrl(url) ?? url;

                        const isBefore = editBeforeUrls.includes(url);
                        const isAfter = editAfterUrls.includes(url);

                        if (editMode) {
                          return (
                            <div key={url} className={`group relative overflow-hidden border ${isBefore || isAfter ? "border-amber-500/50" : "border-white/5"} bg-[#111114]`}>
                              <img src={resolvedUrl} alt="" className="aspect-square w-full object-cover" />
                              <div className="absolute inset-0 bg-black/40" />
                              
                              <div className="absolute top-2 left-2 flex gap-1">
                                {isBefore && <span className="rounded-sm bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black">BEFORE</span>}
                                {isAfter && <span className="rounded-sm bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-black">AFTER</span>}
                              </div>

                              <div className="absolute bottom-0 left-0 right-0 flex gap-1 border-t border-white/10 bg-black/80 p-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleEditPicture("before", url)}
                                  className={`flex-1 py-1 text-[9px] font-mono font-bold uppercase transition-colors ${
                                    isBefore ? "bg-amber-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/20 hover:text-white"
                                  }`}
                                >
                                  {isBefore ? "Batal" : "Before"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleEditPicture("after", url)}
                                  className={`flex-1 py-1 text-[9px] font-mono font-bold uppercase transition-colors ${
                                    isAfter ? "bg-emerald-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/20 hover:text-white"
                                  }`}
                                >
                                  {isAfter ? "Batal" : "After"}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <a
                            key={url}
                            href={resolvedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative overflow-hidden border border-white/5 bg-[#111114]"
                          >
                            <img
                              src={resolvedUrl}
                              alt=""
                              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />
                            <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-white/10 bg-black/80 p-2 text-center transition-transform duration-300 group-hover:translate-y-0">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white">
                                <ExternalLink className="h-3 w-3" /> Buka
                              </span>
                            </div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="col-span-full border border-white/5 bg-[#111114] px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <CameraOff className="h-8 w-8 text-white/20" />
                          <span className="font-mono text-xs uppercase tracking-wider text-white/40">Belum ada dokumentasi</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === "summary" && (() => {
                  const isPreview = !!(editMode && editPreview);
                  const pt = isPreview ? editPreview.totals : undefined;
                  const dt = !isPreview ? data.totals : undefined;
                  
                  const totalWorkHourText = isPreview ? pt!.totalWorkHourText : dt!.totalWorkingHourText;
                  const totalWorkingHourCost = isPreview ? pt!.workingHourTotal : dt!.totalWorkingHourCost;
                  const totalMaterial = isPreview ? pt!.materialTotal : dt!.totalMaterial;
                  const totalBasePrice = isPreview ? pt!.totalPriceBubut : dt!.totalBasePrice;
                  
                  const customerUpTotal = isPreview ? (pt!.priceAfterMarkup || pt!.totalPriceBubut) : dt!.customerUpTotal;
                  const customerRoundedTotal = isPreview ? (pt!.priceRounding || pt!.totalPriceBubut) : dt!.customerRoundedTotal;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-white/5 bg-[#111114]">
                      <div className="flex flex-col gap-0 border-r border-white/5 px-4 py-3">
                         <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30 mb-2">Base Cost (Direksi & Customer)</h3>
                         <div className="grid gap-3">
                           <SummaryCard label="Total Jam Kerja" value={totalWorkHourText} />
                           <SummaryCard label="Total Harga Jam Kerja" value={rupiah(totalWorkingHourCost)} />
                           <SummaryCard label="Total Bahan" value={rupiah(totalMaterial)} />
                           <SummaryCard label="Total Price Bubut" value={rupiah(totalBasePrice)} highlight />
                         </div>
                      </div>
                      <div className="flex flex-col gap-0 px-4 py-3">
                         <h3 className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500/40 mb-2">Markup Cost (Customer Only)</h3>
                         <div className="grid gap-3">
                           <SummaryCard label="UP 235% Customer" value={rupiah(customerUpTotal)} />
                           <SummaryCard label="Final Price Customer" value={rupiah(customerRoundedTotal)} highlight amber />
                         </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>


        {/* ── FOOTER ── */}
        {data && (
          <footer className="shrink-0 border-t border-white/5 bg-[#111114] px-4 py-3">
            <div className="flex justify-end gap-3">
              {editMode ? (
                // Edit mode footer
                <>
                  <button
                    type="button"
                    onClick={exitEditMode}
                    className="border border-white/10 h-8 px-4 text-[10px] font-mono uppercase text-white/40 hover:text-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !editPreview}
                    onClick={saveEdit}
                    className="flex items-center gap-2 rounded-sm bg-amber-500 px-6 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-amber-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </>
              ) : (
                // Normal footer
                <>
                  {canRelease && !data.header.direksiInvoiceId && (
                    <button type="button" onClick={() => onRelease(data.sourceKey, "DIREKSI")}
                      className="border border-amber-500/40 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 transition-colors">
                      Rilis Direksi
                    </button>
                  )}
                  {canRelease && !data.header.customerInvoiceId && (
                    <button type="button" onClick={() => onRelease(data.sourceKey, "CUSTOMER")}
                      className="border border-sky-500/30 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-sky-400 hover:bg-sky-500/10 transition-colors">
                      Rilis Customer
                    </button>
                  )}

                  {data.header.direksiInvoiceId ? (
                    <>
                      {canRelease && (
                        <button type="button" onClick={() => enterEditMode(data.header.direksiInvoiceId!, "DIREKSI")}
                          className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-transparent px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors">
                          <Pencil className="h-3 w-3" /> Edit Direksi
                        </button>
                      )}
                      {canPrint && (
                        <Link href={`/invoice/wo-bubut/${data.header.direksiInvoiceId}/print`}
                          className="inline-flex items-center gap-2 border border-amber-500/30 bg-amber-500/[0.04] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-500 hover:bg-amber-500/10 transition-colors">
                          <Printer className="h-3.5 w-3.5" /> Print Direksi
                        </Link>
                      )}
                    </>
                  ) : (
                    <button disabled className="inline-flex cursor-not-allowed items-center gap-2 border border-white/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/15">
                      <Printer className="h-3.5 w-3.5" /> Print Direksi
                    </button>
                  )}

                  {data.header.customerInvoiceId ? (
                    <>
                      {canRelease && (
                        <button type="button" onClick={() => enterEditMode(data.header.customerInvoiceId!, "CUSTOMER")}
                          className="inline-flex items-center gap-1.5 border border-sky-500/30 bg-transparent px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-sky-400 hover:bg-sky-500/10 transition-colors">
                          <Pencil className="h-3 w-3" /> Edit Customer
                        </button>
                      )}
                      {canPrint && (
                        <Link href={`/invoice/wo-bubut/${data.header.customerInvoiceId}/print`}
                          className="inline-flex items-center gap-2 border border-sky-500/30 bg-sky-500/[0.04] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-sky-400 hover:bg-sky-500/10 transition-colors">
                          <Printer className="h-3.5 w-3.5" /> Print Customer
                        </Link>
                      )}
                    </>
                  ) : (
                    <button disabled className="inline-flex cursor-not-allowed items-center gap-2 border border-white/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/15">
                      <Printer className="h-3.5 w-3.5" /> Print Customer
                    </button>
                  )}
                </>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      <span className="text-[11px] font-mono text-white/70">{text(value)}</span>
    </div>
  );
}

function SummaryCard({ label, value, highlight, amber }: { label: string; value: string; highlight?: boolean; amber?: boolean }) {
  const colorClass = amber ? "text-amber-500" : "text-white/90";
  const sizeClass = highlight ? "text-[12px]" : "text-[11px]";
  
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className={`font-mono font-bold tracking-wide ${sizeClass} ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}
