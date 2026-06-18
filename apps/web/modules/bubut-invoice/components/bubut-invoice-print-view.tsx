"use client";

/* eslint-disable @next/next/no-img-element */

import type { BubutInvoiceSnapshot } from "@smsystem/contracts/bubut-invoice";
import { getProxiedImageUrl } from "@/shared/api/config";
import { Printer } from "lucide-react";
import { useState } from "react";

function intId(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function numberId(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(value ?? 0);
}

function displayDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function Editable({
  value,
  onChange,
  className,
  multiline,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const sharedClass = `editable-field ${className ?? ""}`;
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className={sharedClass}
      />
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={sharedClass}
    />
  );
}

export function BubutInvoicePrintView({ invoice }: { invoice: BubutInvoiceSnapshot }) {
  const [printMode, setPrintMode] = useState<"DIREKSI" | "CUSTOMER">(
    invoice.invoiceType === "CUSTOMER" ? "CUSTOMER" : "DIREKSI",
  );
  const isCustomer = printMode === "CUSTOMER";

  const [headProject, setHeadProject] = useState(invoice.headProjectName ?? "");
  const [carType, setCarType] = useState(invoice.carType ?? "");
  const [sparepartName, setSparepartName] = useState(invoice.sparepartName ?? "");
  const [qty, setQty] = useState(String(invoice.qty ?? ""));
  const [qtyUnit, setQtyUnit] = useState(invoice.qtyUnit ?? "pcs");
  const [poNo, setPoNo] = useState(invoice.poNo ?? invoice.invoiceNo ?? "");
  const [poDate, setPoDate] = useState(displayDate(invoice.poDate ?? invoice.woDate));
  const [operator, setOperator] = useState(invoice.operatorName ?? "____________");
  const [costLabour, setCostLabour] = useState("____________");
  const [detailProses, setDetailProses] = useState(invoice.processDetailText ?? "");
  const [sigName1, setSigName1] = useState(invoice.operatorName ?? "Sahrul Riswanto");
  const [sigName2, setSigName2] = useState(invoice.headProjectName ?? "");
  const [sigName3, setSigName3] = useState("Renova Febri Adisti");
  const [sigName4, setSigName4] = useState("Widya Fitri");

  const materialRows = [...invoice.materials];
  while (materialRows.length < 3) materialRows.push(null as never);

  const workRows = [...invoice.workingHours];
  while (workRows.length < 9) workRows.push(null as never);

  const beforePictures = invoice.pictures.filter((picture) =>
    picture.caption?.toUpperCase().includes("BEFORE"),
  );
  const afterPictures = invoice.pictures.filter((picture) =>
    picture.caption?.toUpperCase().includes("AFTER"),
  );
  const untaggedPictures = invoice.pictures.filter((picture) =>
    !beforePictures.includes(picture) && !afterPictures.includes(picture),
  );
  const pictureGroups =
    beforePictures.length > 0 || afterPictures.length > 0
      ? [
          { label: "Before", pictures: beforePictures },
          { label: "After", pictures: afterPictures },
        ].filter((group) => group.pictures.length > 0)
      : [{ label: "", pictures: untaggedPictures }];

  const signatures = [
    {
      label: "Dibuat oleh,",
      role: "Administrasi Oprasional",
      name: sigName1,
      setName: setSigName1,
    },
    {
      label: "Diketahui oleh,",
      role: "Project Manager",
      name: sigName2,
      setName: setSigName2,
    },
    {
      label: "Diketahui oleh,",
      role: "Finance Accounting",
      name: sigName3,
      setName: setSigName3,
    },
    {
      label: "Disetujui oleh,",
      role: "Office Manager",
      name: sigName4,
      setName: setSigName4,
    },
  ];

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-white/10 bg-card px-5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="font-mono text-[11px] text-foreground/45 transition-colors hover:text-foreground"
        >
          Kembali
        </button>
        <span className="font-mono text-[10px] text-foreground/35">
          Klik field bergaris untuk edit
        </span>
        <div className="flex items-center gap-2">
          <div className="flex h-8 border border-white/10">
            <button
              type="button"
              onClick={() => setPrintMode("DIREKSI")}
              className={`h-full border-r px-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                printMode === "DIREKSI"
                  ? "border-primary/30 bg-primary/10 text-app-accent-ink"
                  : "border-white/10 text-foreground/35 hover:text-foreground/60"
              }`}
            >
              Direksi
            </button>
            <button
              type="button"
              onClick={() => setPrintMode("CUSTOMER")}
              className={`h-full px-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                printMode === "CUSTOMER"
                  ? "bg-info/10 text-info"
                  : "text-foreground/35 hover:text-foreground/60"
              }`}
            >
              Customer
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-8 items-center gap-1.5 border border-primary/30 bg-primary/[0.04] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-app-accent-ink transition-colors hover:bg-primary/10"
          >
            <Printer className="h-3 w-3" />
            Print {isCustomer ? "Customer" : "Direksi"}
          </button>
        </div>
      </div>

      <main className="min-h-screen bg-background pt-11 print:block print:min-h-0 print:bg-white print:pt-0">
        <section className="invoice-page mx-auto my-6 bg-white text-primary-foreground shadow-2xl print:my-0 print:shadow-none">
          <header className="invoice-header">
            <div className="invoice-title-box">
              <div className="rule rule-light" />
              <div className="rule rule-dark" />
              <h1>SALES INVOICE</h1>
              <div className="rule rule-dark" />
            </div>
            <div className="brand-box">
              <div className="brand-text">
                <strong>STANLEY MARTHIN</strong>
                <span>Jl. Padasaluyu Utara II No. 8 Sukasari</span>
                <span>Isola Bandung</span>
              </div>
              <img src="/sm.jpeg" alt="Stanley Marthin" />
              <div className="rule rule-light" />
            </div>
          </header>

          <div className="info-row">
            <div className="info-box info-main">
              <label>
                <span>HEAD PROJECT</span>
                <b>:</b>
                <Editable value={headProject} onChange={setHeadProject} />
              </label>
              <label>
                <span>CAR TYPE</span>
                <b>:</b>
                <Editable value={carType} onChange={setCarType} />
              </label>
              <label>
                <span>SPAREPART NAME</span>
                <b>:</b>
                <Editable value={sparepartName} onChange={setSparepartName} />
              </label>
              <label className="qty-line">
                <span>QTY</span>
                <b>:</b>
                <div className="qty-combo">
                  <Editable value={qty} onChange={setQty} className="qty-value" />
                  <Editable value={qtyUnit} onChange={setQtyUnit} className="qty-unit" />
                </div>
              </label>
            </div>
            <div className="info-box info-po">
              <label>
                <span>PO No.</span>
                <b>:</b>
                <Editable value={poNo} onChange={setPoNo} />
              </label>
              <label>
                <span>PO DATE</span>
                <b>:</b>
                <Editable value={poDate} onChange={setPoDate} />
              </label>
            </div>
          </div>

          <div className="section-bar">I. MATERIAL USE</div>
          <table className="sheet material-table">
            <thead>
              <tr>
                <th className="no-col">NO</th>
                <th className="material-name">TYPE of MATERIAL</th>
                <th className="qty-col">QTY</th>
                <th className="unit-col">QUOM</th>
                <th className="money-col">PRICE</th>
                <th className="money-col">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((item, index) => (
                <tr key={index}>
                  <td className="center">{item?.no ?? index + 1}</td>
                  <td className="center strong">{item?.materialName ?? ""}</td>
                  <td className="center">{item?.qty ?? ""}</td>
                  <td className="center">{item?.unit ?? ""}</td>
                  <td className="currency">{item ? <><span>Rp</span><span>{intId(item.price)}</span></> : null}</td>
                  <td className="currency">{item ? <><span>Rp</span><span>{intId(item.total)}</span></> : null}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={5}>TOTAL PEMAKAIAN BAHAN</td>
                <td className="currency"><span>Rp</span><span>{intId(invoice.totals.materialTotal)}</span></td>
              </tr>
            </tbody>
          </table>

          <div className="section-bar work-title">II. WORKING HOUR</div>
          <table className="sheet work-table">
            <thead>
              <tr>
                <th className="no-col">NO</th>
                <th>DATE</th>
                <th>START</th>
                <th>BREAK</th>
                <th>FINISH</th>
                <th>WORKING<br />HOUR</th>
                <th>POWER<br />(watt)</th>
                <th>POWER<br />COST/kwh</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {workRows.map((item, index) => (
                <tr key={index}>
                  <td className="center">{item?.no ?? index + 1}</td>
                  <td className="center">{item?.date ?? ""}</td>
                  <td className="center">{item?.start ?? ""}</td>
                  <td className="center">{item?.break ?? ""}</td>
                  <td className="center">{item?.finish ?? ""}</td>
                  <td className="center">{item?.workingHourText ?? ""}</td>
                  <td className="center">{item ? numberId(item.powerWatt) : ""}</td>
                  <td className="center">{item ? numberId(item.powerCostKwh) : ""}</td>
                  <td className="currency">{item ? <><span>Rp</span><span>{intId(item.total)}</span></> : null}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={5} />
                <td className="center">{invoice.totals.totalWorkHourText}</td>
                <td colSpan={2}>TOTAL</td>
                <td className="currency"><span>Rp</span><span>{intId(invoice.totals.workingHourTotal)}</span></td>
              </tr>
            </tbody>
          </table>
          <div className="formula">
            Rumus : <strong>(Daya (watt) x waktu (jam) x tarif Listrik/kwh)/(1.000) x 2</strong>
          </div>

          <div className="bottom-grid">
            <div className="notes-block">
              <div className="notes-title">NOTES</div>
              <label>
                <span>OPERATOR</span>
                <b>:</b>
                <Editable value={operator} onChange={setOperator} />
              </label>
              <label>
                <span>COST LABOUR</span>
                <b>:</b>
                <Editable value={costLabour} onChange={setCostLabour} />
              </label>
              <label>
                <span>WORK HOUR</span>
                <b>:</b>
                <strong>{invoice.totals.totalWorkHourText || "____________"}</strong>
              </label>

              <div className="picture-label">Picture :</div>
              {invoice.pictures.length > 0 ? (
                <div className="picture-groups">
                  {pictureGroups.map((group) => (
                    <div key={group.label || "pictures"} className="picture-group">
                      {group.label ? <div className="picture-group-label">{group.label}</div> : null}
                      <div className="picture-list">
                        {group.pictures.slice(0, 2).map((picture, index) => {
                            const resolvedUrl = getProxiedImageUrl(picture.url) ?? picture.url;
                            return (
                              <img
                                key={`${picture.url}-${index}`}
                                src={resolvedUrl}
                                alt={picture.caption ?? ""}
                              />
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="picture-placeholder" />
              )}

              <div className="detail-label">Detail proses :</div>
              <Editable
                value={detailProses}
                onChange={setDetailProses}
                multiline
                placeholder="Detail proses"
                className="detail-field"
              />
            </div>

            <table className="summary-table">
              <tbody>
                <tr>
                  <td>TOTAL PRICE BUBUT</td>
                  <td>:</td>
                  <td>Rp</td>
                  <td>{intId(invoice.totals.totalPriceBubut)}</td>
                </tr>
                {isCustomer ? (
                  <>
                    <tr>
                      <td>UP {invoice.totals.markupPercent ?? 235} %</td>
                      <td>:</td>
                      <td>Rp</td>
                      <td>{intId(invoice.totals.priceAfterMarkup)}</td>
                    </tr>
                    <tr>
                      <td>PRICE ROUNDING</td>
                      <td>:</td>
                      <td>Rp</td>
                      <td>{intId(invoice.totals.priceRounding)}</td>
                    </tr>
                  </>
                ) : null}
                <tr className="approval-row">
                  <td>ACC BU WIDYA</td>
                  <td>:</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <table className="signature-table">
            <tbody>
              <tr>
                {signatures.map((signature) => (
                  <td key={signature.role}>{signature.label}</td>
                ))}
              </tr>
              <tr>
                {signatures.map((signature) => (
                  <td key={signature.role}>{signature.role}</td>
                ))}
              </tr>
              <tr className="sign-space">
                {signatures.map((signature) => (
                  <td key={signature.role} />
                ))}
              </tr>
              <tr>
                {signatures.map((signature) => (
                  <td key={signature.role}>
                    <span className="sign-line" />
                    <Editable
                      value={signature.name}
                      onChange={signature.setName}
                      className="sign-name"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <style jsx global>{`
        .invoice-page {
          box-sizing: border-box;
          width: 210mm;
          min-height: 285mm;
          padding: 7mm 12mm 7mm;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 9.2pt;
          font-weight: 600;
          line-height: 1.18;
        }

        .editable-field {
          display: block;
          width: 100%;
          min-width: 0;
          border: 0;
          border-bottom: 1px dashed rgb(217 119 6);
          background: transparent;
          color: inherit;
          font: inherit;
          font-weight: 800;
          line-height: inherit;
          outline: none;
          padding: 0;
          resize: none;
        }

        .invoice-header {
          display: grid;
          grid-template-columns: 40.5% 1fr;
          align-items: start;
          gap: 14mm;
          margin-bottom: 6mm;
        }

        .rule {
          width: 100%;
          height: 1px;
        }

        .rule-light {
          background: rgb(189 189 189);
        }

        .rule-dark {
          background: rgb(0 0 0);
        }

        .invoice-title-box .rule-light {
          margin-bottom: 3.5mm;
        }

        .invoice-title-box h1 {
          margin: 7mm 0 6.2mm;
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 18pt;
          letter-spacing: 0;
          line-height: 1;
        }

        .brand-box {
          display: grid;
          grid-template-columns: 1fr 18mm;
          align-items: center;
          column-gap: 2.5mm;
          padding-top: 3mm;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          color: rgb(17 17 17);
          line-height: 1.05;
        }

        .brand-text strong {
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 13.8pt;
          line-height: 1.05;
          white-space: nowrap;
        }

        .brand-text span {
          font-size: 9.2pt;
          font-weight: 900;
          white-space: nowrap;
        }

        .brand-box img {
          width: 18mm;
          height: 16mm;
          object-fit: cover;
        }

        .brand-box .rule {
          grid-column: 1 / -1;
          margin-top: 9mm;
        }

        .info-row {
          display: grid;
          grid-template-columns: 55.5% 38.3%;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 4mm;
        }

        .info-box {
          background: rgb(208 208 208);
          padding: 1.2mm 1.2mm 1.4mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .info-box label,
        .notes-block label {
          display: grid;
          grid-template-columns: max-content 4mm 1fr;
          align-items: baseline;
          min-height: 4.5mm;
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 8.9pt;
        }

        .info-box label span {
          width: 33mm;
        }

        .info-po label span {
          width: 20mm;
        }

        .qty-line {
          margin-top: 4.5mm;
        }

        .qty-combo {
          display: flex;
          align-items: baseline;
          gap: 1.6mm;
        }

        .qty-value {
          width: 10mm;
        }

        .qty-unit {
          width: 14mm;
        }

        .section-bar {
          background: rgb(0 0 0);
          color: rgb(255 192 0);
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 9pt;
          height: 4.7mm;
          line-height: 4.7mm;
          padding: 0 1.2mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .work-title {
          margin-top: 7mm;
        }

        .sheet {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .sheet th {
          height: 5.1mm;
          border: 1px solid rgb(183 183 183);
          background: rgb(60 60 60);
          color: rgb(255 192 0);
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 8.3pt;
          line-height: 1.05;
          padding: 0 0.6mm;
          text-align: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .sheet td {
          height: 4.55mm;
          border: 1px solid rgb(183 183 183);
          padding: 0 1mm;
          font-size: 8.1pt;
          font-weight: 600;
          vertical-align: middle;
        }

        .sheet .no-col {
          width: 7mm;
        }

        .material-table .material-name {
          width: 78mm;
          text-align: left;
        }

        .material-table .qty-col {
          width: 18mm;
        }

        .material-table .unit-col {
          width: 20mm;
        }

        .material-table .money-col {
          width: 25mm;
        }

        .work-table th:nth-child(2) {
          width: 24mm;
        }

        .work-table th:nth-child(3),
        .work-table th:nth-child(4),
        .work-table th:nth-child(5) {
          width: 20mm;
        }

        .work-table th:nth-child(6) {
          width: 20mm;
        }

        .work-table th:nth-child(7) {
          width: 18mm;
        }

        .work-table th:nth-child(8) {
          width: 23mm;
        }

        .work-table th:nth-child(9) {
          width: 25mm;
        }

        .center {
          text-align: center;
        }

        .strong,
        .total-row {
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
        }

        .currency {
          text-align: right;
          white-space: nowrap;
        }

        .currency span:first-child {
          float: left;
        }

        .total-row td {
          font-size: 8.1pt;
          font-weight: 900;
          text-align: right;
        }

        .formula {
          display: inline-block;
          min-width: 99mm;
          background: rgb(158 158 158);
          font-size: 7.7pt;
          font-weight: 500;
          height: 4.4mm;
          line-height: 4.4mm;
          padding: 0 1.2mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .bottom-grid {
          display: grid;
          grid-template-columns: 55.5% 38.3%;
          justify-content: space-between;
          align-items: start;
          margin-top: 4mm;
        }

        .notes-title {
          display: inline-block;
          margin-bottom: 1.5mm;
          border-bottom: 1px solid rgb(0 0 0);
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 8.2pt;
          line-height: 1;
        }

        .notes-block label {
          grid-template-columns: 25mm 4mm 1fr;
          min-height: 3.8mm;
          font-size: 8.2pt;
        }

        .notes-block label span {
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
        }

        .picture-label,
        .detail-label {
          margin-top: 2.2mm;
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 8.3pt;
          font-style: italic;
        }

        .picture-groups {
          display: flex;
          flex-wrap: wrap;
          gap: 3mm;
          margin: 1.5mm 0 0 14.5mm;
        }

        .picture-group {
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }

        .picture-group-label {
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 7.4pt;
          font-style: italic;
        }

        .picture-list {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5mm;
        }

        .picture-list img,
        .picture-placeholder {
          width: 28mm;
          height: 22mm;
          object-fit: cover;
        }

        .picture-placeholder {
          margin: 1.5mm 0 0 14.5mm;
          border: 1px solid transparent;
        }

        .detail-label {
          margin-top: 1.7mm;
        }

        .detail-field {
          margin-top: 1.3mm;
          min-height: 9mm;
          border-bottom: 0;
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
          font-size: 8.3pt;
          font-style: italic;
          text-transform: uppercase;
        }

        .summary-table {
          width: 100%;
          margin-top: 13mm;
          border-collapse: collapse;
          table-layout: fixed;
          font-family: "Arial Black", Arial, Helvetica, sans-serif;
        }

        .summary-table td {
          height: 5.6mm;
          border: 1px solid rgb(183 183 183);
          background: rgb(208 208 208);
          font-size: 8.3pt;
          padding: 0 1.1mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .summary-table td:nth-child(1) {
          width: auto;
        }

        .summary-table td:nth-child(2) {
          width: 4mm;
          text-align: center;
        }

        .summary-table td:nth-child(3) {
          width: 8mm;
          text-align: center;
        }

        .summary-table td:nth-child(4) {
          text-align: right;
        }

        .summary-table .approval-row td {
          background: rgb(255 192 0);
        }

        .signature-table {
          width: 100%;
          margin-top: 5mm;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 8.8pt;
        }

        .signature-table td {
          border: 0;
          text-align: center;
          font-weight: 500;
          line-height: 1.45;
        }

        .sign-space td {
          height: 20mm;
        }

        .sign-line {
          display: block;
          width: 25mm;
          margin: 0 auto 2.4mm;
          border-top: 1px solid rgb(0 0 0);
        }

        .sign-name {
          margin: 0 auto;
          border: 0;
          text-align: center;
          font-size: 8.7pt;
          font-weight: 500;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body,
          body > div {
            margin: 0 !important;
            background: white !important;
          }

          main,
          main > section {
            margin: 0 !important;
            box-shadow: none !important;
          }

          input,
          textarea {
            border: none !important;
            background: transparent !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </>
  );
}
