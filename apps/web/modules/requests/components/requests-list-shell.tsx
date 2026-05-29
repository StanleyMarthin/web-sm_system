"use client";

import { useState } from "react";
import { Search, Eye, Calendar, RotateCcw } from "lucide-react";
import { RequestDetailDialog } from "./request-detail-dialog";

interface RequestsListShellProps {
  user: any;
  woPayload: any;
  prPayload: any;
  vendorPayload: any;
}

export function RequestsListShell({
  user,
  woPayload,
  prPayload,
  vendorPayload
}: RequestsListShellProps) {
  const [selectedItem, setSelectedItem] = useState<{ type: "WO" | "PR" | "WOV"; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [activeTypeTab, setActiveTypeTab] = useState<"ALL" | "WO" | "PR" | "WOV">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "DIAJUKAN" | "PERLU_DIKERJAKAN">("ALL");

  const isDivisionLeadScope =
    !user?.scope?.canViewAllUnits &&
    user?.roleProfile?.scopeBasis === "ASSIGNED_DIVISIONS" &&
    user?.roleProfile?.approvalRank === 1;

  // Filter States
  const [filterUnit, setFilterUnit] = useState<string>("");
  const [filterDivision, setFilterDivision] = useState<string>(
    isDivisionLeadScope ? user?.divisionName || "" : "",
  );
  
  // Date range filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const hasDateFilter = Boolean(startDate || endDate);
  const terminalStatuses = ["DONE", "CLOSED", "REJECTED", "CANCEL", "CANCELLED", "CANCELED", "ARRIVED", "RECEIVED"];

  // References
  const unitsList = woPayload?.references?.units || prPayload?.references?.units || [];
  const divisionsList = woPayload?.references?.divisions || [];

  // Format all entries into their full original structures for granular display
  const allWo = (woPayload?.data || []).map((w: any) => ({
    ...w,
    reqType: "WO" as const,
    id: w.woId,
    number: w.woNumber,
    date: w.requestDate,
    info: w.jobDetail,
    divisionRole: w.fromDivisionName === user.divisionName ? "DIAJUKAN" : w.toDivisionName === user.divisionName ? "PERLU_DIKERJAKAN" : "OTHER"
  }));

  const allPr = (prPayload?.data || []).map((p: any) => ({
    ...p,
    reqType: "PR" as const,
    id: p.prId,
    number: p.prNumber,
    date: p.createdAt ? p.createdAt.split("T")[0] : "-",
    info: `${p.totalItems || 0} Items · Catatan: ${p.notes || "-"}`,
    divisionRole: p.divisionName === user.divisionName ? "DIAJUKAN" : "OTHER"
  }));

  const allWov = (vendorPayload?.data || []).map((v: any) => ({
    ...v,
    reqType: "WOV" as const,
    id: v.wovId,
    number: v.wovNumber,
    date: v.createdAt ? v.createdAt.split("T")[0] : "-",
    info: `Vendor: ${v.vendorName || "-"} · Item: ${v.itemName || "-"}`,
    divisionRole: v.divisionName === user.divisionName ? "DIAJUKAN" : "OTHER"
  }));

  const consolidated = [...allWo, ...allPr, ...allWov]
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // Apply filters
  const filteredData = consolidated.filter((row: any) => {
    // 1. Type filter
    if (activeTypeTab !== "ALL" && row.reqType !== activeTypeTab) return false;

    // 2. Role filter
    if (roleFilter === "DIAJUKAN" && row.divisionRole !== "DIAJUKAN") return false;
    if (roleFilter === "PERLU_DIKERJAKAN" && row.divisionRole !== "PERLU_DIKERJAKAN") return false;

    // Terminal request history is shown only when the user filters by date.
    if (!hasDateFilter && terminalStatuses.includes(row.status)) return false;

    // 3. Unit Filter
    if (filterUnit && row.carId !== filterUnit && row.unitName !== filterUnit) return false;

    // 4. Division Filter
    if (filterDivision) {
      if (row.reqType === "WO") {
        if (row.fromDivisionName?.toLowerCase() !== filterDivision.toLowerCase() && 
            row.toDivisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
      } else {
        if (row.divisionName?.toLowerCase() !== filterDivision.toLowerCase()) return false;
      }
    }

    // 5. Date Range Filter
    const actualDate = row.date || row.requestDate || (row.createdAt && row.createdAt.split("T")[0]);
    if (actualDate && actualDate !== "-") {
      const cleanDate = actualDate.includes("T") ? actualDate.split("T")[0] : actualDate;
      if (startDate && cleanDate < startDate) return false;
      if (endDate && cleanDate > endDate) return false;
    }

    // 6. Text search
    if (search.trim()) {
      const query = search.toLowerCase();
      const numMatch = row.number?.toLowerCase().includes(query);
      const unitMatch = row.unitName?.toLowerCase().includes(query);
      const custMatch = row.customerName?.toLowerCase().includes(query);
      const infoMatch = row.info?.toLowerCase().includes(query);
      return numMatch || unitMatch || custMatch || infoMatch;
    }

    return true;
  });

  const hasActiveFilters =
    (!isDivisionLeadScope ? filterUnit || filterDivision : filterUnit) ||
    startDate ||
    endDate ||
    search;

  return (
    <>
      <div className="space-y-3 print:hidden">

      {/* ── Unified Filter Bar ── */}
      <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 space-y-2">

        {/* Row 1: Role tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRoleFilter("ALL")}
              className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                roleFilter === "ALL"
                  ? "border-amber-500/30 bg-transparent text-amber-300"
                  : "border-gray-300 dark:border-white/[0.08] bg-transparent text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white"
              }`}
            >Semua</button>
            <button
              onClick={() => setRoleFilter("DIAJUKAN")}
              className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                roleFilter === "DIAJUKAN"
                  ? "border-amber-500/30 bg-transparent text-amber-400"
                  : "border-gray-300 dark:border-white/[0.08] bg-transparent text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white"
              }`}
            >Diajukan</button>
            <button
              onClick={() => setRoleFilter("PERLU_DIKERJAKAN")}
              className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                roleFilter === "PERLU_DIKERJAKAN"
                  ? "border-emerald-500/30 bg-transparent text-emerald-400"
                  : "border-gray-300 dark:border-white/[0.08] bg-transparent text-gray-400 dark:text-white/40 hover:text-gray-950 dark:text-white"
              }`}
            >Perlu Dikerjakan</button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-gray-500 dark:text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor / unit / pelanggan..."
              className="h-8 w-64 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] pl-7 pr-3 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30 transition-colors placeholder:text-gray-400 dark:text-white/20"
            />
          </div>
        </div>

        {/* Row 2: Type + Unit + Division + Date range + Reset */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-300 dark:border-white/[0.05] pt-2">
          <select
            value={activeTypeTab}
            onChange={(e) => setActiveTypeTab(e.target.value as "ALL" | "WO" | "PR" | "WOV")}
            className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30"
          >
            <option value="ALL">Semua Jenis</option>
            <option value="WO">Work Order</option>
            <option value="PR">Purchase Request</option>
            <option value="WOV">Vendor WO</option>
          </select>

          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30"
          >
            <option value="">Semua Unit</option>
            {unitsList.map((u: any) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>

          <select
            value={filterDivision}
            disabled={isDivisionLeadScope}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30 disabled:opacity-50"
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

          <div className="ml-auto flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30 [color-scheme:dark]"
            />
            <span className="text-gray-400 dark:text-white/20 text-[10px]">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 border border-gray-300 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0a0a0c] px-2.5 font-mono text-[11px] text-gray-950 dark:text-white outline-none focus:border-amber-500/30 [color-scheme:dark]"
            />
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch(""); setFilterUnit(""); setStartDate(""); setEndDate("");
                  if (!isDivisionLeadScope) setFilterDivision("");
                }}
                title="Reset filter"
                className="flex h-8 w-8 items-center justify-center border border-gray-300 dark:border-white/[0.05] bg-transparent text-gray-400 dark:text-white/40 transition-colors hover:text-gray-950 dark:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Grid Sheet table */}
      <div className="overflow-x-auto border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114]">
        <table className="w-full text-xs text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-white dark:bg-[#111114]">
            <tr className="border-b border-gray-300 dark:border-white/[0.06] bg-white dark:bg-[#111114] font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              {activeTypeTab === "ALL" && (
                <>
                  <th className="px-3 py-2">Tipe</th>
                  <th className="px-3 py-2">Nomor Dokumen</th>
                  <th className="px-3 py-2">Unit Kendaraan</th>
                  <th className="px-3 py-2">Pelanggan</th>
                  <th className="px-3 py-2">Informasi Permintaan</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Tanggal</th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </>
              )}
              {activeTypeTab === "WO" && (
                <>
                  <th className="px-3 py-2">Nomor WO</th>
                  <th className="px-3 py-2">Unit Kendaraan</th>
                  <th className="px-3 py-2">Pelanggan</th>
                  <th className="px-3 py-2">Dari Divisi</th>
                  <th className="px-3 py-2">Ke Divisi</th>
                  <th className="px-3 py-2">Panel / Sektor</th>
                  <th className="px-3 py-2">Detail Pekerjaan</th>
                  <th className="px-3 py-2 text-center">Estimasi</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Tanggal WO</th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </>
              )}
              {activeTypeTab === "PR" && (
                <>
                  <th className="px-3 py-2">Nomor PR</th>
                  <th className="px-3 py-2">Unit Kendaraan</th>
                  <th className="px-3 py-2">Divisi Pembuat</th>
                  <th className="px-3 py-2 text-center">ACC Tracking</th>
                  <th className="px-3 py-2 text-center">Jumlah Item</th>
                  <th className="px-3 py-2 text-right">Total Estimasi Harga</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Tanggal Dibuat</th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </>
              )}
              {activeTypeTab === "WOV" && (
                <>
                  <th className="px-3 py-2">Nomor WOV</th>
                  <th className="px-3 py-2">Unit Kendaraan</th>
                  <th className="px-3 py-2">Divisi Pembuat</th>
                  <th className="px-3 py-2">Partner Vendor</th>
                  <th className="px-3 py-2">Nama Item / Jasa</th>
                  <th className="px-3 py-2 text-center">ACC Tracking</th>
                  <th className="px-3 py-2 text-right">Total Harga</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right">Tanggal Dibuat</th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-16 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-3">
                    <div className="border border-gray-300 dark:border-white/[0.06] p-3 text-gray-500 dark:text-white/30">
                      <Search className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white/80">Pencarian Tidak Ditemukan</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/35 leading-relaxed">
                        Tidak ada data requests yang cocok dengan unit, divisi, rentang tanggal, atau kata kunci pencarian Anda saat ini.
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 pt-2">
                      <button
                        onClick={() => {
                          setSearch("");
                          setFilterUnit("");
                          setStartDate("");
                          setEndDate("");
                          if (!isDivisionLeadScope) setFilterDivision("");
                        }}
                        className="border border-gray-300 dark:border-white/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-950 dark:text-white hover:bg-white/[0.06]"
                      >
                        Reset Pencarian & Filter
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((row: any) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedItem({ type: row.reqType, id: row.id })}
                  className="group cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.02]"
                >
                  {/* Dynamic Render cells based on selected type filter */}
                  {activeTypeTab === "ALL" && (
                    <>
                      <td className="px-3 py-2">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                          {row.reqType}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white/80">{row.number}</td>
                      <td className="px-3 py-2 font-medium text-white/90">{row.unitName || "-"}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-white/60">{row.customerName || "-"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-gray-600 dark:text-white/45" title={row.info}>{row.info || "-"}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 dark:text-white/30">
                        <span className="flex items-center gap-1.5 justify-end">
                          <Calendar className="h-3 w-3 text-gray-400 dark:text-white/20" />
                          <span>{row.date}</span>
                        </span>
                      </td>
                    </>
                  )}

                  {activeTypeTab === "WO" && (
                    <>
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white/80">{row.woNumber}</td>
                      <td className="px-3 py-2 font-medium text-white/90">{row.unitName || "-"}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-white/60">{row.customerName || "-"}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/50">{row.fromDivisionName || "-"}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/50">{row.toDivisionName || "-"}</td>
                      <td className="px-3 py-2 font-mono text-white/65">{row.panelName || "-"}</td>
                      <td className="max-w-[150px] truncate px-3 py-2 text-gray-600 dark:text-white/45" title={row.jobDetail}>{row.jobDetail || "-"}</td>
                      <td className="px-3 py-2 text-center font-mono text-white/65">{row.estimatedHours || 0} Jam</td>
                      <td className="px-3 py-2 text-center">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 dark:text-white/30">{row.requestDate}</td>
                    </>
                  )}

                  {activeTypeTab === "PR" && (
                    <>
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white/80">{row.prNumber}</td>
                      <td className="px-3 py-2 font-medium text-white/90">{row.unitName || "-"}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/50">{row.divisionName || "-"}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                          row.accTracking === "APPROVED" ? "border-emerald-500/30 text-emerald-400" :
                          row.accTracking === "REJECTED" ? "border-red-500/30 text-red-400" : "border-gray-300 dark:border-white/[0.08] text-gray-400 dark:text-white/40"
                        }`}>
                          {row.accTracking || "PENDING"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-white/65">{row.totalItems || 0} Items</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800 dark:text-white/75">
                        Rp {Number(row.totalEstimatedPrice || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 dark:text-white/30">{row.date}</td>
                    </>
                  )}

                  {activeTypeTab === "WOV" && (
                    <>
                      <td className="px-3 py-2 font-mono text-gray-900 dark:text-white/80">{row.wovNumber}</td>
                      <td className="px-3 py-2 font-medium text-white/90">{row.unitName || "-"}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-white/50">{row.divisionName || "-"}</td>
                      <td className="px-3 py-2 text-gray-800 dark:text-white/75">{row.vendorName || "-"}</td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-gray-700 dark:text-white/60" title={row.itemName}>{row.itemName || "-"}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                          row.accTracking === "APPROVED" ? "border-emerald-500/30 text-emerald-400" :
                          row.accTracking === "REJECTED" ? "border-red-500/30 text-red-400" : "border-gray-300 dark:border-white/[0.08] text-gray-400 dark:text-white/40"
                        }`}>
                          {row.accTracking || "PENDING"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800 dark:text-white/75">
                        Rp {Number(row.totalEstimatedPrice || 0).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 dark:text-white/30">{row.date}</td>
                    </>
                  )}

                  {/* Actions column */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem({ type: row.reqType, id: row.id });
                      }}
                      className="border border-gray-300 dark:border-white/[0.05] p-1.5 text-gray-700 dark:text-white/60 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-950 dark:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
