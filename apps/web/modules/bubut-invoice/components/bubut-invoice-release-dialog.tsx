"use client";

import type {
  BubutInvoiceSnapshot,
  BubutInvoiceType,
} from "@smsystem/contracts/bubut-invoice";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  fetchBubutInvoicePreview,
  releaseBubutInvoice,
} from "@/shared/api/bubut-invoice";

function rupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function BubutInvoiceReleaseDialog({
  sourceWoId,
  invoiceType,
  onClose,
  onReleased,
}: {
  sourceWoId: string;
  invoiceType: BubutInvoiceType;
  onClose: () => void;
  onReleased: (invoiceId: number) => void;
}) {
  const [salesInvoiceDate, setSalesInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [poNo, setPoNo] = useState("");
  const [poDate, setPoDate] = useState("");
  const [preview, setPreview] = useState<BubutInvoiceSnapshot | null>(null);
  const [printDraft, setPrintDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchBubutInvoicePreview({
      sourceWoId,
      invoiceType,
      salesInvoiceDate,
      poNo: poNo || null,
      poDate: poDate || null,
      roundingStep: 1000,
    })
      .then((data) => {
        if (alive) setPreview(data);
      })
      .catch(() => {
        if (alive) setError("Preview invoice tidak bisa dimuat.");
      });
    return () => {
      alive = false;
    };
  }, [sourceWoId, invoiceType, salesInvoiceDate, poNo, poDate]);

  function confirmRelease() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await releaseBubutInvoice({
          sourceWoId,
          invoiceType,
          salesInvoiceDate,
          poNo: poNo || null,
          poDate: poDate || null,
          roundingStep: 1000,
          notes: null,
        });
        onReleased(result.invoiceId);
      } catch {
        setError("Invoice gagal dirilis. Pastikan belum ada invoice aktif untuk tipe ini.");
      }
    });
  }

  function printPreviewDraft() {
    if (!preview) return;
    setPrintDraft(true);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <>
    {preview ? (
      <DraftPrintView
        preview={preview}
        invoiceType={invoiceType}
        enabled={printDraft}
      />
    ) : null}
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 print:hidden">
      <div className="w-full max-w-4xl border border-white/10 bg-[#111114] text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">
              Rilis Invoice
            </p>
            <h2 className="text-[13px] font-mono text-white">
              {invoiceType === "DIREKSI" ? "Invoice Direksi" : "Invoice Customer"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-auto p-4">
          {/* Input fields */}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Tanggal Invoice</span>
              <input
                type="date"
                value={salesInvoiceDate}
                onChange={(event) => setSalesInvoiceDate(event.target.value)}
                className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-2 text-[11px] font-mono text-white/70 outline-none focus:border-amber-500/40 [color-scheme:dark]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">PO No.</span>
              <input
                value={poNo}
                onChange={(event) => setPoNo(event.target.value)}
                className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-2 text-[11px] font-mono text-white/70 outline-none focus:border-amber-500/40"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">PO Date</span>
              <input
                type="date"
                value={poDate}
                onChange={(event) => setPoDate(event.target.value)}
                className="h-8 w-full border border-white/10 bg-[#0a0a0c] px-2 text-[11px] font-mono text-white/70 outline-none focus:border-amber-500/40 [color-scheme:dark]"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-3 border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[11px] font-mono text-red-400">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="mt-4 space-y-4">
              {/* Stat boxes */}
              <div className="grid gap-2 md:grid-cols-4">
                <div className="border border-white/5 bg-[#0a0a0c] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">WO</p>
                  <p className="text-[12px] font-mono text-white font-semibold">{preview.sourceWobNo}</p>
                </div>
                <div className="border border-white/5 bg-[#0a0a0c] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Unit</p>
                  <p className="text-[12px] font-mono text-white font-semibold">{preview.carType ?? "-"}</p>
                </div>
                <div className="border border-white/5 bg-[#0a0a0c] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Jam Kerja</p>
                  <p className="text-[12px] font-mono text-white font-semibold">{preview.totals.totalWorkHourText}</p>
                </div>
                <div className="border border-white/5 bg-[#0a0a0c] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Total Bubut</p>
                  <p className="text-[12px] font-mono text-white font-semibold">{rupiah(preview.totals.totalPriceBubut)}</p>
                </div>
              </div>

              {/* Material table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Material</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Qty</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Harga</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.materials.map((item) => (
                    <tr key={`${item.no}-${item.materialName}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 text-[11px] font-mono text-white/70">{item.materialName}</td>
                      <td className="py-2 text-[11px] font-mono text-white/70">{item.qty} {item.unit ?? ""}</td>
                      <td className="py-2 text-[11px] font-mono text-white/70">{rupiah(item.price)}</td>
                      <td className="py-2 text-[11px] font-mono text-white/70">{rupiah(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {invoiceType === "CUSTOMER" ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="border border-white/5 bg-[#0a0a0c] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">UP 235%</p>
                    <p className="text-[12px] font-mono font-semibold text-amber-500">{rupiah(preview.totals.priceAfterMarkup)}</p>
                  </div>
                  <div className="border border-white/5 bg-[#0a0a0c] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Price Rounding</p>
                    <p className="text-[12px] font-mono font-semibold text-amber-500">{rupiah(preview.totals.priceRounding)}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 font-mono text-[11px] text-white/30">Memuat preview...</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
          <button
            type="button"
            onClick={printPreviewDraft}
            disabled={!preview}
            className="border border-white/10 h-8 px-3 text-[10px] font-mono uppercase text-white/55 hover:text-white disabled:opacity-30 transition-colors"
          >
            Print Draft
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 h-8 px-3 text-[10px] font-mono uppercase text-white/40 hover:text-white transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={confirmRelease}
            disabled={!preview || isPending}
            className="border border-amber-500/30 bg-amber-500/[0.04] h-8 px-3 text-[10px] font-mono uppercase text-amber-500 disabled:opacity-30 hover:bg-amber-500/10 transition-colors"
          >
            {isPending ? "Merilis..." : "Konfirmasi Rilis"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function DraftPrintView({
  preview,
  invoiceType,
  enabled,
}: {
  preview: BubutInvoiceSnapshot;
  invoiceType: BubutInvoiceType;
  enabled: boolean;
}) {
  if (!enabled) return null;
  const isCustomer = invoiceType === "CUSTOMER";

  return (
    <main className="hidden bg-white p-10 text-black print:block">
      <section className="border border-black p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
          Draft - Belum Rilis
        </p>
        <div className="mt-2 flex justify-between gap-6 text-[11px]">
          <div>
            <h1 className="text-xl font-black uppercase">Sales Invoice Bubut</h1>
            <p>No Invoice: DRAFT SIB</p>
            <p>No WOB: {preview.sourceWobNo}</p>
            <p>Tanggal: {preview.salesInvoiceDate}</p>
          </div>
          <div>
            <p>Copy: {isCustomer ? "Customer" : "Direksi"}</p>
            <p>Unit: {preview.carType ?? "-"}</p>
            <p>Team/KD: {preview.headProjectName ?? "-"}</p>
            <p>Operator: {preview.operatorName ?? "-"}</p>
            <p>Panel/Part: {preview.sparepartName ?? "-"}</p>
          </div>
        </div>
      </section>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {["No", "Material", "Qty", "Unit", ...(!isCustomer ? ["Price", "Total"] : [])].map((label) => (
              <th key={label} className="border border-black bg-gray-100 px-2 py-1 text-left uppercase">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.materials.length > 0 ? preview.materials.map((item) => (
            <tr key={`${item.no}-${item.materialName}`}>
              <td className="border border-black px-2 py-1">{item.no}</td>
              <td className="border border-black px-2 py-1">{item.materialName}</td>
              <td className="border border-black px-2 py-1">{item.qty}</td>
              <td className="border border-black px-2 py-1">{item.unit ?? "-"}</td>
              {!isCustomer ? <td className="border border-black px-2 py-1 text-right">{rupiah(item.price)}</td> : null}
              {!isCustomer ? <td className="border border-black px-2 py-1 text-right">{rupiah(item.total)}</td> : null}
            </tr>
          )) : (
            <tr>
              <td colSpan={isCustomer ? 4 : 6} className="border border-black px-2 py-3 text-center">
                Tidak ada material
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {["Date", "Start", "Break", "Finish", "Hours", ...(!isCustomer ? ["Total"] : [])].map((label) => (
              <th key={label} className="border border-black bg-gray-100 px-2 py-1 text-left uppercase">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.workingHours.map((item) => (
            <tr key={`${item.no}-${item.date}`}>
              <td className="border border-black px-2 py-1">{item.date}</td>
              <td className="border border-black px-2 py-1">{item.start ?? "-"}</td>
              <td className="border border-black px-2 py-1">{item.break ?? "-"}</td>
              <td className="border border-black px-2 py-1">{item.finish ?? "-"}</td>
              <td className="border border-black px-2 py-1">{item.workingHourText}</td>
              {!isCustomer ? <td className="border border-black px-2 py-1 text-right">{rupiah(item.total)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="ml-auto mt-6 w-80 border-collapse text-[11px]">
        <tbody>
          {isCustomer ? (
            <>
              <tr>
                <td className="border border-black px-2 py-1 font-bold">UP 235%</td>
                <td className="border border-black px-2 py-1 text-right">{rupiah(preview.totals.priceAfterMarkup)}</td>
              </tr>
              <tr>
                <td className="border border-black bg-gray-100 px-2 py-1 font-bold">Price Rounding</td>
                <td className="border border-black bg-gray-100 px-2 py-1 text-right font-bold">{rupiah(preview.totals.priceRounding)}</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td className="border border-black px-2 py-1 font-bold">Total Bahan</td>
                <td className="border border-black px-2 py-1 text-right">{rupiah(preview.totals.materialTotal)}</td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 font-bold">Total Jam Kerja</td>
                <td className="border border-black px-2 py-1 text-right">{rupiah(preview.totals.workingHourTotal)}</td>
              </tr>
              <tr>
                <td className="border border-black bg-gray-100 px-2 py-1 font-bold">Total Price Bubut</td>
                <td className="border border-black bg-gray-100 px-2 py-1 text-right font-bold">{rupiah(preview.totals.totalPriceBubut)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </main>
  );
}
