"use client";

import Image from "next/image";
import { useState } from "react";
import { Eye, ClipboardList, ShoppingBag, Truck, RotateCcw, Loader2, UploadCloud, Plus, Trash2, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { RequestDetailDialog } from "./request-detail-dialog";
import { createWo } from "@/shared/api/wo";
import { createPr, requestPrUploadTicket } from "@/shared/api/pr";
import { createVendor } from "@/shared/api/vendor";
import { SearchSelect, StrictSearchSelect, useMasterPanelOptions } from "./forms/master-panel-search";

interface ReferenceOption {
  value: string;
  label: string;
}

interface RequestUser {
  divisionName?: string;
  scope?: { canViewAllUnits?: boolean };
  roleProfile?: {
    scopeBasis?: string;
    approvalRank?: number | null;
  } | null;
}

interface WoListRow {
  woId: string;
  woNumber: string;
  requestDate: string;
  carId?: string | null;
  unitName?: string;
  fromDivisionName?: string;
  toDivisionName?: string;
  status: string;
  createdAt?: string;
  estimatedHours?: number | null;
}

interface PrListRow {
  prId: string;
  prNumber: string;
  carId?: string | null;
  unitName?: string;
  divisionName?: string;
  status: string;
  accTracking?: string;
  createdAt?: string;
  totalItems?: number;
  totalEstimatedPrice?: number;
}

interface VendorListRow {
  wovId: string;
  wovNumber: string;
  carId?: string | null;
  unitName?: string;
  divisionName?: string;
  status: string;
  accTracking?: string;
  createdAt?: string;
  vendorName?: string;
}

interface RequestPayload<T> {
  data?: T[];
  references?: {
    units?: ReferenceOption[];
    divisions?: ReferenceOption[];
    vendors?: ReferenceOption[];
  };
}

type RequestCard = {
  reqType: "WO" | "PR" | "WOV";
  id: string;
  number: string;
  date: string;
  info: string;
  status: string;
  createdAt?: string;
  carId?: string | null;
  unitName?: string;
  fromDivisionName?: string;
  toDivisionName?: string;
  divisionName?: string;
};

function defaultWoTargetDate() {
  const target = new Date();
  target.setDate(target.getDate() + 3);
  return target.toISOString().split("T")[0];
}

interface RequestsOutstandingShellProps {
  user: RequestUser;
  woPayload: RequestPayload<WoListRow>;
  prPayload: RequestPayload<PrListRow>;
  vendorPayload: RequestPayload<VendorListRow>;
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
  const unitsList: ReferenceOption[] = woPayload?.references?.units || prPayload?.references?.units || [];
  const divisionsList: ReferenceOption[] = woPayload?.references?.divisions || [];
  const vendorsList: ReferenceOption[] = vendorPayload?.references?.vendors || [];

  // ----------------------------------------------------
  // FORM STATES FOR INLINE COMPOSER
  // ----------------------------------------------------
  const [woForm, setWoForm] = useState({
    carId: "",
    toDivisionId: "",
    requestDate: defaultWoTargetDate(),
    isPriority: false,
    notes: "",
    items: [
      {
        panelName: "",
        qty: 1,
        jobDetail: "",
      },
    ],
  });

  const [prForm, setPrForm] = useState({
    carId: "",
    targetDate: "",
    priority: "NORMAL",
    notes: "",
    items: [
      {
        itemSourceType: "MASTER_PANEL" as "MASTER_PANEL" | "OTHER",
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
        itemSourceType: "MASTER_PANEL" as "MASTER_PANEL" | "OTHER",
        itemName: "",
        quantity: 1,
        uom: "pcs",
        goodsConditionOut: "",
        estimatedCost: 0
      }
    ]
  });
  const { options: woPanelOptions, isLoading: isLoadingWoPanels } = useMasterPanelOptions(woForm.carId);
  const { options: prPanelOptions, isLoading: isLoadingPrPanels } = useMasterPanelOptions(prForm.carId);
  const { options: wovPanelOptions, isLoading: isLoadingWovPanels } = useMasterPanelOptions(wovForm.carId);

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
  const requestTypeOptions = [
    { value: "ALL", label: "Semua Jenis" },
    { value: "WO", label: "Work Order" },
    { value: "PR", label: "Purchase Request" },
    { value: "WOV", label: "Vendor WO" },
  ];
  const filterDivisionOptions = isDivisionLeadScope
    ? [{ value: user.divisionName ?? "", label: user.divisionName ?? "-" }]
    : [{ value: "", label: "Semua Divisi" }, ...divisionsList.map((division) => ({ value: division.label, label: division.label }))];
  const filterUnitOptions = [{ value: "", label: "Semua Unit" }, ...unitsList];
  const filterStatusOptions = [{ value: "", label: "Semua Status" }, ...statusOptions];
  const priorityOptions = [
    { value: "NORMAL", label: "NORMAL" },
    { value: "HIGH", label: "URGENT" },
  ];

  // Derive consolidated active lists
  // Active means status is not DONE, ARRIVED, RECEIVED, CANCELLED, or REJECTED.
  const activeStatuses = [
    "OPEN",
    "SUBMITTED",
    "PENDING_TARGET_KD_APPROVAL",
    "PENDING_ADVISOR_APPROVAL",
    "PENDING_KP_APPROVAL",
    "PENDING_PM_APPROVAL",
    "APPROVED",
    "SENT",
    "PROSES_VENDOR",
    "HUNTING",
    "ORDERED",
  ];
  
  // 1. DIAJUKAN (Requested/submitted by the logged-in user's division)
  const submittedWo: RequestCard[] = (woPayload?.data || [])
    .filter((w) => (!isDivisionLeadScope || w.fromDivisionName === user.divisionName) && activeStatuses.includes(w.status))
    .map((w) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, info: `Tujuan: ${w.toDivisionName}` }));

  const submittedPr: RequestCard[] = (prPayload?.data || [])
    .filter((p) => (!isDivisionLeadScope || p.divisionName === user.divisionName) && activeStatuses.includes(p.status))
    .map((p) => ({ ...p, reqType: "PR" as const, id: p.prId, number: p.prNumber, date: p.createdAt ? p.createdAt.split("T")[0] : "-", info: `${p.totalItems || 0} Items · Est: Rp ${Number(p.totalEstimatedPrice || 0).toLocaleString("id-ID")}` }));

  const submittedWov: RequestCard[] = (vendorPayload?.data || [])
    .filter((v) => (!isDivisionLeadScope || v.divisionName === user.divisionName) && activeStatuses.includes(v.status))
    .map((v) => ({ ...v, reqType: "WOV" as const, id: v.wovId, number: v.wovNumber, date: v.createdAt ? v.createdAt.split("T")[0] : "-", info: `Vendor: ${v.vendorName || "-"}` }));

  const rawSubmitted = [...submittedWo, ...submittedPr, ...submittedWov]
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // 2. HARUS DIKERJAKAN (Assigned to the user's division to be worked on - Work Orders specifically)
  const rawAssigned: RequestCard[] = (woPayload?.data || [])
    .filter((w) => (!isDivisionLeadScope || w.toDivisionName === user.divisionName) && activeStatuses.includes(w.status))
    .map((w) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, info: `Dari: ${w.fromDivisionName} · Est: ${w.estimatedHours || 0} Jam` }))
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // Apply dashboard filters dynamically
  const filterRecord = (r: RequestCard) => {
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
  const woPending = (woPayload?.data || []).filter((w) => ["OPEN", "SUBMITTED"].includes(w.status)).length;
  const prPending = (prPayload?.data || []).filter((p) => p.accTracking !== "APPROVED" && p.status === "OPEN").length;
  const wovPending = (vendorPayload?.data || []).filter((v) => v.accTracking !== "APPROVED" && v.status === "OPEN").length;

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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal upload.");
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
        const validWoItems = woForm.items.filter((item) => item.panelName.trim() && item.jobDetail.trim());
        if (!woForm.carId || !woForm.toDivisionId || validWoItems.length === 0) {
          throw new Error("Pilih unit, divisi tujuan, panel/parts, dan rincian pekerjaan!");
        }
        const firstItem = validWoItems[0];
        const res = await createWo({
          carId: woForm.carId,
          toDivisionId: Number(woForm.toDivisionId),
          requestDate: woForm.requestDate,
          isPriority: woForm.isPriority,
          panelName: firstItem?.panelName ?? null,
          jobDetail: firstItem?.jobDetail ?? null,
          estimatedHours: null,
          notes: woForm.notes || null,
          items: validWoItems.map((item) => {
            const matchedPanel = woPanelOptions.find((option) => option.value === item.panelName);
            return {
              panelName: item.panelName,
              sectionName: null,
              panelCategory: matchedPanel?.category ?? null,
              jobDetail: [`Qty: ${item.qty}`, item.jobDetail].join("\n"),
              estimatedHours: null,
              notes: woForm.notes || null,
              addPanelToMaster: false,
            };
          })
        });
        if (!res.success) throw new Error(res.message);
        setComposerSuccess("Work Order berhasil dikirim!");
        setWoForm({
          carId: "",
          toDivisionId: "",
          requestDate: defaultWoTargetDate(),
          isPriority: false,
          notes: "",
          items: [{ panelName: "", qty: 1, jobDetail: "" }],
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
          items: [{ itemSourceType: "MASTER_PANEL", itemName: "", description: "", originType: "LOKAL", qty: 1, uom: "pcs", estimatedPrice: 0, photoUrl: "", uploading: false }]
        });
      }

      if (activeFormTab === "WOV") {
        if (!wovForm.carId || !wovForm.vendorName || wovForm.items.some((it) => !it.itemName)) {
          throw new Error("Pilih unit, vendor, dan lengkapi nama item vendor!");
        }
        const selectedVendor = vendorsList.find((vendor) => vendor.value === wovForm.vendorName);
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
          items: [{ itemSourceType: "MASTER_PANEL", itemName: "", quantity: 1, uom: "pcs", goodsConditionOut: "", estimatedCost: 0 }]
        });
      }

      router.refresh();
    } catch (err: unknown) {
      setComposerError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setComposerLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-3 print:hidden">
      {/* 3 Quick summary stat cards */}
      <section className="grid gap-2 sm:grid-cols-3">
        <div className="border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">WO Aktif / Pending</span>
              <span title="Work Orders menunggu pengerjaan divisi"><Info className="h-3 w-3 cursor-help text-muted-foreground dark:text-foreground/50 hover:text-muted-foreground dark:text-foreground/60" /></span>
            </div>
            <ClipboardList className="h-4 w-4 text-muted-foreground dark:text-foreground/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-foreground dark:text-foreground">{woPending}</p>
        </div>

        <div className="border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">PR Tunggu Approval</span>
              <span title="Barang menunggu persetujuan KD / Gudang"><Info className="h-3 w-3 cursor-help text-muted-foreground dark:text-foreground/50 hover:text-muted-foreground dark:text-foreground/60" /></span>
            </div>
            <ShoppingBag className="h-4 w-4 text-muted-foreground dark:text-foreground/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-foreground dark:text-foreground">{prPending}</p>
        </div>

        <div className="border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">Vendor WO Aktif</span>
              <span title="Pekerjaan luar / pengiriman aktif rekanan"><Info className="h-3 w-3 cursor-help text-muted-foreground dark:text-foreground/50 hover:text-muted-foreground dark:text-foreground/60" /></span>
            </div>
            <Truck className="h-4 w-4 text-muted-foreground dark:text-foreground/40" />
          </div>
          <p className="mt-1 font-mono text-[13px] text-foreground dark:text-foreground">{wovPending}</p>
        </div>
      </section>

      {/* Flexible & Interactive Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3">
        <div className="min-w-[160px]">
          <StrictSearchSelect
            value={filterType}
            options={requestTypeOptions}
            onChange={(value) => setFilterType(value as "ALL" | "WO" | "PR" | "WOV")}
            placeholder="Cari jenis"
            accent="amber"
          />
        </div>

        <div className="min-w-[180px]">
          <StrictSearchSelect
            value={filterDivision}
            options={filterDivisionOptions}
            onChange={setFilterDivision}
            placeholder="Cari divisi"
            disabled={isDivisionLeadScope}
            accent="amber"
          />
        </div>

        <div className="min-w-[180px]">
          <StrictSearchSelect
            value={filterUnit}
            options={filterUnitOptions}
            onChange={setFilterUnit}
            placeholder="Cari unit"
            accent="amber"
          />
        </div>

        <div className="min-w-[160px]">
          <StrictSearchSelect
            value={filterStatus}
            options={filterStatusOptions}
            onChange={setFilterStatus}
            placeholder="Cari status"
            accent="amber"
          />
        </div>

        {(filterType !== "ALL" || filterDivision || filterUnit || filterStatus) && (
          <button
            onClick={() => {
              setFilterType("ALL");
              if (!isDivisionLeadScope) setFilterDivision("");
              setFilterUnit("");
              setFilterStatus("");
            }}
            title="Reset Filters"
            className="ml-auto flex h-8 w-8 items-center justify-center border border-border dark:border-white/[0.05] bg-transparent text-muted-foreground dark:text-foreground/40 transition-colors hover:text-foreground dark:text-foreground"
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
          <div className="border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-1.5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">5 Permintaan Teratas Aktif (Diajukan)</h3>
                <span title={`Diajukan oleh divisi ${user.divisionName}`}><Info className="h-3.5 w-3.5 text-muted-foreground dark:text-foreground/50 cursor-help hover:text-foreground dark:text-foreground/70" /></span>
              </div>
              <span className="border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/40">Kategori: Diajukan</span>
            </div>

            <div className="divide-y divide-border dark:divide-white/[0.04] max-h-[380px] overflow-y-auto pr-1">
              {consolidatedSubmitted.length === 0 ? (
                <p className="py-8 text-xs text-muted-foreground dark:text-foreground/50 text-center">Tidak ada permintaan yang sesuai dengan filter.</p>
              ) : (
                consolidatedSubmitted.map((row) => (
                  <div key={row.id} className="group flex items-center justify-between px-2 py-2 transition-colors hover:bg-muted dark:hover:bg-accent">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/45">
                        {row.reqType}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-foreground">{row.number} · {row.unitName}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-foreground/50">{row.info}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right">
                        <span className="border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/45">
                          {row.status}
                        </span>
                        <p className="mt-1 font-mono text-[9px] text-muted-foreground dark:text-foreground/45">{row.date}</p>
                      </div>
                      <button
                        onClick={() => setSelectedItem({ type: row.reqType, id: row.id })}
                        className="border border-border dark:border-white/[0.05] p-1.5 text-muted-foreground dark:text-foreground/60 transition-colors hover:bg-muted dark:hover:bg-accent hover:text-foreground dark:text-foreground"
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
            <div className="border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-1.5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">5 Work Order Teratas Aktif (Harus Dikerjakan)</h3>
                <span title={`Ditujukan ke divisi ${user.divisionName}`}><Info className="h-3.5 w-3.5 text-muted-foreground dark:text-foreground/50 cursor-help hover:text-foreground dark:text-foreground/70" /></span>
              </div>
              <span className="border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/40">Kategori: Perlu Dikerjakan</span>
            </div>

            <div className="divide-y divide-border dark:divide-white/[0.04] max-h-[380px] overflow-y-auto pr-1">
              {assignedWo.length === 0 ? (
                <p className="py-8 text-xs text-muted-foreground dark:text-foreground/50 text-center">Tidak ada Work Order yang sesuai dengan filter.</p>
              ) : (
                assignedWo.map((row) => (
                  <div key={row.id} className="group flex items-center justify-between px-2 py-2 transition-colors hover:bg-muted dark:hover:bg-accent">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0 border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/45">
                        WO
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{row.number} · {row.unitName}</p>
                        <p className="text-[10px] text-muted-foreground dark:text-foreground/50 mt-0.5">{row.info}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right">
                        <span className="border border-border dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/45">
                          {row.status}
                        </span>
                        <p className="mt-1 font-mono text-[9px] text-muted-foreground dark:text-foreground/45">{row.date}</p>
                      </div>
                      <button
                        onClick={() => setSelectedItem({ type: "WO", id: row.id })}
                        className="border border-border dark:border-white/[0.05] p-1.5 text-muted-foreground dark:text-foreground/60 transition-colors hover:bg-muted dark:hover:bg-accent hover:text-foreground dark:text-foreground"
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
          <div className="relative border border-border dark:border-white/[0.05] bg-card dark:bg-card px-3 py-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/50">Menu Request Cepat (Inline Form)</h3>
              <span title="Isi rincian permintaan langsung dan submit secara instan"><Info className="h-3.5 w-3.5 text-muted-foreground dark:text-foreground/50 cursor-help hover:text-foreground dark:text-foreground/70" /></span>
            </div>

            {/* Notifications */}
            {composerSuccess && (
              <div className="border border-success/30 px-3 py-2 text-[10px] text-success">
                {composerSuccess}
              </div>
            )}
            {composerError && (
              <div className="border border-destructive/30 px-3 py-2 text-[10px] text-destructive">
                {composerError}
              </div>
            )}

            {/* Dynamic Form render depending on selected inline tab */}
            <form onSubmit={handleComposerSubmit} className="space-y-3 text-xs text-foreground dark:text-foreground/80">
              
              {/* WO INLINE FORM FIELDS */}
              {activeFormTab === "WO" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Unit Kendaraan</label>
                      <StrictSearchSelect
                        value={woForm.carId}
                        options={unitsList}
                        onChange={(value) => setWoForm({
                          ...woForm,
                          carId: value,
                          items: woForm.items.map((item) => ({ ...item, panelName: "", qty: 1 })),
                        })}
                        placeholder="Cari unit"
                        accent="amber"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Tujuan Divisi</label>
                      <StrictSearchSelect
                        value={woForm.toDivisionId}
                        options={divisionsList}
                        onChange={(value) => setWoForm({ ...woForm, toDivisionId: value })}
                        placeholder="Cari divisi"
                        accent="amber"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
	                    <div className="space-y-1.5">
	                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Target Selesai</label>
                      <input
                        type="date"
                        value={woForm.requestDate}
                        onChange={(e) => setWoForm({ ...woForm, requestDate: e.target.value })}
                        className="h-8 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6 pl-1.5">
                      <input
                        type="checkbox"
                        id="inline-wo-prio"
                        checked={woForm.isPriority}
                        onChange={(e) => setWoForm({ ...woForm, isPriority: e.target.checked })}
                        className="h-4 w-4 text-app-accent-ink rounded bg-transparent border-border focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="inline-wo-prio" className="text-muted-foreground dark:text-foreground/60 font-semibold cursor-pointer text-[10px]">Urgent / Prioritas</label>
                    </div>
                  </div>

	                  <div className="space-y-2 border-t border-border dark:border-white/[0.05] pt-3">
	                    <div className="flex items-center justify-between">
	                      <span className="text-[9px] font-bold text-app-accent-ink uppercase tracking-wide">Daftar Pekerjaan ({woForm.items.length})</span>
	                      <button
	                        type="button"
	                        onClick={() => setWoForm({
	                          ...woForm,
		                          items: [...woForm.items, { panelName: "", qty: 1, jobDetail: "" }],
	                        })}
	                        className="flex items-center gap-1 text-[10px] font-semibold text-app-accent-ink hover:text-app-accent-ink"
	                      >
	                        <Plus className="h-3 w-3" />
	                        Tambah
	                      </button>
	                    </div>

	                    <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
	                      {woForm.items.map((item, idx) => (
	                        <div key={idx} className="space-y-2 border border-border dark:border-white/[0.05] bg-muted dark:bg-background p-3">
	                          <div className="flex items-center justify-between">
	                            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Pekerjaan #{idx + 1}</span>
	                            {woForm.items.length > 1 && (
	                              <button
	                                type="button"
	                                onClick={() => setWoForm({ ...woForm, items: woForm.items.filter((_, itemIndex) => itemIndex !== idx) })}
	                                className="text-destructive hover:text-destructive"
	                              >
	                                <Trash2 className="h-3.5 w-3.5" />
	                              </button>
	                            )}
	                          </div>

		                          <div className="grid grid-cols-[1fr_96px] gap-2">
                            <SearchSelect
                              value={item.panelName}
                              options={woPanelOptions}
                              onChange={(value, option) => {
                                const copy = [...woForm.items];
                                copy[idx] = { ...copy[idx], panelName: value, qty: option?.qty ?? copy[idx].qty };
                                setWoForm({ ...woForm, items: copy });
                              }}
			                            placeholder={!woForm.carId ? "Pilih unit dulu" : "Cari master panel"}
			                            disabled={!woForm.carId}
			                            isLoading={isLoadingWoPanels}
			                            accent="amber"
			                          />
		                            <label className="space-y-1">
		                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Qty</span>
		                              <input
		                                type="number"
		                                min={1}
		                                value={item.qty}
		                                onChange={(e) => {
		                                  const copy = [...woForm.items];
		                                  copy[idx] = { ...copy[idx], qty: Number(e.target.value) };
		                                  setWoForm({ ...woForm, items: copy });
		                                }}
		                                className="h-10 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
		                              />
		                            </label>
		                          </div>

	                          <textarea
	                            value={item.jobDetail}
	                            onChange={(e) => {
	                              const copy = [...woForm.items];
	                              copy[idx] = { ...copy[idx], jobDetail: e.target.value };
	                              setWoForm({ ...woForm, items: copy });
	                            }}
	                            placeholder="Detail pekerjaan item ini..."
	                            className="w-full min-h-[58px] border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 py-2 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
	                          />
	                        </div>
	                      ))}
	                    </div>
	                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Catatan Tambahan (Optional)</label>
                    <input
                      type="text"
                      value={woForm.notes}
                      onChange={(e) => setWoForm({ ...woForm, notes: e.target.value })}
                      placeholder="Catatan pengerjaan jika ada..."
                      className="h-8 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
                    />
                  </div>
                </div>
              )}

              {/* PR INLINE FORM FIELDS */}
              {activeFormTab === "PR" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Unit Kendaraan</label>
                      <StrictSearchSelect
                        value={prForm.carId}
                        options={unitsList}
                        onChange={(value) => setPrForm({
                          ...prForm,
                          carId: value,
                          items: prForm.items.map((item) =>
                            item.itemSourceType === "MASTER_PANEL" ? { ...item, itemName: "", qty: 1 } : item,
                          ),
                        })}
                        placeholder="Cari unit"
                        accent="purple"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Prioritas PR</label>
                      <StrictSearchSelect
                        value={prForm.priority}
                        options={priorityOptions}
                        onChange={(value) => setPrForm({ ...prForm, priority: value })}
                        placeholder="Cari prioritas"
                        accent="purple"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Target Tiba (Optional)</label>
                      <input
                        type="date"
                        value={prForm.targetDate}
                        onChange={(e) => setPrForm({ ...prForm, targetDate: e.target.value })}
                      className="h-8 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Keterangan / Notes</label>
	                      <input
	                        type="text"
	                        value={prForm.notes}
	                        onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })}
	                        placeholder="Contoh: Belanja sparepart"
	                        className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2.5 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground dark:bg-card dark:text-foreground dark:placeholder:text-foreground/35 focus:border-primary/30"
	                      />
                    </div>
                  </div>

                  {/* PR Items sublist */}
                  <div className="border-t border-border dark:border-white/[0.05] pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-info uppercase tracking-wide">Daftar Barang ({prForm.items.length})</span>
                      <button
                        type="button"
                        onClick={() => setPrForm({
                          ...prForm,
	                          items: [...prForm.items, { itemSourceType: "MASTER_PANEL", itemName: "", description: "", originType: "LOKAL", qty: 1, uom: "pcs", estimatedPrice: 0, photoUrl: "", uploading: false }]
                        })}
                        className="text-[9px] text-info hover:text-info font-bold uppercase flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Tambah Baris
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                      {prForm.items.map((item, idx) => (
                        <div key={idx} className="relative space-y-2 border border-border dark:border-white/[0.05] bg-muted dark:bg-background p-3">
                          {prForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPrForm({ ...prForm, items: prForm.items.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 text-muted-foreground dark:text-foreground/45 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
	                          <div className="grid grid-cols-2 gap-2">
	                            <div className="space-y-1.5">
	                              <div className="grid grid-cols-2 gap-1 border border-border dark:border-white/[0.05] bg-card p-1 dark:bg-background">
	                                {(["MASTER_PANEL", "OTHER"] as const).map((mode) => (
	                                  <button
	                                    key={mode}
	                                    type="button"
	                                    onClick={() => {
	                                      const copy = [...prForm.items];
	                                      copy[idx] = { ...copy[idx], itemSourceType: mode, itemName: "", qty: mode === "MASTER_PANEL" ? 1 : copy[idx].qty };
	                                      setPrForm({ ...prForm, items: copy });
	                                    }}
	                                    className={`px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
	                                      item.itemSourceType === mode ? "bg-info/15 text-info" : "text-muted-foreground hover:text-foreground"
	                                    }`}
	                                  >
	                                    {mode === "MASTER_PANEL" ? "Panel/Parts" : "Lainnya"}
	                                  </button>
	                                ))}
	                              </div>
	                              {item.itemSourceType === "MASTER_PANEL" ? (
	                                <SearchSelect
	                                  value={item.itemName}
	                                  options={prPanelOptions}
	                                  onChange={(value, option) => {
	                                    const copy = [...prForm.items];
	                                    copy[idx] = { ...copy[idx], itemName: value, qty: option?.qty ?? copy[idx].qty };
	                                    setPrForm({ ...prForm, items: copy });
	                                  }}
	                                  placeholder={!prForm.carId ? "Pilih unit dulu" : "Cari panel/parts"}
	                                  disabled={!prForm.carId}
	                                  isLoading={isLoadingPrPanels}
	                                  accent="purple"
	                                />
	                              ) : (
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
	                                  className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                                />
	                              )}
	                            </div>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const copy = [...prForm.items];
                                copy[idx] = { ...copy[idx], description: e.target.value };
                                setPrForm({ ...prForm, items: copy });
                              }}
                              placeholder="Keterangan / Merk"
                              className="h-8 border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
                            />
                          </div>

	                          <div className="grid grid-cols-3 gap-2">
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Qty</span>
	                              <input
	                                type="number"
	                                required
	                                value={item.qty}
	                                onChange={(e) => {
	                                  const copy = [...prForm.items];
	                                  copy[idx] = { ...copy[idx], qty: Number(e.target.value) };
	                                  setPrForm({ ...prForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">UOM</span>
	                              <input
	                                type="text"
	                                required
	                                value={item.uom}
	                                onChange={(e) => {
	                                  const copy = [...prForm.items];
	                                  copy[idx] = { ...copy[idx], uom: e.target.value };
	                                  setPrForm({ ...prForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Est. Harga</span>
	                              <input
	                                type="number"
	                                required
	                                value={item.estimatedPrice}
	                                onChange={(e) => {
	                                  const copy = [...prForm.items];
	                                  copy[idx] = { ...copy[idx], estimatedPrice: Number(e.target.value) };
	                                  setPrForm({ ...prForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
	                          </div>

                          {/* Lampirkan Foto / R2 Upload */}
                          <div className="flex items-center justify-between border border-border dark:border-white/[0.05] bg-card dark:bg-card p-2">
                            {item.photoUrl ? (
                              <div className="flex items-center gap-2">
                                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border dark:border-white/10">
                                  <Image src={item.photoUrl} alt="uploaded" fill sizes="28px" className="object-cover" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...prForm.items];
                                    copy[idx] = { ...copy[idx], photoUrl: "" };
                                    setPrForm({ ...prForm, items: copy });
                                  }}
                                  className="text-[8px] font-bold text-destructive hover:underline"
                                >
                                  Hapus Foto
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1.5 text-[9px] text-info/80 hover:text-info cursor-pointer">
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
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Unit Kendaraan</label>
                      <StrictSearchSelect
                        value={wovForm.carId}
                        options={unitsList}
                        onChange={(value) => setWovForm({
                          ...wovForm,
                          carId: value,
                          items: wovForm.items.map((item) =>
                            item.itemSourceType === "MASTER_PANEL" ? { ...item, itemName: "", quantity: 1, goodsConditionOut: "" } : item,
                          ),
                        })}
                        placeholder="Cari unit"
                        accent="sky"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Nama Vendor</label>
                      <StrictSearchSelect
                        value={wovForm.vendorName}
                        options={vendorsList}
                        onChange={(value) => setWovForm({ ...wovForm, vendorName: value })}
                        placeholder="Cari vendor"
                        accent="sky"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Tanggal Kembali</label>
                      <input
                        type="date"
                        value={wovForm.targetDateReturn}
                        onChange={(e) => setWovForm({ ...wovForm, targetDateReturn: e.target.value })}
                        className="h-8 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-muted-foreground dark:text-foreground/50 pl-0.5">Remarks / Catatan</label>
                      <input
                        type="text"
                        value={wovForm.remarks}
                        onChange={(e) => setWovForm({ ...wovForm, remarks: e.target.value })}
                        placeholder="Contoh: Oven Cat ulang"
                        className="h-8 w-full border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-2.5 text-[11px] text-foreground dark:text-foreground outline-none focus:border-primary/30"
                      />
                    </div>
                  </div>

                  {/* WOV Items Sublist */}
                  <div className="border-t border-border dark:border-white/[0.05] pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-info uppercase tracking-wide">Pekerjaan Vendor ({wovForm.items.length})</span>
                      <button
                        type="button"
                        onClick={() => setWovForm({
                          ...wovForm,
	                          items: [...wovForm.items, { itemSourceType: "MASTER_PANEL", itemName: "", quantity: 1, uom: "pcs", goodsConditionOut: "", estimatedCost: 0 }]
                        })}
                        className="text-[9px] text-info hover:text-info font-bold uppercase flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Tambah Baris
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                      {wovForm.items.map((item, idx) => (
                        <div key={idx} className="relative space-y-2 border border-border dark:border-white/[0.05] bg-muted dark:bg-background p-3">
                          {wovForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setWovForm({ ...wovForm, items: wovForm.items.filter((_, i) => i !== idx) })}
                              className="absolute top-2 right-2 text-muted-foreground dark:text-foreground/45 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
	                          <div className="grid grid-cols-2 gap-2">
	                            <div className="space-y-1.5">
	                              <div className="grid grid-cols-2 gap-1 border border-border dark:border-white/[0.05] bg-card p-1 dark:bg-background">
	                                {(["MASTER_PANEL", "OTHER"] as const).map((mode) => (
	                                  <button
	                                    key={mode}
	                                    type="button"
	                                    onClick={() => {
	                                      const copy = [...wovForm.items];
	                                      copy[idx] = {
	                                        ...copy[idx],
	                                        itemSourceType: mode,
	                                        itemName: "",
	                                        quantity: mode === "MASTER_PANEL" ? 1 : copy[idx].quantity,
	                                        goodsConditionOut: mode === "MASTER_PANEL" ? "" : copy[idx].goodsConditionOut,
	                                      };
	                                      setWovForm({ ...wovForm, items: copy });
	                                    }}
	                                    className={`px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
	                                      item.itemSourceType === mode ? "bg-info/15 text-info" : "text-muted-foreground hover:text-foreground"
	                                    }`}
	                                  >
	                                    {mode === "MASTER_PANEL" ? "Panel/Parts" : "Lainnya"}
	                                  </button>
	                                ))}
	                              </div>
	                              {item.itemSourceType === "MASTER_PANEL" ? (
	                                <SearchSelect
	                                  value={item.itemName}
	                                  options={wovPanelOptions}
	                                  onChange={(value, option) => {
	                                    const copy = [...wovForm.items];
	                                    copy[idx] = {
	                                      ...copy[idx],
	                                      itemName: value,
	                                      quantity: option?.qty ?? copy[idx].quantity,
	                                      goodsConditionOut: option?.defaultConditionType ?? copy[idx].goodsConditionOut,
	                                    };
	                                    setWovForm({ ...wovForm, items: copy });
	                                  }}
	                                  placeholder={!wovForm.carId ? "Pilih unit dulu" : "Cari panel/parts"}
	                                  disabled={!wovForm.carId}
	                                  isLoading={isLoadingWovPanels}
	                                  accent="sky"
	                                />
	                              ) : (
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
	                                  className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                                />
	                              )}
	                            </div>
                            <input
                              type="text"
                              value={item.goodsConditionOut}
                              onChange={(e) => {
                                const copy = [...wovForm.items];
                                copy[idx] = { ...copy[idx], goodsConditionOut: e.target.value };
                                setWovForm({ ...wovForm, items: copy });
                              }}
                              placeholder="Kondisi Fisik Keluar"
                              className="h-8 border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
                            />
                          </div>

	                          <div className="grid grid-cols-3 gap-2">
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Qty</span>
	                              <input
	                                type="number"
	                                required
	                                value={item.quantity}
	                                onChange={(e) => {
	                                  const copy = [...wovForm.items];
	                                  copy[idx] = { ...copy[idx], quantity: Number(e.target.value) };
	                                  setWovForm({ ...wovForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">UOM</span>
	                              <input
	                                type="text"
	                                required
	                                value={item.uom}
	                                onChange={(e) => {
	                                  const copy = [...wovForm.items];
	                                  copy[idx] = { ...copy[idx], uom: e.target.value };
	                                  setWovForm({ ...wovForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
	                            <label className="space-y-1">
	                              <span className="block text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Est. Biaya</span>
	                              <input
	                                type="number"
	                                required
	                                value={item.estimatedCost}
	                                onChange={(e) => {
	                                  const copy = [...wovForm.items];
	                                  copy[idx] = { ...copy[idx], estimatedCost: Number(e.target.value) };
	                                  setWovForm({ ...wovForm, items: copy });
	                                }}
	                                className="h-8 w-full border border-border dark:border-white/[0.05] bg-background px-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/30 dark:bg-card"
	                              />
	                            </label>
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
                className="mt-3 flex h-8 w-full items-center justify-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-50"
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
