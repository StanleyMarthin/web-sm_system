"use client";

import Image from "next/image";
import { useState } from "react";
import { PlusCircle, FileText, ArrowRight, Eye, ClipboardList, CheckCircle2, ShoppingBag, Truck, Filter, RotateCcw, Loader2, UploadCloud, Plus, Trash2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { RequestDetailDialog } from "./request-detail-dialog";
import { createWo } from "@/shared/api/wo";
import { createPr, requestPrUploadTicket } from "@/shared/api/pr";
import { createVendor } from "@/shared/api/vendor";

interface RequestsOutstandingShellProps {
  user: any;
  woPayload: any;
  prPayload: any;
  vendorPayload: any;
}

export function RequestsOutstandingShell({
  user,
  woPayload,
  prPayload,
  vendorPayload
}: RequestsOutstandingShellProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<{ type: "WO" | "PR" | "WOV"; id: string } | null>(null);

  const isDivisionLeadScope =
    !user?.scope?.canViewAllUnits &&
    user?.roleProfile?.scopeBasis === "ASSIGNED_DIVISIONS" &&
    user?.roleProfile?.approvalRank === 1;

  // Filter States (Left Side lists)
  const [filterType, setFilterType] = useState<"ALL" | "WO" | "PR" | "WOV">("ALL");
  const [filterDivision, setFilterDivision] = useState<string>(
    isDivisionLeadScope ? user?.divisionName || "" : "",
  );
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Right Side Inline Creator Tab
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerSuccess, setComposerSuccess] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Derive form tab from filter
  const activeFormTab = filterType === "ALL" ? "WO" : filterType;

  // Reference lists
  const unitsList = woPayload?.references?.units || prPayload?.references?.units || [];
  const divisionsList = woPayload?.references?.divisions || [];
  const vendorsList = vendorPayload?.references?.vendors || [];

  // ----------------------------------------------------
  // FORM STATES FOR INLINE COMPOSER
  // ----------------------------------------------------
  const [woForm, setWoForm] = useState({
    carId: "",
    toDivisionId: "",
    requestDate: new Date().toISOString().split("T")[0],
    isPriority: false,
    jobDetail: "",
    notes: ""
  });

  const [prForm, setPrForm] = useState({
    carId: "",
    targetDate: "",
    priority: "NORMAL",
    notes: "",
    items: [
      {
        itemName: "",
        description: "",
        originType: "LOKAL" as "LOKAL" | "LN",
        qty: 1,
        uom: "pcs",
        estimatedPrice: 0,
        photoUrl: "",
        uploading: false
      }
    ]
  });

  const [wovForm, setWovForm] = useState({
    carId: "",
    vendorName: "",
    targetDateReturn: "",
    remarks: "",
    items: [
      {
        itemName: "",
        quantity: 1,
        uom: "pcs",
        goodsConditionOut: "",
        estimatedCost: 0
      }
    ]
  });

  // Unified status options across all three modules
  const statusOptions = [
    { value: "OPEN", label: "OPEN" },
    { value: "SUBMITTED", label: "SUBMITTED" },
    { value: "APPROVED", label: "APPROVED" },
    { value: "SENT", label: "SENT" },
    { value: "PROSES_VENDOR", label: "PROSES VENDOR" },
    { value: "HUNTING", label: "HUNTING" },
    { value: "ORDERED", label: "ORDERED" },
    { value: "DONE", label: "DONE" },
    { value: "ARRIVED", label: "ARRIVED" },
    { value: "RECEIVED", label: "RECEIVED" },
    { value: "CANCELLED", label: "CANCELLED" },
    { value: "REJECTED", label: "REJECTED" }
  ];

  // Derive consolidated active lists
  // Active means status is not DONE, ARRIVED, RECEIVED, CANCELLED, or REJECTED.
  const activeStatuses = ["OPEN", "APPROVED", "SUBMITTED", "SENT", "PROSES_VENDOR", "HUNTING", "ORDERED"];
  
  // 1. DIAJUKAN (Requested/submitted by the logged-in user's division)
  const submittedWo = (woPayload?.data || [])
    .filter((w: any) => (!isDivisionLeadScope || w.fromDivisionName === user.divisionName) && activeStatuses.includes(w.status))
    .map((w: any) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, info: `Tujuan: ${w.toDivisionName}` }));

  const submittedPr = (prPayload?.data || [])
    .filter((p: any) => (!isDivisionLeadScope || p.divisionName === user.divisionName) && activeStatuses.includes(p.status))
    .map((p: any) => ({ ...p, reqType: "PR" as const, id: p.prId, number: p.prNumber, date: p.createdAt ? p.createdAt.split("T")[0] : "-", info: `${p.totalItems || 0} Items · Est: Rp ${Number(p.totalEstimatedPrice || 0).toLocaleString("id-ID")}` }));

  const submittedWov = (vendorPayload?.data || [])
    .filter((v: any) => (!isDivisionLeadScope || v.divisionName === user.divisionName) && activeStatuses.includes(v.status))
    .map((v: any) => ({ ...v, reqType: "WOV" as const, id: v.wovId, number: v.wovNumber, date: v.createdAt ? v.createdAt.split("T")[0] : "-", info: `Vendor: ${v.vendorName || "-"}` }));

  const rawSubmitted = [...submittedWo, ...submittedPr, ...submittedWov]
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // 2. HARUS DIKERJAKAN (Assigned to the user's division to be worked on - Work Orders specifically)
  const rawAssigned = (woPayload?.data || [])
    .filter((w: any) => (!isDivisionLeadScope || w.toDivisionName === user.divisionName) && activeStatuses.includes(w.status))
    .map((w: any) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, info: `Dari: ${w.fromDivisionName} · Est: ${w.estimatedHours || 0} Jam` }))
    .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // Apply dashboard filters dynamically
  const filterRecord = (r: any) => {
    if (filterType !== "ALL" && r.reqType !== filterType) return false;
    
    // For Division Filter
    if (filterDivision) {
      if (r.reqType === "WO") {
        if (r.fromDivisionName?.toLowerCase() !== filterDivision.toLowerCase() && 
            r.toDivisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
      } else {
        if (r.divisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
      }
    }

    if (filterUnit && r.carId !== filterUnit && r.unitName !== filterUnit) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  };

  const consolidatedSubmitted = rawSubmitted.filter(filterRecord).slice(0, 5);
  const assignedWo = rawAssigned.filter(filterRecord).slice(0, 5);

  // Count Summary Stats
  const woPending = (woPayload?.data || []).filter((w: any) => ["OPEN", "SUBMITTED"].includes(w.status)).length;
  const prPending = (prPayload?.data || []).filter((p: any) => p.accTracking !== "APPROVED" && p.status === "OPEN").length;
  const wovPending = (vendorPayload?.data || []).filter((v: any) => v.accTracking !== "APPROVED" && v.status === "OPEN").length;

  // ----------------------------------------------------
  // PR UPLOAD HANDLER
  // ----------------------------------------------------
  async function handlePrImageUpload(index: number, file: File) {
    if (!file) return;

    setPrForm((curr) => {
      const copy = [...curr.items];
      copy[index] = { ...copy[index], uploading: true };
      return { ...curr, items: copy };
    });

    try {
      const ticketRes = await requestPrUploadTicket({
        filename: file.name,
        contentType: file.type,
      });

      if (!ticketRes.success) {
        throw new Error(ticketRes.message || "Gagal mendapatkan upload ticket.");
      }

      const { uploadUrl, publicUrl } = ticketRes.result;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Gagal mengunggah file.");
      }

      setPrForm((curr) => {
        const copy = [...curr.items];
        copy[index] = { ...copy[index], photoUrl: publicUrl, uploading: false };
        return { ...curr, items: copy };
      });
    } catch (err: any) {
      alert(err.message || "Gagal upload.");
      setPrForm((curr) => {
        const copy = [...curr.items];
        copy[index] = { ...copy[index], uploading: false };
        return { ...curr, items: copy };
      });
    }
  }

  // ----------------------------------------------------
  // INLINE COMPOSER SUBMIT
  // ----------------------------------------------------
  async function handleComposerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setComposerError(null);
    setComposerSuccess(null);
    setComposerLoading(true);

    try {
      if (activeFormTab === "WO") {
        if (!woForm.carId || !woForm.toDivisionId || !woForm.jobDetail) {
          throw new Error("Kolom Unit, Divisi Tujuan, dan Rincian Pekerjaan wajib diisi!");
        }
        const res = await createWo({
          carId: woForm.carId,
          toDivisionId: Number(woForm.toDivisionId),
          requestDate: woForm.requestDate,
          isPriority: woForm.isPriority,
          panelName: null,
          jobDetail: woForm.jobDetail,
          estimatedHours: null,
          notes: woForm.notes || null,
          items: []
        });
        if (!res.success) throw new Error(res.message);
        setComposerSuccess("Work Order berhasil dikirim!");
        setWoForm({
          carId: "",
          toDivisionId: "",
          requestDate: new Date().toISOString().split("T")[0],
          isPriority: false,
          jobDetail: "",
          notes: ""
        });
      }

      if (activeFormTab === "PR") {
        if (!prForm.carId || prForm.items.some((it) => !it.itemName)) {
          throw new Error("Pilih unit kendaraan dan lengkapi nama barang!");
        }
        const res = await createPr({
          carId: prForm.carId,
          divisionName: null,
          targetDate: prForm.targetDate || null,
          priority: prForm.priority,
          notes: prForm.notes || null,
          items: prForm.items.map((it) => ({
            itemName: it.itemName,
            description: it.description || null,
            originType: it.originType,
            qty: Number(it.qty),
            uom: it.uom,
            estimatedPrice: it.estimatedPrice ? Number(it.estimatedPrice) : null,
            photoUrl: it.photoUrl || null
          }))
        });
        if (!res.success) throw new Error(res.message);
        setComposerSuccess("Purchase Request berhasil dikirim!");
        setPrForm({
          carId: "",
          targetDate: "",
          priority: "NORMAL",
          notes: "",
          items: [{ itemName: "", description: "", originType: "LOKAL", qty: 1, uom: "pcs", estimatedPrice: 0, photoUrl: "", uploading: false }]
        });
      }

      if (activeFormTab === "WOV") {
        if (!wovForm.carId || !wovForm.vendorName || wovForm.items.some((it) => !it.itemName)) {
          throw new Error("Pilih unit, vendor, dan lengkapi nama item vendor!");
        }
        const selectedVendor = vendorsList.find((vendor: any) => vendor.value === wovForm.vendorName);
        const res = await createVendor({
          carId: wovForm.carId,
          coreId: null,
          prId: null,
          vendorId: selectedVendor?.value ?? null,
          vendorName: selectedVendor?.label ?? wovForm.vendorName,
          picVendor: null,
          itemName: wovForm.items[0]?.itemName || null,
          quantity: wovForm.items[0]?.quantity ? Number(wovForm.items[0].quantity) : null,
          uom: wovForm.items[0]?.uom || null,
          goodsConditionOut: wovForm.items[0]?.goodsConditionOut || null,
          targetDateReturn: wovForm.targetDateReturn || null,
          estimatedCost: wovForm.items[0]?.estimatedCost ? Number(wovForm.items[0].estimatedCost) : null,
          remarks: wovForm.remarks || null,
          items: wovForm.items.map((it) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity),
            uom: it.uom,
            goodsConditionOut: it.goodsConditionOut || null,
            estimatedCost: it.estimatedCost ? Number(it.estimatedCost) : null
          }))
        });
        if (!res.success) throw new Error(res.message);
        setComposerSuccess("Vendor Work Order berhasil dikirim!");
        setWovForm({
          carId: "",
          vendorName: "",
          targetDateReturn: "",
          remarks: "",
          items: [{ itemName: "", quantity: 1, uom: "pcs", goodsConditionOut: "", estimatedCost: 0 }]
        });
      }

      router.refresh();
    } catch (err: any) {
      setComposerError(err?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setComposerLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-3 print:hidden">
      {/* 3 Quick summary stat cards */}
      <section className="grid gap-2 sm:grid-cols-3">
        <div className="border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">WO Aktif / Pending</span>
              <span title="Work Orders menunggu pengerjaan divisi"><Info className="h-3 w-3 cursor-help text-gray-400 dark:text-white/35 hover:text-gray-600 dark:text-white/60" /></span>
            </div>
            <ClipboardList className="h-4 w-4 text-gray-400 dark:text-white/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-gray-900 dark:text-white">{woPending}</p>
        </div>

        <div className="border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">PR Tunggu Approval</span>
              <span title="Barang menunggu persetujuan KD / Gudang"><Info className="h-3 w-3 cursor-help text-gray-400 dark:text-white/35 hover:text-gray-600 dark:text-white/60" /></span>
            </div>
            <ShoppingBag className="h-4 w-4 text-gray-400 dark:text-white/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-gray-900 dark:text-white">{prPending}</p>
        </div>

        <div className="border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">Vendor WO Aktif</span>
              <span title="Pekerjaan luar / pengiriman aktif rekanan"><Info className="h-3 w-3 cursor-help text-gray-400 dark:text-white/35 hover:text-gray-600 dark:text-white/60" /></span>
            </div>
            <Truck className="h-4 w-4 text-gray-400 dark:text-white/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-gray-900 dark:text-white">{wovPending}</p>
        </div>
      </section>

      {/* Flexible & Interactive Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "ALL" | "WO" | "PR" | "WOV")}
          className="h-8 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
        >
          <option value="ALL">Semua Jenis</option>
          <option value="WO">Work Order</option>
          <option value="PR">Purchase Request</option>
          <option value="WOV">Vendor WO</option>
        </select>

        <select
          value={filterDivision}
          disabled={isDivisionLeadScope}
          onChange={(e) => setFilterDivision(e.target.value)}
          className="h-8 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30 disabled:opacity-50"
        >
          {isDivisionLeadScope ? (
            <option value={user.divisionName}>{user.divisionName}</option>
          ) : (
            <>
              <option value="">Semua Divisi</option>
              {divisionsList.map((d: any) => (
                <option key={d.value} value={d.label}>{d.label}</option>
              ))}
            </>
          )}
        </select>

        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="h-8 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
        >
          <option value="">Semua Unit</option>
          {unitsList.map((u: any) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
        >
          <option value="">Semua Status</option>
          {statusOptions.map((st) => (
            <option key={st.value} value={st.value}>{st.label}</option>
          ))}
        </select>

        {(filterType !== "ALL" || filterDivision || filterUnit || filterStatus) && (
          <button
            onClick={() => {
              setFilterType("ALL");
              if (!isDivisionLeadScope) setFilterDivision("");
              setFilterUnit("");
              setFilterStatus("");
            }}
            title="Reset Filters"
            className="ml-auto flex h-8 w-8 items-center justify-center border border-gray-200 dark:border-white/[0.05] bg-transparent text-gray-400 dark:text-white/40 transition-colors hover:text-gray-900 dark:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Main content grid: Left top lists (Top 5) vs Right COMPOSER Form */}
      <div className="grid gap-3 lg:grid-cols-12">
        {/* Left top 5 active lists (7 cols) */}
        <div className="space-y-3 lg:col-span-7">
          
          {/* Section 1: Diajukan (Diajukan) */}
          <div className="border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-1.5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">5 Permintaan Teratas Aktif (Diajukan)</h3>
                <span title={`Diajukan oleh divisi ${user.divisionName}`}><Info className="h-3.5 w-3.5 text-gray-400 dark:text-white/35 cursor-help hover:text-gray-700 dark:text-white/70" /></span>
              </div>
              <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/40">Kategori: Diajukan</span>
            </div>

            <div className="divide-y divide-white/[0.04] max-h-[380px] overflow-y-auto pr-1">
              {consolidatedSubmitted.length === 0 ? (
                <p className="py-8 text-xs text-gray-400 dark:text-white/30 text-center">Tidak ada permintaan yang sesuai dengan filter.</p>
              ) : (
                consolidatedSubmitted.map((row: any) => (
                  <div key={row.id} className="group flex items-center justify-between px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/45">
                        {row.reqType}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-white/90">{row.number} · {row.unitName}</p>
                        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-white/35">{row.info}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/45">
                          {row.status}
                        </span>
                        <p className="mt-1 font-mono text-[9px] text-gray-300 dark:text-white/20">{row.date}</p>
                      </div>
                      <button
                        onClick={() => setSelectedItem({ type: row.reqType, id: row.id })}
                        className="border border-gray-200 dark:border-white/[0.05] p-1.5 text-gray-600 dark:text-white/60 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Harus Dikerjakan (Harus Dikerjakan) - ONLY for WO */}
          {(filterType === "ALL" || filterType === "WO") && (
            <div className="border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-1.5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">5 Work Order Teratas Aktif (Harus Dikerjakan)</h3>
                <span title={`Ditujukan ke divisi ${user.divisionName}`}><Info className="h-3.5 w-3.5 text-gray-400 dark:text-white/35 cursor-help hover:text-gray-700 dark:text-white/70" /></span>
              </div>
              <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/40">Kategori: Perlu Dikerjakan</span>
            </div>

            <div className="divide-y divide-white/[0.04] max-h-[380px] overflow-y-auto pr-1">
              {assignedWo.length === 0 ? (
                <p className="py-8 text-xs text-gray-400 dark:text-white/30 text-center">Tidak ada Work Order yang sesuai dengan filter.</p>
              ) : (
                assignedWo.map((row: any) => (
                  <div key={row.id} className="group flex items-center justify-between px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/45">
                        WO
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/90 truncate">{row.number} · {row.unitName}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/35 mt-0.5">{row.info}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/45">
                          {row.status}
                        </span>
                        <p className="mt-1 font-mono text-[9px] text-gray-300 dark:text-white/20">{row.date}</p>
                      </div>
                      <button
                        onClick={() => setSelectedItem({ type: "WO", id: row.id })}
                        className="border border-gray-200 dark:border-white/[0.05] p-1.5 text-gray-600 dark:text-white/60 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}

        </div>

        {/* Right side: PREMIUM INLINE REQUEST COMPOSER FORM (5 cols) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="relative border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/30">Menu Request Cepat (Inline Form)</h3>
              <span title="Isi rincian permintaan langsung dan submit secara instan"><Info className="h-3.5 w-3.5 text-gray-400 dark:text-white/35 cursor-help hover:text-gray-700 dark:text-white/70" /></span>
            </div>

            {/* Notifications */}
            {composerSuccess && (
              <div className="border border-emerald-500/30 px-3 py-2 text-[10px] text-emerald-300">
                {composerSuccess}
              </div>
            )}
            {composerError && (
              <div className="border border-red-500/30 px-3 py-2 text-[10px] text-red-300">
                {composerError}
              </div>
            )}

            {/* Dynamic Form render depending on selected inline tab */}
            <form onSubmit={handleComposerSubmit} className="space-y-3 text-xs text-gray-800 dark:text-white/80">
              
              {/* WO INLINE FORM FIELDS */}
              {activeFormTab === "WO" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Unit Kendaraan</label>
                      <select
                        value={woForm.carId}
                        onChange={(e) => setWoForm({ ...woForm, carId: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="" className="bg-black">Pilih Unit</option>
                        {unitsList.map((u: any) => (
                          <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Tujuan Divisi</label>
                      <select
                        value={woForm.toDivisionId}
                        onChange={(e) => setWoForm({ ...woForm, toDivisionId: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="" className="bg-black">Pilih Divisi</option>
                        {divisionsList.map((d: any) => (
                          <option key={d.value} value={d.value} className="bg-black">{d.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Tanggal Permintaan</label>
                      <input
                        type="date"
                        value={woForm.requestDate}
                        onChange={(e) => setWoForm({ ...woForm, requestDate: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6 pl-1.5">
                      <input
                        type="checkbox"
                        id="inline-wo-prio"
                        checked={woForm.isPriority}
                        onChange={(e) => setWoForm({ ...woForm, isPriority: e.target.checked })}
                        className="h-4 w-4 text-amber-500 rounded bg-transparent border-white/20 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="inline-wo-prio" className="text-gray-600 dark:text-white/60 font-semibold cursor-pointer text-[10px]">Urgent / Prioritas</label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Rincian Pekerjaan (Job Detail)</label>
                    <textarea
                      value={woForm.jobDetail}
                      onChange={(e) => setWoForm({ ...woForm, jobDetail: e.target.value })}
                      placeholder="Tulis detail keluhan/pekerjaan yang diajukan divisi..."
                      className="w-full min-h-[70px] border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 py-2 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Catatan Tambahan (Optional)</label>
                    <input
                      type="text"
                      value={woForm.notes}
                      onChange={(e) => setWoForm({ ...woForm, notes: e.target.value })}
                      placeholder="Catatan pengerjaan jika ada..."
                      className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                    />
                  </div>
                </div>
              )}

              {/* PR INLINE FORM FIELDS */}
              {activeFormTab === "PR" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Unit Kendaraan</label>
                      <select
                        value={prForm.carId}
                        onChange={(e) => setPrForm({ ...prForm, carId: e.target.value })}
                      className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="" className="bg-black">Pilih Unit</option>
                        {unitsList.map((u: any) => (
                          <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Prioritas PR</label>
                      <select
                        value={prForm.priority}
                        onChange={(e) => setPrForm({ ...prForm, priority: e.target.value })}
                      className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="NORMAL" className="bg-black">NORMAL</option>
                        <option value="HIGH" className="bg-black">URGENT</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Target Tiba (Optional)</label>
                      <input
                        type="date"
                        value={prForm.targetDate}
                        onChange={(e) => setPrForm({ ...prForm, targetDate: e.target.value })}
                      className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Keterangan / Notes</label>
	                      <input
	                        type="text"
	                        value={prForm.notes}
	                        onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })}
	                        placeholder="Contoh: Belanja sparepart"
	                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2.5 font-mono text-[11px] text-gray-900 dark:text-white outline-none placeholder:text-gray-300 dark:text-white/20 focus:border-amber-500/30"
	                      />
                    </div>
                  </div>

                  {/* PR Items sublist */}
                  <div className="border-t border-white/[0.04] pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wide">Daftar Barang ({prForm.items.length})</span>
                      <button
                        type="button"
                        onClick={() => setPrForm({
                          ...prForm,
                          items: [...prForm.items, { itemName: "", description: "", originType: "LOKAL", qty: 1, uom: "pcs", estimatedPrice: 0, photoUrl: "", uploading: false }]
                        })}
                        className="text-[9px] text-purple-400 hover:text-purple-300 font-bold uppercase flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Tambah Baris
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                      {prForm.items.map((item, idx) => (
                        <div key={idx} className="relative space-y-2 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] p-3">
                          {prForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPrForm({ ...prForm, items: prForm.items.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              value={item.itemName}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], itemName: e.target.value };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="Nama Barang *"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], description: e.target.value };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="Keterangan / Merk"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              required
                              value={item.qty}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], qty: Number(e.target.value) };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="Qty"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="text"
                              required
                              value={item.uom}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], uom: e.target.value };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="UOM"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="number"
                              required
                              value={item.estimatedPrice}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], estimatedPrice: Number(e.target.value) };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="Est. Harga"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                          </div>

                          {/* Lampirkan Foto / R2 Upload */}
                          <div className="flex items-center justify-between border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] p-2">
                            {item.photoUrl ? (
                              <div className="flex items-center gap-2">
                                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-gray-300 dark:border-white/10">
                                  <Image src={item.photoUrl} alt="uploaded" fill sizes="28px" className="object-cover" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...prForm.items];
                                    copy[idx] = { ...copy[idx], photoUrl: "" };
                                    setPrForm({ ...prForm, items: copy });
                                  }}
                                  className="text-[8px] font-bold text-red-400 hover:underline"
                                >
                                  Hapus Foto
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1.5 text-[9px] text-purple-400/80 hover:text-purple-300 cursor-pointer">
                                <UploadCloud className="h-3.5 w-3.5" />
                                <span>{item.uploading ? "Uploading..." : "Lampirkan Foto"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={item.uploading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePrImageUpload(idx, file);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* WOV INLINE FORM FIELDS */}
              {activeFormTab === "WOV" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Unit Kendaraan</label>
                      <select
                        value={wovForm.carId}
                        onChange={(e) => setWovForm({ ...wovForm, carId: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="" className="bg-black">Pilih Unit</option>
                        {unitsList.map((u: any) => (
                          <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Nama Vendor</label>
                      <select
                        value={wovForm.vendorName}
                        onChange={(e) => setWovForm({ ...wovForm, vendorName: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      >
                        <option value="" className="bg-black">Pilih Vendor</option>
                        {vendorsList.map((v: any) => (
                          <option key={v.value} value={v.value} className="bg-black">{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Tanggal Kembali</label>
                      <input
                        type="date"
                        value={wovForm.targetDateReturn}
                        onChange={(e) => setWovForm({ ...wovForm, targetDateReturn: e.target.value })}
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30 pl-0.5">Remarks / Catatan</label>
                      <input
                        type="text"
                        value={wovForm.remarks}
                        onChange={(e) => setWovForm({ ...wovForm, remarks: e.target.value })}
                        placeholder="Contoh: Oven Cat ulang"
                        className="h-8 w-full border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] px-2.5 text-[11px] text-gray-900 dark:text-white outline-none focus:border-amber-500/30"
                      />
                    </div>
                  </div>

                  {/* WOV Items Sublist */}
                  <div className="border-t border-white/[0.04] pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wide">Pekerjaan Vendor ({wovForm.items.length})</span>
                      <button
                        type="button"
                        onClick={() => setWovForm({
                          ...wovForm,
                          items: [...wovForm.items, { itemName: "", quantity: 1, uom: "pcs", goodsConditionOut: "", estimatedCost: 0 }]
                        })}
                        className="text-[9px] text-sky-400 hover:text-sky-300 font-bold uppercase flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Tambah Baris
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                      {wovForm.items.map((item, idx) => (
                        <div key={idx} className="relative space-y-2 border border-gray-200 dark:border-white/[0.05] bg-gray-50 dark:bg-[#0a0a0c] p-3">
                          {wovForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setWovForm({ ...wovForm, items: wovForm.items.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 text-gray-300 dark:text-white/20 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              value={item.itemName}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], itemName: e.target.value };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="Pekerjaan Vendor *"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="text"
                              value={item.goodsConditionOut}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], goodsConditionOut: e.target.value };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="Kondisi Fisik Keluar"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              required
                              value={item.quantity}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], quantity: Number(e.target.value) };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="Qty"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="text"
                              required
                              value={item.uom}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], uom: e.target.value };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="UOM"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                            <input
                              type="number"
                              required
                              value={item.estimatedCost}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], estimatedCost: Number(e.target.value) };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="Est. Biaya"
                              className="h-8 border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-2 text-[10px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Kirim Permintaan button */}
              <button
                type="submit"
                disabled={composerLoading}
                className="mt-3 flex h-8 w-full items-center justify-center gap-2 border border-amber-500/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              >
                {composerLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{composerLoading ? "Sedang Mengirim..." : "Kirim Permintaan"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      </div>

      {/* Details Dialog */}
      {selectedItem && (
        <RequestDetailDialog
          type={selectedItem.type}
          id={selectedItem.id}
          user={user}
          woPayload={woPayload}
          prPayload={prPayload}
          vendorPayload={vendorPayload}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
