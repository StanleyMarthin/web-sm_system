"use client";

import type { BubutInvoiceSnapshot } from "@smsystem/contracts/bubut-invoice";
import { Printer } from "lucide-react";
import { useState } from "react";

function rupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

// ── Editable inline field ─────────────────────────────────────────────────────
function Editable({
  value,
  onChange,
  style,
  multiline,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}) {
  const base: React.CSSProperties = {
    border: "none",
    borderBottom: "1px dashed #f59e0b",
    background: "transparent",
    outline: "none",
    fontFamily: "inherit",
    fontSize: "inherit",
    color: "inherit",
    fontWeight: "inherit",
    fontStyle: "inherit",
    width: "100%",
    padding: 0,
    margin: 0,
    display: "block",
    ...style,
  };
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        style={{ ...base, resize: "none" }}
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={base}
    />
  );
}

// ── Shared style objects ──────────────────────────────────────────────────────
const thDark: React.CSSProperties = {
  background: "#1a1a1a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 8,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  padding: "5px 6px",
  border: "1px solid #000",
  textAlign: "center",
  whiteSpace: "nowrap",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

const tdBase: React.CSSProperties = {
  border: "1px solid #000",
  padding: "5px 6px",
  fontSize: 9,
  verticalAlign: "middle",
};

const sectionBar: React.CSSProperties = {
  background: "#1a1a1a",
  color: "#fff",
  fontWeight: 700,
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  padding: "3px 8px",
  border: "1px solid #000",
  borderBottom: "none",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
};

// ── Main component ────────────────────────────────────────────────────────────
export function BubutInvoicePrintView({ invoice }: { invoice: BubutInvoiceSnapshot }) {
  const [printMode, setPrintMode] = useState<"DIREKSI" | "CUSTOMER">(
    invoice.invoiceType === "CUSTOMER" ? "CUSTOMER" : "DIREKSI",
  );
  const isCustomer = printMode === "CUSTOMER";

  // Editable fields state
  const [headProject, setHeadProject] = useState(invoice.headProjectName ?? "");
  const [carType, setCarType] = useState(invoice.carType ?? "");
  const [sparepartName, setSparepartName] = useState(invoice.sparepartName ?? "");
  const [qty, setQty] = useState(String(invoice.qty ?? ""));
  const [qtyUnit, setQtyUnit] = useState(invoice.qtyUnit ?? "pcs");
  const [poNo, setPoNo] = useState(invoice.invoiceNo ?? "");
  const [poDate, setPoDate] = useState(invoice.woDate ?? "");
  const [operator, setOperator] = useState(invoice.operatorName ?? "");
  const [costLabour, setCostLabour] = useState("");
  const [detailProses, setDetailProses] = useState(invoice.processDetailText ?? "");
  const [sigName1, setSigName1] = useState(invoice.operatorName ?? "Sahrul Riswanto");
  const [sigName2, setSigName2] = useState(invoice.headProjectName ?? "");
  const [sigName3, setSigName3] = useState("Chrecentia Wenny K");
  const [sigName4, setSigName4] = useState("Widya Fitri");

  // Pad rows to minimum
  const matRows = [...invoice.materials];
  while (matRows.length < 3) matRows.push(null as any);
  const whRows = [...invoice.workingHours];
  while (whRows.length < 9) whRows.push(null as any);

  const sigCols = [
    { label: "Dibuat oleh,", sub: "Administrasi Oprasional", name: sigName1, setName: setSigName1 },
    { label: "Diketahui oleh,", sub: "Project Manager", name: sigName2, setName: setSigName2 },
    { label: "Diketahui oleh,", sub: "SPV Finance Accounting", name: sigName3, setName: setSigName3 },
    { label: "Disetujui oleh,", sub: "Office Manager", name: sigName4, setName: setSigName4 },
  ];

  return (
    <>
      {/* ── SCREEN TOPBAR ── */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#111114] px-5 h-11">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="font-mono text-[11px] text-white/40 hover:text-white transition-colors"
        >
          ← Kembali
        </button>
        <span className="font-mono text-[10px] text-white/20">
          ✏ Klik field bergaris untuk edit
        </span>
        <div className="flex items-center gap-2">
          <div className="flex border border-white/10 h-8">
            <button
              type="button"
              onClick={() => setPrintMode("DIREKSI")}
              className={`px-3 h-full text-[10px] font-mono uppercase tracking-[0.1em] transition-colors border-r ${printMode === "DIREKSI"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                : "text-white/35 hover:text-white/60 border-white/10"
                }`}
            >
              Direksi
            </button>
            <button
              type="button"
              onClick={() => setPrintMode("CUSTOMER")}
              className={`px-3 h-full text-[10px] font-mono uppercase tracking-[0.1em] transition-colors ${printMode === "CUSTOMER"
                ? "bg-sky-500/10 text-sky-400"
                : "text-white/35 hover:text-white/60"
                }`}
            >
              Customer
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/[0.04] h-8 px-3 text-[10px] font-mono uppercase tracking-[0.1em] text-amber-500 hover:bg-amber-500/10 transition-colors"
          >
            <Printer className="h-3 w-3" />
            Print {isCustomer ? "Customer" : "Direksi"}
          </button>
        </div>
      </div>

      {/* ── PAGE WRAPPER ── */}
      <main
        style={{ background: "#1a1a1e", minHeight: "100vh", paddingTop: 44 }}
        className="print:pt-0 print:bg-white print:min-h-0 print:block"
      >
        <div
          className="w-[210mm] print:w-full shadow-2xl print:shadow-none print:my-0 print:mx-0 mx-auto my-6 bg-white text-black box-border"
          style={{
            padding: "0",
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: 10,
          }}
        >
          {/* ── HEADER ── */}
          <div style={{ borderTop: "2px solid #000", paddingTop: 6, marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Left */}
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", lineHeight: 1 }}>
                  SALES INVOICE
                </div>
              </div>
              {/* Right */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>STANLEY MARTHIN</div>
                  <div style={{ fontSize: 8, color: "#555", lineHeight: 1.5 }}>
                    Jl. Padasaluyu Utara II No. 8 Sukasari<br />Isola Bandung
                  </div>
                </div>
                <img src="/sm.jpeg" alt="SM" style={{ width: 48, height: 48, objectFit: "contain" }} />
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #000", marginTop: 5, borderBottom: "2px solid #000", marginBottom: 8 }} />

          {/* ── INFO BLOCK ── */}
          <div style={{ display: "flex", gap: 0, marginBottom: 10 }}>
            {/* Left box */}
            <div style={{ flex: "0 0 58%", padding: "8px 12px" }}>
              {[
                { label: "HEAD PROJECT", value: headProject, set: setHeadProject },
                { label: "CAR TYPE", value: carType, set: setCarType },
                { label: "SPAREPART NAME", value: sparepartName, set: setSparepartName },
              ].map(({ label, value, set }) => (
                <div key={label} style={{ display: "flex", alignItems: "baseline", marginBottom: 4, gap: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 9, textTransform: "uppercase", minWidth: 106, flexShrink: 0 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 9, marginRight: 3 }}>:</span>
                  <Editable value={value} onChange={set} style={{ fontSize: 10 }} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 9, textTransform: "uppercase", minWidth: 106, flexShrink: 0 }}>QTY</span>
                <span style={{ fontSize: 9, marginRight: 3 }}>:</span>
                <Editable value={qty} onChange={setQty} style={{ fontSize: 10, width: 60 }} />
                <Editable value={qtyUnit} onChange={setQtyUnit} style={{ fontSize: 10, width: 48 }} />
              </div>
            </div>
            {/* Right box */}
            <div style={{ flex: 1, padding: "8px 12px" }}>
              {[
                { label: "PO No.", value: poNo, set: setPoNo },
                { label: "PO DATE", value: poDate, set: setPoDate },
              ].map(({ label, value, set }) => (
                <div key={label} style={{ display: "flex", alignItems: "baseline", marginBottom: 4, gap: 4 }}>
                  <span style={{ fontSize: 9, color: "#555", minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 9, color: "#555", marginRight: 3 }}>:</span>
                  <Editable value={value} onChange={set} style={{ fontSize: 10 }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── SECTION I: MATERIAL USE ── */}
          <div style={sectionBar}>I. MATERIAL USE</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thDark, width: 22 }}>NO</th>
                <th style={{ ...thDark, textAlign: "left" }}>TYPE OF MATERIAL</th>
                <th style={{ ...thDark, width: 38 }}>QTY</th>
                <th style={{ ...thDark, width: 44 }}>QUOM</th>
                <th style={{ ...thDark, width: 80, textAlign: "right" }}>PRICE</th>
                <th style={{ ...thDark, width: 90, textAlign: "right" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {matRows.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdBase, textAlign: "center" }}>{item?.no ?? ""}</td>
                  <td style={tdBase}>{item?.materialName ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center" }}>{item?.qty ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center" }}>{item?.unit ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace" }}>
                    {item ? rupiah(item.price) : ""}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace" }}>
                    {item ? rupiah(item.total) : ""}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr>
                <td
                  colSpan={5}
                  style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontSize: 8 }}
                >
                  TOTAL PEMAKAIAN BAHAN
                </td>
                <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                  {rupiah(invoice.totals.materialTotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── SECTION II: WORKING HOUR ── */}
          <div style={sectionBar}>II. WORKING HOUR</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 3 }}>
            <thead>
              <tr>
                <th style={{ ...thDark, width: 20 }}>NO</th>
                <th style={{ ...thDark, width: 58 }}>DATE</th>
                <th style={{ ...thDark, width: 40 }}>START</th>
                <th style={{ ...thDark, width: 40 }}>BREAK</th>
                <th style={{ ...thDark, width: 40 }}>FINISH</th>
                <th style={{ ...thDark, width: 64 }}>WORKING HOUR</th>
                <th style={{ ...thDark, width: 64 }}>POWER (watt)</th>
                <th style={{ ...thDark, width: 80 }}>POWER COST/kwh</th>
                <th style={{ ...thDark, width: 80, textAlign: "right" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {whRows.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdBase, textAlign: "center" }}>{item?.no ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>{item?.date ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>{item?.start ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>{item?.break ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>{item?.finish ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>{item?.workingHourText ?? ""}</td>
                  <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace" }}>
                    {item ? item.powerWatt : ""}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace" }}>
                    {item ? rupiah(item.powerCostKwh) : ""}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace" }}>
                    {item ? rupiah(item.total) : ""}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr>
                <td colSpan={5} style={tdBase} />
                <td style={{ ...tdBase, textAlign: "center", fontFamily: "monospace", fontWeight: 700 }}>
                  {invoice.totals.totalWorkHourText}
                </td>
                <td colSpan={2} style={{ ...tdBase, textAlign: "right", fontWeight: 700, fontSize: 8 }}>
                  TOTAL
                </td>
                <td style={{ ...tdBase, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                  {rupiah(invoice.totals.workingHourTotal)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 7, fontStyle: "italic", color: "#555", marginBottom: 10 }}>
            Rumus : (Daya (watt) x waktu (jam) x tarif Listrik/kwh)/(1.000) x 2
          </div>

          {/* ── NOTES + SUMMARY ── */}
          <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
            {/* Left: Notes */}
            <div style={{ flex: "0 0 55%" }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", fontSize: 9, marginBottom: 6 }}>
                NOTES
              </div>
              {[
                { label: "OPERATOR", value: operator, set: setOperator },
                { label: "COST LABOUR", value: costLabour, set: setCostLabour },
              ].map(({ label, value, set }) => (
                <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4, fontSize: 9 }}>
                  <span style={{ fontWeight: 700, minWidth: 80, flexShrink: 0 }}>{label}</span>
                  <span>:</span>
                  <Editable value={value} onChange={set} style={{ fontSize: 9 }} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8, fontSize: 9 }}>
                <span style={{ fontWeight: 700, minWidth: 80, flexShrink: 0 }}>WORK HOUR</span>
                <span>:</span>
                <span style={{ fontSize: 9 }}>{invoice.totals.totalWorkHourText}</span>
              </div>
              {/* Picture */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, fontStyle: "italic", marginBottom: 4 }}>Picture :</div>
                {invoice.pictures && invoice.pictures.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {invoice.pictures.slice(0, 4).map((pic, i) => (
                      <img
                        key={i}
                        src={pic.url}
                        alt={pic.caption ?? ""}
                        style={{ width: 80, height: 72, objectFit: "cover", border: "1px solid #ccc" }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    width: 100, height: 90,
                    border: "1px dashed #bbb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "#bbb",
                  }}>
                    No Photo
                  </div>
                )}
              </div>
              {/* Detail proses */}
              <div style={{ fontSize: 9, fontWeight: 700, fontStyle: "italic", marginBottom: 3 }}>
                Detail proses:
              </div>
              <Editable
                value={detailProses}
                onChange={setDetailProses}
                multiline
                style={{ fontSize: 9, fontStyle: "italic", fontWeight: 700 }}
                placeholder="e.g. MAKING BUSHING RING SETING 1 PCS"
              />
            </div>

            {/* Right: Summary */}
            <div style={{ flex: 1, alignSelf: "flex-start" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                <tbody>
                  {!isCustomer && (
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                        TOTAL PRICE BUBUT
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", width: 12, textAlign: "center" }}>:</td>
                      <td style={{ border: "1px solid #000", padding: "4px 4px", width: 18, textAlign: "center" }}>Rp</td>
                      <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                        {rupiah(invoice.totals.totalPriceBubut)}
                      </td>
                    </tr>
                  )}
                  {isCustomer && (
                    <>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                          TOTAL PRICE BUBUT
                        </td>
                        <td style={{ border: "1px solid #000", padding: "4px 6px", width: 12, textAlign: "center" }}>:</td>
                        <td style={{ border: "1px solid #000", padding: "4px 4px", width: 18, textAlign: "center" }}>Rp</td>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                          {rupiah(invoice.totals.totalPriceBubut)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                          UP {invoice.totals.markupPercent ?? 235}%
                        </td>
                        <td style={{ border: "1px solid #000", padding: "4px 6px", width: 12, textAlign: "center" }}>:</td>
                        <td style={{ border: "1px solid #000", padding: "4px 4px", width: 18, textAlign: "center" }}>Rp</td>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                          {rupiah(invoice.totals.priceAfterMarkup)}
                        </td>
                      </tr>
                      <tr style={{ 
                        background: "#e8e8e8",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                          PRICE ROUNDING
                        </td>
                        <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>:</td>
                        <td style={{ border: "1px solid #000", padding: "4px 4px", textAlign: "center" }}>Rp</td>
                        <td style={{ border: "1px solid #000", padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                          {rupiah(invoice.totals.priceRounding)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr style={{ 
                    background: "#fef9c3",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}>
                    <td style={{ border: "1px solid #000", padding: "4px 8px", fontWeight: 700, textTransform: "uppercase" }}>
                      ACC BU WIDYA
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>:</td>
                    <td style={{ border: "1px solid #000", padding: "4px 4px" }} />
                    <td style={{ border: "1px solid #000", padding: "4px 8px" }} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SIGNATURE TABLE ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, marginTop: 12 }}>
            <tbody>
              <tr>
                {sigCols.map(({ label }, i) => (
                  <td
                    key={i}
                    style={{ border: "none", padding: "5px 8px", textAlign: "center", fontStyle: "italic", fontWeight: 400, width: "25%" }}
                  >
                    {label}
                  </td>
                ))}
              </tr>
              <tr>
                {sigCols.map(({ sub }, i) => (
                  <td key={i} style={{ border: "none", padding: "2px 8px", textAlign: "center", fontSize: 8, color: "#888" }}>
                    {sub}
                  </td>
                ))}
              </tr>
              <tr>
                {sigCols.map((_, i) => (
                  <td key={i} style={{ border: "none", height: 60 }} />
                ))}
              </tr>
              <tr>
                {sigCols.map(({ name, setName }, i) => (
                  <td
                    key={i}
                    style={{ border: "none", padding: "4px 8px", textAlign: "center" }}
                  >
                    <Editable
                      value={name}
                      onChange={setName}
                      style={{ fontSize: 10, fontWeight: 700, textAlign: "center" }}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* ── FOOTER ── */}
          <div style={{
            marginTop: 10,
            borderTop: "1px solid #e5e5e5",
            paddingTop: 5,
            fontSize: 7,
            color: "#aaa",
          }}>
            <span>Stanley Marthin Restoration Garage · JL. Padasaluyu Utara II No. 8 Bandung 40154</span>
          </div>
        </div>
      </main>

      <style>{`
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 15mm; 
          }
          html { background: white !important; }
          body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          body > div { background: white !important; }
          main { 
            background: white !important; 
            padding: 0 !important; 
            margin: 0 !important;
            min-height: unset !important;
            height: auto !important;
          }
          main > div {
            min-height: unset !important;
            height: auto !important;
          }
          input, textarea {
            border: none !important;
            border-bottom: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
