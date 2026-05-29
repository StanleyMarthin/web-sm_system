"use client";

import type {
  BubutInvoiceType,
  BubutInvoiceWorkHistory,
} from "@smsystem/contracts/bubut-invoice";
import { CameraOff, ExternalLink, Loader2, PackageX, Printer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BubutInvoiceStatusBadge } from "@/modules/bubut-invoice/components/bubut-invoice-status-badge";
import { fetchBubutInvoiceWorkHistory } from "@/shared/api/bubut-invoice";

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
}: {
  sourceKey: string;
  canRelease: boolean;
  canPrint: boolean;
  onClose: () => void;
  onRelease: (sourceWoId: string, invoiceType: BubutInvoiceType) => void;
}) {
  const [activeTab, setActiveTab] = useState<"work" | "material" | "docs" | "summary">("work");
  const [data, setData] = useState<BubutInvoiceWorkHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setData(null);

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-5xl flex-col border-l border-white/5 bg-[#0a0a0c] text-white shadow-2xl">
        {/* ── HEADER ── */}
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#111114] px-6 py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              Riwayat Pengerjaan WO
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white/90">
              {data?.header.wobNo ?? sourceKey}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {data && <BubutInvoiceStatusBadge status={statusToBadgeStatus(data.header.invoiceStatus)} />}
            <div className="h-6 w-[1px] bg-white/5" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center border border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white transition-colors"
              aria-label="Tutup riwayat pengerjaan"
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
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 rounded-none border border-white/5 bg-[#111114] p-6">
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
              <div className="flex gap-8 border-b border-white/5 px-6">
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
                      "border-b-2 py-3 text-xs font-semibold tracking-wide uppercase transition-colors",
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
              <div className="p-6">
                {activeTab === "work" && (
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
                        {data.materialRows.length > 0 ? (
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
                      documentationUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative overflow-hidden border border-white/5 bg-[#111114]"
                        >
                          <img src={url} alt="" className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />
                          <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-white/10 bg-black/80 p-2 text-center transition-transform duration-300 group-hover:translate-y-0">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white">
                              <ExternalLink className="h-3 w-3" /> Buka
                            </span>
                          </div>
                        </a>
                      ))
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
                
                {activeTab === "summary" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-white/5 bg-[#111114] p-8">
                    <div className="flex flex-col gap-4 border-r border-white/5 pr-6">
                       <h3 className="font-mono text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">Base Cost (Direksi & Customer)</h3>
                       <div className="grid gap-3">
                         <SummaryCard label="Total Jam Kerja" value={data.totals.totalWorkingHourText} />
                         <SummaryCard label="Total Harga Jam Kerja" value={rupiah(data.totals.totalWorkingHourCost)} />
                         <SummaryCard label="Total Bahan" value={rupiah(data.totals.totalMaterial)} />
                         <SummaryCard label="Total Price Bubut" value={rupiah(data.totals.totalBasePrice)} highlight />
                       </div>
                    </div>
                    <div className="flex flex-col gap-4 pl-0 md:pl-2">
                       <h3 className="font-mono text-[10px] font-semibold text-amber-500/50 uppercase tracking-widest mb-1">Markup Cost (Customer Only)</h3>
                       <div className="grid gap-3">
                         <SummaryCard label="UP 235% Customer" value={rupiah(data.totals.customerUpTotal)} />
                         <SummaryCard label="Final Price Customer" value={rupiah(data.totals.customerRoundedTotal)} highlight amber />
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── SIMPLE STICKY FOOTER ACTIONS ── */}
        {data && (
          <footer className="shrink-0 border-t border-white/5 bg-[#111114] px-6 py-4">
            <div className="flex justify-end gap-3">
              {canRelease && !data.header.direksiInvoiceId && (
                <button
                  type="button"
                  onClick={() => onRelease(data.sourceKey, "DIREKSI")}
                  className="border border-amber-500/40 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 transition-colors"
                >
                  Rilis Direksi
                </button>
              )}
              {canRelease && !data.header.customerInvoiceId && (
                <button
                  type="button"
                  onClick={() => onRelease(data.sourceKey, "CUSTOMER")}
                  className="border border-amber-500/40 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-500 hover:bg-amber-500/10 transition-colors"
                >
                  Rilis Customer
                </button>
              )}
              
              {data.header.direksiInvoiceId ? (
                canPrint && (
                  <Link
                    href={`/invoice/wo-bubut/${data.header.direksiInvoiceId}/print`}
                    className="inline-flex items-center gap-2 border border-white bg-white px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-black hover:bg-white/90 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Direksi
                  </Link>
                )
              ) : (
                <button disabled className="inline-flex cursor-not-allowed items-center gap-2 border border-white/20 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-white/20">
                  <Printer className="h-3.5 w-3.5" /> Print Direksi
                </button>
              )}

              {data.header.customerInvoiceId ? (
                canPrint && (
                  <Link
                    href={`/invoice/wo-bubut/${data.header.customerInvoiceId}/print`}
                    className="inline-flex items-center gap-2 border border-white bg-white px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-black hover:bg-white/90 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Customer
                  </Link>
                )
              ) : (
                <button disabled className="inline-flex cursor-not-allowed items-center gap-2 border border-white/20 bg-transparent px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-white/20">
                  <Printer className="h-3.5 w-3.5" /> Print Customer
                </button>
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
      <span className="text-sm text-white/90">{text(value)}</span>
    </div>
  );
}

function SummaryCard({ label, value, highlight, amber }: { label: string; value: string; highlight?: boolean; amber?: boolean }) {
  const colorClass = amber ? "text-amber-500" : "text-white/90";
  const sizeClass = highlight ? "text-sm" : "text-xs";
  
  return (
    <div className="flex items-center justify-between border border-white/5 bg-white/[0.02] p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span className={`font-mono font-bold tracking-wide ${sizeClass} ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}
