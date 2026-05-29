"use client";

import { useState } from "react";
import { Eye, ArrowRight, ClipboardList, ShoppingBag, Truck, Calendar, Sparkles } from "lucide-react";
import { RequestDetailDialog } from "./request-detail-dialog";

interface RequestsBoardShellProps {
  user: any;
  woPayload: any;
  prPayload: any;
  vendorPayload: any;
}

export function RequestsBoardShell({
  user,
  woPayload,
  prPayload,
  vendorPayload
}: RequestsBoardShellProps) {
  const [selectedItem, setSelectedItem] = useState<{ type: "WO" | "PR" | "WOV"; id: string } | null>(null);
  const isDivisionLeadScope =
    !user?.scope?.canViewAllUnits &&
    user?.roleProfile?.scopeBasis === "ASSIGNED_DIVISIONS" &&
    user?.roleProfile?.approvalRank === 1;

  // Group requests
  // 1. DIAJUKAN (Created/submitted by user's division)
  const submittedWo = woPayload.data
    .filter((w: any) => !isDivisionLeadScope || w.fromDivisionName === user.divisionName)
    .map((w: any) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, details: w.jobDetail }));

  const submittedPr = prPayload.data
    .filter((p: any) => !isDivisionLeadScope || p.divisionName === user.divisionName)
    .map((p: any) => ({ ...p, reqType: "PR" as const, id: p.prId, number: p.prNumber, date: p.createdAt.split("T")[0], details: `${p.totalItems} item barang diajukan` }));

  const submittedWov = vendorPayload.data
    .filter((v: any) => !isDivisionLeadScope || v.divisionName === user.divisionName)
    .map((v: any) => ({ ...v, reqType: "WOV" as const, id: v.wovId, number: v.wovNumber, date: v.createdAt.split("T")[0], details: `${v.itemName} ke ${v.vendorName}` }));

  const submittedRequests = [...submittedWo, ...submittedPr, ...submittedWov]
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  // 2. PERLU DIKERJAKAN (Work Orders assigned to the user's division)
  const assignedWo = woPayload.data
    .filter((w: any) => !isDivisionLeadScope || w.toDivisionName === user.divisionName)
    .map((w: any) => ({ ...w, reqType: "WO" as const, id: w.woId, number: w.woNumber, date: w.requestDate, details: w.jobDetail }))
    .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

  return (
    <>
      <div className="space-y-6 print:hidden">
      
      {/* SECTION 1: DIAJUKAN */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b border-gray-300 dark:border-white/[0.06] pb-2">
          <div>
            <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Daftar Permintaan Diajukan</span>
            </h3>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-white/30">Semua WO, PR, dan WOV yang dibuat oleh divisi Anda ({user.divisionName})</p>
          </div>
          <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-gray-400 dark:text-white/40">
            Total: {submittedRequests.length}
          </span>
        </div>

        {submittedRequests.length === 0 ? (
          <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-8 text-center text-[11px] text-gray-500 dark:text-white/30">
            Belum ada permintaan yang diajukan.
          </div>
        ) : (
          <div className="grid max-h-[480px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {submittedRequests.map((card: any) => (
              <div
                key={card.id}
                onClick={() => setSelectedItem({ type: card.reqType, id: card.id })}
                className="group relative flex cursor-pointer flex-col justify-between border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 transition-colors hover:border-amber-500/30 hover:bg-gray-100 dark:hover:bg-white/[0.02]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                      {card.reqType}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-white/40">{card.number}</span>
                  </div>

                  <h4 className="mt-2 text-[12px] font-medium text-gray-950 dark:text-white group-hover:text-amber-400 transition-colors">
                    {card.unitName || "Unit Umum"}
                  </h4>
                  <p className="mt-1 text-[11px] text-gray-600 dark:text-white/45 line-clamp-2">
                    {card.details || "Tidak ada detail kerja."}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-gray-300 dark:border-white/[0.05] pt-2 text-[10px] text-gray-500 dark:text-white/30">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-mono">{card.date}</span>
                  </span>
                  <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                    {card.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: PERLU DIKERJAKAN */}
      <section className="space-y-2">
        <div className="flex items-center justify-between border-b border-gray-300 dark:border-white/[0.06] pb-2">
          <div>
            <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
              <ClipboardList className="h-3.5 w-3.5 text-emerald-400" />
              <span>Daftar Tugas Perlu Dikerjakan</span>
            </h3>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-white/30">Work Orders yang ditugaskan ke divisi Anda ({user.divisionName})</p>
          </div>
          <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-gray-400 dark:text-white/40">
            Total: {assignedWo.length}
          </span>
        </div>

        {assignedWo.length === 0 ? (
          <div className="border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-4 py-8 text-center text-[11px] text-gray-500 dark:text-white/30">
            Tidak ada Work Order yang perlu dikerjakan saat ini.
          </div>
        ) : (
          <div className="grid max-h-[480px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {assignedWo.map((card: any) => (
              <div
                key={card.id}
                onClick={() => setSelectedItem({ type: "WO", id: card.id })}
                className="group relative flex cursor-pointer flex-col justify-between border border-gray-300 dark:border-white/[0.05] bg-white dark:bg-[#111114] px-3 py-3 transition-colors hover:border-amber-500/30 hover:bg-gray-100 dark:hover:bg-white/[0.02]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                      WO
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-white/40">{card.number}</span>
                  </div>

                  <h4 className="mt-2 text-[12px] font-medium text-gray-950 dark:text-white group-hover:text-amber-400 transition-colors">
                    {card.unitName || "Unit Umum"}
                  </h4>
                  <p className="mt-1 text-[11px] text-gray-600 dark:text-white/45 line-clamp-2">
                    {card.details || "Tidak ada detail kerja."}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-gray-300 dark:border-white/[0.05] pt-2 text-[10px] text-gray-500 dark:text-white/30">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className="font-mono">{card.date}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="border border-gray-300 dark:border-white/[0.08] px-2 py-0.5 font-mono uppercase tracking-[0.12em] text-gray-600 dark:text-white/45">
                      {card.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
