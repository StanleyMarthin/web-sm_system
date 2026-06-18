"use client";

/* eslint-disable @next/next/no-img-element */

import type {
  BubutInvoiceSnapshot,
  BubutInvoiceType,
} from "@smsystem/contracts/bubut-invoice";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  fetchBubutInvoicePreview,
  getBubutInvoice,
  updateBubutInvoice,
} from "@/shared/api/bubut-invoice";
import { getProxiedImageUrl } from "@/shared/api/config";

function rupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function BubutInvoiceEditDialog({
  invoiceId,
  onClose,
  onUpdated,
}: {
  invoiceId: number;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [salesInvoiceDate, setSalesInvoiceDate] = useState("");
  const [poNo, setPoNo] = useState("");
  const [poDate, setPoDate] = useState("");
  const [preview, setPreview] = useState<BubutInvoiceSnapshot | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<BubutInvoiceSnapshot | null>(null);
  const [beforePictureUrls, setBeforePictureUrls] = useState<string[]>([]);
  const [afterPictureUrls, setAfterPictureUrls] = useState<string[]>([]);
  const [printDraft, setPrintDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getBubutInvoice(invoiceId)
      .then((data) => {
        if (!alive || !data) return;
        setExistingInvoice(data);
        setSalesInvoiceDate(data.salesInvoiceDate);
        setPoNo(data.poNo ?? "");
        setPoDate(data.poDate ?? "");

        const snapshotPics = data.sourceSnapshot.selectedPictures as { before?: string[], after?: string[] } | undefined;
        setBeforePictureUrls(
          snapshotPics?.before ?? 
          data.pictures.filter(p => p.caption?.toUpperCase().includes("BEFORE")).map(p => p.url)
        );
        setAfterPictureUrls(
          snapshotPics?.after ?? 
          data.pictures.filter(p => p.caption?.toUpperCase().includes("AFTER")).map(p => p.url)
        );
      })
      .catch(() => {
        if (alive) setError("Gagal memuat data invoice.");
      });
    return () => {
      alive = false;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!existingInvoice || !salesInvoiceDate) return;
    let alive = true;
    fetchBubutInvoicePreview({
      sourceWoId: existingInvoice.sourceWoId,
      invoiceType: existingInvoice.invoiceType,
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
  }, [existingInvoice, salesInvoiceDate, poNo, poDate]);

  function togglePicture(kind: "before" | "after", url: string) {
    const setter = kind === "before" ? setBeforePictureUrls : setAfterPictureUrls;
    setter((current) => {
      if (current.includes(url)) return [];
      return [url];
    });
  }

  function confirmUpdate() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBubutInvoice(invoiceId, {
          salesInvoiceDate,
          poNo: poNo || null,
          poDate: poDate || null,
          roundingStep: 1000,
          notes: null,
          beforePictureUrls,
          afterPictureUrls,
        });
        onUpdated();
      } catch {
        setError("Gagal menyimpan perubahan invoice.");
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
        invoiceType={existingInvoice?.invoiceType ?? "DIREKSI"}
        enabled={printDraft}
      />
    ) : null}
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-16 print:hidden">
      <div className="w-full max-w-4xl border border-white/10 bg-card text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-foreground">
              Edit Invoice {existingInvoice?.invoiceType === "CUSTOMER" ? "Customer" : "Direksi"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-auto p-4">
          {/* Input fields */}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Tanggal Invoice</span>
              <input
                type="date"
                value={salesInvoiceDate}
                onChange={(event) => setSalesInvoiceDate(event.target.value)}
                className="h-8 w-full border border-white/10 bg-background px-2 text-[11px] font-mono text-foreground/70 outline-none focus:border-primary/40 [color-scheme:dark]"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">PO No.</span>
              <input
                value={poNo}
                onChange={(event) => setPoNo(event.target.value)}
                className="h-8 w-full border border-white/10 bg-background px-2 text-[11px] font-mono text-foreground/70 outline-none focus:border-primary/40"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">PO Date</span>
              <input
                type="date"
                value={poDate}
                onChange={(event) => setPoDate(event.target.value)}
                className="h-8 w-full border border-white/10 bg-background px-2 text-[11px] font-mono text-foreground/70 outline-none focus:border-primary/40 [color-scheme:dark]"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-3 border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-[11px] font-mono text-destructive">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="mt-4 space-y-4">
              {/* Stat boxes */}
              <div className="grid gap-2 md:grid-cols-4">
                <div className="border border-white/5 bg-background p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">WO</p>
                  <p className="text-[12px] font-mono text-foreground font-semibold">{preview.sourceWobNo}</p>
                </div>
                <div className="border border-white/5 bg-background p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Unit</p>
                  <p className="text-[12px] font-mono text-foreground font-semibold">{preview.carType ?? "-"}</p>
                </div>
                <div className="border border-white/5 bg-background p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Jam Kerja</p>
                  <p className="text-[12px] font-mono text-foreground font-semibold">{preview.totals.totalWorkHourText}</p>
                </div>
                <div className="border border-white/5 bg-background p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Total Bubut</p>
                  <p className="text-[12px] font-mono text-foreground font-semibold">{rupiah(preview.totals.totalPriceBubut)}</p>
                </div>
              </div>

              {/* Material table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Material</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Qty</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Harga</th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.materials.map((item) => (
                    <tr key={`${item.no}-${item.materialName}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 text-[11px] font-mono text-foreground/70">{item.materialName}</td>
                      <td className="py-2 text-[11px] font-mono text-foreground/70">{item.qty} {item.unit ?? ""}</td>
                      <td className="py-2 text-[11px] font-mono text-foreground/70">{rupiah(item.price)}</td>
                      <td className="py-2 text-[11px] font-mono text-foreground/70">{rupiah(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {existingInvoice?.invoiceType === "CUSTOMER" ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="border border-white/5 bg-background p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">UP 235%</p>
                    <p className="text-[12px] font-mono font-semibold text-app-accent-ink">{rupiah(preview.totals.priceAfterMarkup)}</p>
                  </div>
                  <div className="border border-white/5 bg-background p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">Price Rounding</p>
                    <p className="text-[12px] font-mono font-semibold text-app-accent-ink">{rupiah(preview.totals.priceRounding)}</p>
                  </div>
                </div>
              ) : null}

              <div className="border border-white/5 bg-background p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/30">
                      Dokumentasi Invoice
                    </p>
                    <p className="mt-1 text-[11px] text-foreground/45">
                      Pilih foto yang akan ditempel sebagai before dan after di invoice.
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/25">
                    Before {beforePictureUrls.length}/1 · After {afterPictureUrls.length}/1
                  </p>
                </div>
                {preview.pictures.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {preview.pictures.map((picture, index) => {
                      const resolvedUrl = getProxiedImageUrl(picture.url) ?? picture.url;
                      const isBefore = beforePictureUrls.includes(picture.url);
                      const isAfter = afterPictureUrls.includes(picture.url);

                      return (
                        <div
                          key={`${picture.url}-${index}`}
                          className={[
                            "overflow-hidden border bg-card",
                            isBefore || isAfter ? "border-primary/50" : "border-white/5",
                          ].join(" ")}
                        >
                          <img
                            src={resolvedUrl}
                            alt={picture.caption ?? ""}
                            className="aspect-square w-full object-cover"
                          />
                          <div className="grid grid-cols-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => togglePicture("before", picture.url)}
                              className={[
                                "h-8 border-r border-white/5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                                isBefore
                                  ? "bg-primary/15 text-app-accent-ink"
                                  : "text-foreground/45 hover:bg-white/[0.04] hover:text-foreground/75",
                              ].join(" ")}
                            >
                              Before
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePicture("after", picture.url)}
                              className={[
                                "h-8 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                                isAfter
                                  ? "bg-info/15 text-info"
                                  : "text-foreground/45 hover:bg-white/[0.04] hover:text-foreground/75",
                              ].join(" ")}
                            >
                              After
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 px-3 py-8 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/30">
                    Belum ada dokumentasi untuk WO ini
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 font-mono text-[11px] text-foreground/30">Memuat preview...</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
          <button
            type="button"
            onClick={printPreviewDraft}
            disabled={!preview}
            className="border border-white/10 h-8 px-3 text-[10px] font-mono uppercase text-foreground/55 hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Print Draft
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 h-8 px-3 text-[10px] font-mono uppercase text-foreground/40 hover:text-foreground transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || !preview}
            onClick={confirmUpdate}
            className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground transition-colors hover:bg-primary disabled:opacity-50"
          >
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
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
    <main className="hidden bg-white p-10 text-primary-foreground print:block">
      <section className="border border-black p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
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
              <th key={label} className="border border-black bg-muted px-2 py-1 text-left uppercase">
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
              <th key={label} className="border border-black bg-muted px-2 py-1 text-left uppercase">
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
                <td className="border border-black bg-muted px-2 py-1 font-bold">Price Rounding</td>
                <td className="border border-black bg-muted px-2 py-1 text-right font-bold">{rupiah(preview.totals.priceRounding)}</td>
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
                <td className="border border-black bg-muted px-2 py-1 font-bold">Total Price Bubut</td>
                <td className="border border-black bg-muted px-2 py-1 text-right font-bold">{rupiah(preview.totals.totalPriceBubut)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </main>
  );
}
