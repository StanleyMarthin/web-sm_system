"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Image from "next/image";
import { useState } from "react";
import { X, Printer, CheckCircle, AlertTriangle, HelpCircle, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { approveWo, markWoDone, rejectWo } from "@/shared/api/wo";
import { permissionCodes } from "@smsystem/permissions";
import { approvePr } from "@/shared/api/pr";
import { approveVendor } from "@/shared/api/vendor";
import { humanizeCodeLabel } from "@/shared/format/humanize";

interface RequestDetailDialogProps {
  type: "WO" | "WOV" | "PR";
  id: string;
  onClose: () => void;
  user: any;
  woPayload?: any;
  prPayload?: any;
  vendorPayload?: any;
}

export function RequestDetailDialog({
  type,
  id,
  onClose,
  user,
  woPayload,
  prPayload,
  vendorPayload
}: RequestDetailDialogProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"detail" | "timeline">("detail");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [woApprovePicId, setWoApprovePicId] = useState("");
  const [woApproveHours, setWoApproveHours] = useState("");
  const [woApproveNotes, setWoApproveNotes] = useState("");
  const [printMode, setPrintMode] = useState<"default" | "pr-submission" | "pr-handover">("default");

  // We can fetch the detail records from our parent payloads dynamically
  // or show loaded records. Let's find the matching record from the payloads.
  const woRecord = type === "WO" ? woPayload?.data?.find((r: any) => r.woId === id) : null;
  const prRecord = type === "PR" ? prPayload?.data?.find((r: any) => r.prId === id) : null;
  const vendorRecord = type === "WOV" ? vendorPayload?.data?.find((r: any) => r.wovId === id) : null;

  if (type === "WO" && !woRecord) return null;
  if (type === "PR" && !prRecord) return null;
  if (type === "WOV" && !vendorRecord) return null;

  const title = woRecord?.woNumber || prRecord?.prNumber || vendorRecord?.wovNumber || "Detail Request";
  const unitName = woRecord?.unitName || prRecord?.unitName || vendorRecord?.unitName || "-";
  const customerName = woRecord?.customerName || prRecord?.customerName || vendorRecord?.customerName || "-";
  const status = woRecord?.status || prRecord?.status || vendorRecord?.status || "OPEN";
  const notes = woRecord?.jobDetail || woRecord?.jobDescription || woRecord?.description || woRecord?.notes || prRecord?.notes || vendorRecord?.remarks || "-";
  const prItems = Array.isArray((prRecord as { items?: unknown[] } | null)?.items)
    ? ((prRecord as { items: unknown[] }).items as any[])
    : [];
  const detailRoute =
    type === "WO" ? `/wo/${id}` : type === "PR" ? `/pr/${id}` : `/vendor/${id}`;

  // Actions checks based on roles & permissions
  const woKdStatuses = ["OPEN", "SUBMITTED", "PENDING_TARGET_KD_APPROVAL"];
  const isWoKdStage = woKdStatuses.includes(status);
  const isWoAdvisorStage = status === "PENDING_ADVISOR_APPROVAL";
  const isWoKpStage = status === "PENDING_KP_APPROVAL";
  const isWoPmStage = status === "PENDING_PM_APPROVAL";
  const canApproveWoKd =
    user.permissions.includes(permissionCodes.woApprove) &&
    isWoKdStage &&
    woRecord?.toDivisionId !== null &&
    woRecord?.toDivisionId !== undefined &&
    (
      user?.divisionId === woRecord.toDivisionId ||
      user?.scope?.divisionIds?.includes?.(woRecord.toDivisionId) ||
      user?.scope?.managedDivisionIds?.includes?.(woRecord.toDivisionId)
    );
  const canApproveWoAdvisor =
    user.permissions.includes(permissionCodes.woApproveAdvisor) &&
    isWoAdvisorStage;
  const isAssignedWoUnit =
    !!woRecord?.carId &&
    user?.scope?.unitIds?.includes?.(woRecord.carId);
  const canApproveWoKp =
    (user?.roleProfile?.approvalRank ?? 0) >= 3 &&
    isWoKpStage &&
    isAssignedWoUnit;
  const canApproveWoPm =
    user.permissions.includes(permissionCodes.woApprovePm) &&
    isWoPmStage;
  const canApproveWo = canApproveWoKd || canApproveWoAdvisor || canApproveWoKp || canApproveWoPm;
  const canDoneWo = user.permissions.includes(permissionCodes.woApprove) && status === "APPROVED";
  const canRejectWo = user.permissions.includes(permissionCodes.woReject) && [...woKdStatuses, "PENDING_ADVISOR_APPROVAL", "PENDING_KP_APPROVAL", "PENDING_PM_APPROVAL"].includes(status);

  const canApprovePr = user.permissions.includes(permissionCodes.prApprove) && prRecord?.accTracking !== "APPROVED" && !["REJECTED", "CANCELLED", "ARRIVED"].includes(status);
  const canOrderPr = user.permissions.includes(permissionCodes.prOrder) && prRecord?.accTracking === "APPROVED" && ["OPEN", "HUNTING"].includes(status);
  const canReceivePr = user.permissions.includes(permissionCodes.prReceive) && prRecord?.accTracking === "APPROVED" && ["HUNTING", "ORDERED"].includes(status);

  const canApproveWov = user.permissions.includes(permissionCodes.vendorApprove) && vendorRecord?.accTracking !== "APPROVED" && !["RECEIVED", "REJECTED", "CANCELLED"].includes(status);
  const canReceiveWov = user.permissions.includes(permissionCodes.vendorReceive) && vendorRecord?.accTracking === "APPROVED" && ["SENT", "PROSES_VENDOR", "DONE_VENDOR"].includes(status);

  async function handleAction(mutationFn: () => Promise<any>, successMsg: string) {
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await mutationFn();
      if (res.success) {
        setSuccess(successMsg);
        router.refresh();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.message || "Aksi gagal dijalankan.");
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan koneksi.");
    } finally {
      setPending(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handlePrintPrSubmission = () => {
    setPrintMode("pr-submission");
    setTimeout(() => window.print(), 50);
  };

  const handlePrintPrHandover = () => {
    setPrintMode("pr-handover");
    setTimeout(() => window.print(), 50);
  };

  const openDetailModule = () => {
    router.push(detailRoute);
    onClose();
  };

  // ── Print helper variables ──
  const printUserName =
    user?.fullName ||
    user?.name ||
    user?.email ||
    "User";

  const canPrint = ["APPROVED", "DONE", "RECEIVED", "ARRIVED"].includes(status);
  const isWoApproved = ["APPROVED", "IN_PROGRESS", "DONE", "CLOSED"].includes(status);
  const isWoAccepted = ["IN_PROGRESS", "DONE", "CLOSED"].includes(status);
  const isWoDone = ["DONE", "CLOSED"].includes(status);
  const isPrApproved = prRecord?.accTracking === "APPROVED";
  const isWovApproved = vendorRecord?.accTracking === "APPROVED";
  const isPrHandover = printMode === "pr-handover" && prRecord?.status === "RECEIVED";

  const printJobDetail = (
    woRecord?.jobDetail ||
    woRecord?.jobDescription ||
    woRecord?.description ||
    woRecord?.notes ||
    ""
  );
  const cleanJobDetail = printJobDetail.replace(/^mp:\s*/i, "").trim();

  const printPrNotes = (
    prRecord?.notes ||
    prRecord?.description ||
    prRecord?.remarks ||
    ""
  );
  const cleanPrNotes = printPrNotes.replace(/^mp:\s*/i, "").trim();

  // ── Mapping Nama Spesifik Sesuai Struktur (Placeholder sebelum integrasi backend) ──
  const woIssuedName = woRecord?.fromDivisionHeadName || "(NAMA KEPALA DIV. PENGAJU)";
  const woHeadDivisionName = woRecord?.toDivisionHeadName || "(NAMA KEPALA DIV. DITUJU)";
  const woAdvisorName = woRecord?.fromDivisionAdvisorName || "";
  const woKepalaProjectName = woRecord?.projectHeadName || "(NAMA KEPALA PROJECT UNIT)";
  const woPmName = woRecord?.projectManagerName || "(NAMA PROJECT MANAGER)";

  // PR Print Names Mapping
  const prIssuedName = prRecord?.divisionHeadName || "(NAMA KEPALA DIV. PENGAJU)";
  const prAdvisorName = prRecord?.divisionAdvisorName || "";
  const prKepalaProjectName = prRecord?.projectHeadName || "(NAMA KEPALA PROJECT UNIT)";
  const prPmName = prRecord?.projectManagerName || "(NAMA PROJECT MANAGER)";
  const prHeadPurchaseName = prRecord?.headPurchaseName || "(NAMA KEPALA DIV. PURCHASE)";

  // WOV Print Names Mapping
  const wovIssuedName = vendorRecord?.divisionHeadName || "(NAMA KEPALA DIV. PENGAJU)";
  const wovAdvisorName = vendorRecord?.divisionAdvisorName || "";
  const wovKepalaProjectName = vendorRecord?.projectHeadName || "(NAMA KEPALA PROJECT UNIT)";
  const wovPmName = vendorRecord?.projectManagerName || "(NAMA PROJECT MANAGER)";

  const printWovNotes = (
    vendorRecord?.remarks ||
    vendorRecord?.notes ||
    vendorRecord?.description ||
    ""
  );
  const cleanWovNotes = printWovNotes.replace(/^mp:\s*/i, "").trim();

  const documentDateRaw = woRecord?.requestDate || prRecord?.createdAt || vendorRecord?.createdAt;
  const documentDateStr = documentDateRaw
    ? new Date(documentDateRaw).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

  const prHasPrice = prItems.some((it: any) =>
    Number(it.finalPrice || it.actualPrice || it.estimatedPrice || 0) > 0
  );
  const getPrItemPrice = (it: any) =>
    Number(it.finalPrice || it.actualPrice || it.estimatedPrice || 0);
  const prTotalPrice = prItems.reduce(
    (sum: number, it: any) => sum + getPrItemPrice(it), 0
  );

  const wovItems = vendorRecord?.items?.length > 0
    ? vendorRecord.items
    : (vendorRecord?.itemName ? [vendorRecord] : []);
  const wovTotalPrice = wovItems.reduce((sum: number, it: any) => sum + Number(it.estimatedCost || 0), 0);
  const wovHasPrice = wovTotalPrice > 0;

  const thStyle: React.CSSProperties = {
    border: "1px solid black",
    padding: "6px 8px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    backgroundColor: "#f3f3f3",
  };
  const tdStyle: React.CSSProperties = {
    border: "1px solid black",
    padding: "6px 8px",
    fontSize: 10,
    verticalAlign: "top",
  };

  const DigitalSignature = ({ text = "" }: { text?: string }) => (
    <div style={{ padding: "4px 0", textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, borderBottom: "1px solid #333", display: "inline-block", paddingBottom: 2, marginBottom: 2, letterSpacing: 0.5 }}>DIGITALLY APPROVED</div>
      <div style={{ fontSize: 8, fontFamily: "monospace", color: "#555", textTransform: "uppercase" }}>{text}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-[1px] print:static print:block print:p-0 print:bg-transparent print:backdrop-blur-none">
      {/* Printable Area - Rendered off-screen normally, styled for high-contrast B&W print layout */}
      <div id="printable-voucher" className="hidden print:block bg-white text-black font-sans w-full">
        <div className="p-6 max-w-[210mm] mx-auto flex flex-col">

          {/* ── HEADER ── */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-5">
            {/* Kiri: Info dokumen */}
            <div className="space-y-1 text-[11px]">
              <div className="flex gap-2">
                <span className="w-32 font-bold uppercase text-gray-600">Car Type</span>
                <span className="font-semibold">: {unitName}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-32 font-bold uppercase text-gray-600">Date</span>
                <span>: {documentDateStr}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-32 font-bold uppercase text-gray-600">From</span>
                <span>: {woRecord?.fromDivisionName || prRecord?.divisionName || vendorRecord?.divisionName || "-"}</span>
              </div>
              {type === "WO" && (
                <div className="flex gap-2">
                  <span className="w-32 font-bold uppercase text-gray-600">To Division</span>
                  <span>: {woRecord?.toDivisionName || "-"}</span>
                </div>
              )}
              {type === "PR" && (
                <div className="flex gap-2">
                  <span className="w-32 font-bold uppercase text-gray-600">Requested By</span>
                  <span>: {prRecord?.requestedByName || "-"}</span>
                </div>
              )}
              {type === "WOV" && (
                <div className="flex gap-2">
                  <span className="w-32 font-bold uppercase text-gray-600">Vendor</span>
                  <span>: {vendorRecord?.vendorName || "-"}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="w-32 font-bold uppercase text-gray-600">Customer</span>
                <span>: {customerName}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-32 font-bold uppercase text-gray-600">Status</span>
                <span className="font-bold uppercase">: {status}</span>
              </div>
            </div>

            {/* Kanan: Logo + Nama Perusahaan */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-3 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.ico" alt="SM Logo" className="h-14 w-14 object-contain" />
                <div>
                  <p className="text-[18px] font-black uppercase tracking-tight leading-tight">STANLEY MARTHIN</p>
                  <p className="text-[13px] font-bold uppercase tracking-wide text-gray-600">RESTORATION GARAGE</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">JL. Padasaluyu Utara II No. 8 Bandung 40154</p>
                </div>
              </div>
              <div className="border-t border-gray-300 pt-2">
                <p className="text-[20px] font-black uppercase tracking-[0.2em] text-black">
                  {type === "WO" ? "WORK ORDER" : type === "PR" ? "PURCHASE REQUEST" : "VENDOR WORK ORDER"}
                </p>
                {type === "PR" && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">
                    {printMode === "pr-handover" ? "SERAH TERIMA BARANG" : "BUKTI PENGAJUAN"}
                  </p>
                )}
                <p className="font-mono text-[13px] font-bold tracking-wider mt-0.5">{title}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Tanggal Cetak: {new Date().toLocaleString("id-ID")}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">Dicetak oleh: {printUserName}</p>
              </div>
            </div>
          </div>

          {/* ── TABEL — WO ── */}
          {type === "WO" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28 }}>NO</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>WORK DESCRIPTION</th>
                  <th style={{ ...thStyle, width: 56 }}>PART</th>
                  <th style={{ ...thStyle, width: 36 }}>QTY</th>
                  <th style={{ ...thStyle, width: 80 }}>PIC</th>
                  <th style={{ ...thStyle, width: 80 }}>TIME PERIOD</th>
                  <th style={{ ...thStyle, textAlign: "left", width: 90 }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, textAlign: "center" }}>1</td>
                  <td style={tdStyle}>{cleanJobDetail || ""}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{woRecord?.panelName || "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>-</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{woRecord?.toDivisionName || "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {woRecord?.estimatedHours ? `${woRecord.estimatedHours} Jam` : "-"}
                  </td>
                  <td style={tdStyle}>-</td>
                </tr>
                {Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: "center", color: "#ccc" }}>{i + 2}</td>
                    <td style={tdStyle}>&nbsp;</td>
                    <td style={tdStyle}>&nbsp;</td>
                    <td style={tdStyle}>&nbsp;</td>
                    <td style={tdStyle}>&nbsp;</td>
                    <td style={tdStyle}>&nbsp;</td>
                    <td style={tdStyle}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── TABEL — PR PENGAJUAN ── */}
          {type === "PR" && printMode !== "pr-handover" && prItems.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28 }}>NO</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>NAMA BARANG & DESKRIPSI</th>
                  <th style={{ ...thStyle, width: 36 }}>QTY</th>
                  <th style={{ ...thStyle, width: 40 }}>UOM</th>
                  <th style={{ ...thStyle, width: 64 }}>ASAL</th>
                  {prHasPrice && <th style={{ ...thStyle, textAlign: "right", width: 90 }}>HARGA</th>}
                </tr>
              </thead>
              <tbody>
                {prItems.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{idx + 1}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{it.itemName}</span>
                      {it.description && <span style={{ color: "#555" }}><br />{it.description}</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.qty}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.uom}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.originType || "-"}</td>
                    {prHasPrice && (
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>
                        Rp {getPrItemPrice(it).toLocaleString("id-ID")}
                      </td>
                    )}
                  </tr>
                ))}
                {prHasPrice && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>TOTAL ESTIMASI</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      Rp {prTotalPrice.toLocaleString("id-ID")}
                    </td>
                  </tr>
                )}
                {Array.from({ length: Math.max(0, 2 - prItems.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td style={{ ...tdStyle, height: 28 }}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    {prHasPrice && <td style={tdStyle}></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── TABEL — PR SERAH TERIMA ── */}
          {type === "PR" && printMode === "pr-handover" && prItems.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28 }}>NO</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>NAMA BARANG & DESKRIPSI</th>
                  <th style={{ ...thStyle, width: 36 }}>QTY</th>
                  <th style={{ ...thStyle, width: 40 }}>UOM</th>
                  <th style={{ ...thStyle, width: 64 }}>ASAL</th>
                  {prHasPrice && <th style={{ ...thStyle, textAlign: "right", width: 90 }}>HARGA</th>}
                  <th style={{ ...thStyle, textAlign: "left" }}>KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                {prItems.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{idx + 1}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{it.itemName}</span>
                      {it.description && <span style={{ color: "#555" }}><br />{it.description}</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.qty}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.uom}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.originType || "-"}</td>
                    {prHasPrice && (
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>
                        Rp {getPrItemPrice(it).toLocaleString("id-ID")}
                      </td>
                    )}
                    <td style={tdStyle}></td>
                  </tr>
                ))}
                {prHasPrice && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>TOTAL</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      Rp {prTotalPrice.toLocaleString("id-ID")}
                    </td>
                    <td style={tdStyle}></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* ── TABEL — WOV ── */}
          {type === "WOV" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 28 }}>NO</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>NAMA VENDOR</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>ITEM PEKERJAAN</th>
                  <th style={{ ...thStyle, width: 36 }}>QTY</th>
                  <th style={{ ...thStyle, width: 40 }}>UOM</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>KONDISI KELUAR</th>
                  {wovHasPrice && <th style={{ ...thStyle, textAlign: "right", width: 90 }}>EST. BIAYA</th>}
                </tr>
              </thead>
              <tbody>
                {wovItems.map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{vendorRecord?.vendorName || "-"}</td>
                    <td style={tdStyle}>{it.itemName || "-"}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.quantity || 1}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{it.uom || "pcs"}</td>
                    <td style={tdStyle}>{it.goodsConditionOut || "-"}</td>
                    {wovHasPrice && (
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>
                        Rp {Number(it.estimatedCost || 0).toLocaleString("id-ID")}
                      </td>
                    )}
                  </tr>
                ))}
                {wovHasPrice && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>TOTAL ESTIMASI</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                      Rp {wovTotalPrice.toLocaleString("id-ID")}
                    </td>
                  </tr>
                )}
                {Array.from({ length: Math.max(0, 2 - wovItems.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td style={{ ...tdStyle, height: 28 }}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    {wovHasPrice && <td style={tdStyle}></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── CATATAN — hanya tampil jika ada isi ── */}
          {((type === "PR" && cleanPrNotes) || (type === "WOV" && cleanWovNotes)) ? (
            <div style={{ border: "1px solid black", padding: "10px 12px", marginBottom: 20, minHeight: 48 }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Catatan</p>
              <p style={{ fontSize: 10 }}>{type === "PR" ? cleanPrNotes : cleanWovNotes}</p>
            </div>
          ) : null}

          {/* ── SPACER ── */}
          <div className="flex-1" />

          {/* ── TANDA TANGAN — WO ── */}
          {type === "WO" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "auto" }}>
              <thead>
                <tr>
                  <th style={thStyle}>ISSUED</th>
                  <th style={thStyle}>HEAD OF DIVISION</th>
                  <th style={thStyle}>ADVISOR</th>
                  <th style={thStyle}>KEPALA PROJECT</th>
                  <th style={thStyle}>PROJECT MANAGER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, height: 64, textAlign: "center", color: "#555", verticalAlign: "bottom", fontSize: 9 }}>
                    {woIssuedName}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWoApproved && <DigitalSignature text={woHeadDivisionName} />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWoApproved && woAdvisorName && <DigitalSignature text={woAdvisorName} />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWoApproved && <DigitalSignature text={woKepalaProjectName} />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWoApproved && <DigitalSignature text={woPmName} />}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── TANDA TANGAN — PR Pengajuan ── */}
          {type === "PR" && printMode !== "pr-handover" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "auto" }}>
              <thead>
                <tr>
                  <th style={thStyle}>DIAJUKAN OLEH</th>
                  <th style={thStyle}>DIPERIKSA OLEH</th>
                  <th style={thStyle}>DISETUJUI OLEH</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, height: 64, textAlign: "center", color: "#555", verticalAlign: "bottom" }}>
                    {prRecord?.requestedByName || ""}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isPrApproved && <DigitalSignature />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isPrApproved && <DigitalSignature />}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── TANDA TANGAN — PR Serah Terima ── */}
          {type === "PR" && printMode === "pr-handover" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "auto" }}>
              <thead>
                <tr>
                  <th style={thStyle}>DISERAHKAN OLEH</th>
                  <th style={thStyle}>DITERIMA OLEH</th>
                  <th style={thStyle}>DIKETAHUI OLEH</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isPrHandover && <DigitalSignature />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isPrHandover && <DigitalSignature />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isPrHandover && <DigitalSignature />}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── TANDA TANGAN — WOV ── */}
          {type === "WOV" && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "auto" }}>
              <thead>
                <tr>
                  <th style={thStyle}>ISSUED</th>
                  <th style={thStyle}>ADVISOR</th>
                  <th style={thStyle}>KEPALA PROJECT</th>
                  <th style={thStyle}>PROJECT MANAGER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, height: 64, textAlign: "center", color: "#555", verticalAlign: "bottom", fontSize: 9 }}>
                    {wovIssuedName}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWovApproved && wovAdvisorName && <DigitalSignature text={wovAdvisorName} />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWovApproved && <DigitalSignature text={wovKepalaProjectName} />}
                  </td>
                  <td style={{ ...tdStyle, height: 64, verticalAlign: "bottom", textAlign: "center" }}>
                    {isWovApproved && <DigitalSignature text={wovPmName} />}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── FOOTER ── */}
          <div className="mt-4 border-t border-gray-200 pt-2 flex items-center justify-between text-[8px] text-gray-400">
            <span>Stanley Marthin Restoration Garage · JL. Padasaluyu Utara II No. 8 Bandung 40154</span>
            <span>Dicetak oleh: {printUserName} · {new Date().toLocaleString("id-ID")}</span>
          </div>

        </div>
      </div>

      {/* Screen Display Overlay Content */}
      <div className="relative w-full max-w-3xl border border-white/10 bg-[#111114] p-5 max-h-[90vh] overflow-y-auto flex flex-col print:hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${type === "WO" ? "border-amber-500/30 text-amber-500" :
                  type === "PR" ? "border-purple-500/30 text-purple-400" : "border-sky-500/30 text-sky-400"
                }`}>
                {type === "WO" ? "Work Order" : type === "PR" ? "Purchase Request" : "Vendor WO"}
              </span>
              {woRecord?.isPriority && (
                <span className="border border-red-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-red-400">
                  PRIORITAS TINGGI
                </span>
              )}
            </div>
            <h2 className="text-[13px] font-mono text-white mt-1.5 flex items-center gap-3">
              {title}
            </h2>
            <p className="text-[11px] font-mono text-white/40 mt-1">
              Unit: <span className="text-white/70">{unitName}</span> · Pelanggan: <span className="text-white/70">{customerName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canPrint && (
              <button
                onClick={handlePrint}
                title="Print dokumen"
                className="border border-white/5 p-1.5 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="border border-white/5 p-1.5 text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab System */}
        <div className="flex border-b border-white/[0.04] mt-5">
          <button
            onClick={() => setActiveTab("detail")}
            className={`py-2.5 px-4 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors border-b-2 -mb-[1px] ${activeTab === "detail" ? "border-amber-500 text-amber-500" : "border-transparent text-white/40 hover:text-white/75"
              }`}
          >
            Rincian & Aksi
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`py-2.5 px-4 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors border-b-2 -mb-[1px] ${activeTab === "timeline" ? "border-amber-500 text-amber-500" : "border-transparent text-white/40 hover:text-white/75"
              }`}
          >
            Pelacakan Sesi
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 mt-6">
          {activeTab === "detail" ? (
            <div className="space-y-6">
              {/* Messages */}
              {success && (
                <div className="p-3.5 border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}
              {error && (
                <div className="p-3.5 border border-red-500/20 bg-red-500/[0.04] text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Detail fields layout */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Diajukan Oleh</span>
                  <p className="text-[11px] font-mono text-white/70">
                    {woRecord?.fromDivisionName || prRecord?.requestedByName || vendorRecord?.requestedByName}
                  </p>
                </div>
                <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Divisi Pemilik</span>
                  <p className="text-[11px] font-mono text-white/70">
                    {woRecord?.fromDivisionName || prRecord?.divisionName || vendorRecord?.divisionName}
                  </p>
                </div>
                {woRecord && (
                  <>
                    <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Tujuan Divisi</span>
                      <p className="text-[11px] font-mono text-white/70">{woRecord.toDivisionName}</p>
                    </div>
                    <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Panel / Sektor</span>
                      <p className="text-[11px] font-mono text-white/70">{woRecord.panelName || "-"}</p>
                    </div>
                    <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3 col-span-2">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Estimasi Waktu</span>
                      <p className="text-[11px] font-mono text-white/70">{woRecord.estimatedHours || 0} Jam</p>
                    </div>
                  </>
                )}
                {vendorRecord && (
                  <>
                    <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Nama Vendor</span>
                      <p className="text-[11px] font-mono text-white/70">{vendorRecord.vendorName}</p>
                    </div>
                    <div className="space-y-1 border border-white/5 bg-[#0a0a0c] p-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Target Pengembalian</span>
                      <p className="text-[11px] font-mono text-white/70">{vendorRecord.targetDateReturn || "-"}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2 border border-white/5 bg-[#0a0a0c] p-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500">
                  {type === "WO" ? "Deskripsi Detail Kerja" : "Catatan Permintaan"}
                </span>
                <p className="text-[11px] font-mono text-white/70 leading-relaxed">{notes}</p>
              </div>

              {/* PR Items list layout */}
              {type === "PR" && prItems.length > 0 ? (
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500/70">
                    Daftar Item ({prItems.length})
                  </span>
                  <div className="border border-white/[0.06] rounded-2xl bg-black/40 overflow-hidden divide-y divide-white/[0.04]">
                    {prItems.map((it: any, idx: number) => (
                      <div key={idx} className="p-3.5 flex items-start justify-between text-xs hover:bg-white/[0.01] transition-colors">
                        <div className="flex gap-3">
                          {it.photoUrl ? (
                            <button
                              onClick={() => window.open(it.photoUrl, "_blank")}
                              className="h-11 w-11 rounded-lg bg-black/40 border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center relative group"
                            >
                              <Image src={it.photoUrl} fill sizes="44px" className="object-cover transition-transform group-hover:scale-105" alt="it" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="h-3 w-3 text-white" />
                              </div>
                            </button>
                          ) : (
                            <div className="h-11 w-11 rounded-lg bg-white/[0.02] border border-dashed border-white/10 shrink-0 flex items-center justify-center text-white/20">
                              <HelpCircle className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white/90">{it.itemName}</p>
                            <p className="text-[10px] text-white/35 mt-0.5 truncate max-w-[350px]">{it.description || "-"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white/90">{it.qty} {it.uom}</p>
                          <p className="text-[10px] text-amber-500/60 mt-0.5">Rp {Number(it.estimatedPrice || 0).toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : type === "PR" ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-white/45">
                  Rincian item lengkap dibuka dari modul PR utama agar data vendor, order, dan penerimaan tetap sinkron.
                </div>
              ) : null}

              {/* WOV Items list layout */}
              {type === "WOV" && wovItems.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-500/70">
                    Daftar Pekerjaan Vendor ({wovItems.length})
                  </span>
                  <div className="border border-white/[0.06] rounded-2xl bg-black/40 overflow-hidden divide-y divide-white/[0.04]">
                    {wovItems.map((it: any, idx: number) => (
                      <div key={idx} className="p-3.5 flex items-start justify-between text-xs hover:bg-white/[0.01] transition-colors">
                        <div className="flex gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white/90">{it.itemName}</p>
                            <p className="text-[10px] text-white/35 mt-0.5 truncate max-w-[350px]">Kondisi Keluar: {it.goodsConditionOut || "-"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-white/90">{it.quantity || 1} {it.uom || "pcs"}</p>
                          <p className="text-[10px] text-sky-500/60 mt-0.5">Rp {Number(it.estimatedCost || 0).toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons Panel */}
              <div className="border-t border-white/[0.06] pt-5 flex flex-wrap gap-3.5 justify-end">
                <button
                  type="button"
                  onClick={openDetailModule}
                  className="border border-amber-500/30 bg-amber-500/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors"
                >
                  Buka Modul {type}
                </button>

                {/* Print buttons */}
                {type !== "PR" && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={!canPrint}
                    title={!canPrint ? "Dokumen harus disetujui dulu sebelum bisa dicetak" : "Print dokumen"}
                    className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase text-white/50 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    Print Cetakan
                  </button>
                )}
                {type === "PR" && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrintPrSubmission}
                      disabled={!canPrint}
                      title={!canPrint ? "Dokumen harus disetujui dulu sebelum bisa dicetak" : "Print bukti pengajuan"}
                      className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase text-white/50 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      Print Pengajuan
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintPrHandover}
                      disabled={!canPrint}
                      title={!canPrint ? "Dokumen harus disetujui dulu sebelum bisa dicetak" : "Print serah terima barang"}
                      className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase text-white/50 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      Print Serah Terima
                    </button>
                  </>
                )}

                {/* WO KD assignment */}
                {type === "WO" && canApproveWoKd && (
                  <div className="w-full border border-white/5 bg-[#0a0a0c] p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="block text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">PIC</span>
                        <input
                          value={woApprovePicId}
                          onChange={(event) => setWoApprovePicId(event.target.value)}
                          placeholder="ID karyawan PIC"
                          className="h-8 w-full border border-white/10 bg-black px-2 text-[11px] font-mono text-white outline-none focus:border-amber-500/40"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">Jam Kerja</span>
                        <input
                          type="number"
                          min={0.25}
                          step={0.25}
                          value={woApproveHours}
                          onChange={(event) => setWoApproveHours(event.target.value)}
                          placeholder="Contoh: 6"
                          className="h-8 w-full border border-white/10 bg-black px-2 text-[11px] font-mono text-white outline-none focus:border-amber-500/40"
                        />
                      </label>
                    </div>
                    <input
                      value={woApproveNotes}
                      onChange={(event) => setWoApproveNotes(event.target.value)}
                      placeholder="Catatan approval jika ada"
                      className="mt-2 h-8 w-full border border-white/10 bg-black px-2 text-[11px] font-mono text-white outline-none focus:border-amber-500/40"
                    />
                  </div>
                )}

                {(type === "WO" && (canApproveWoAdvisor || canApproveWoKp || canApproveWoPm)) && (
                  <input
                    value={woApproveNotes}
                    onChange={(event) => setWoApproveNotes(event.target.value)}
                    placeholder="Catatan approval jika ada"
                    className="h-8 min-w-[220px] border border-white/10 bg-black px-2 text-[11px] font-mono text-white outline-none focus:border-amber-500/40"
                  />
                )}

                {/* WO Approve */}
                {type === "WO" && canApproveWo && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const estimatedHours = Number(woApproveHours);
                      if (canApproveWoKd && (!woApprovePicId.trim() || !Number.isFinite(estimatedHours) || estimatedHours <= 0)) {
                        setError("PIC dan jam kerja wajib diisi oleh KD penerima.");
                        return;
                      }
                      handleAction(
                        () => approveWo(id, {
                          picId: canApproveWoKd ? woApprovePicId.trim() : null,
                          estimatedHours: canApproveWoKd ? estimatedHours : null,
                          notes: woApproveNotes.trim() || null,
                        }),
                        canApproveWoPm ? "WO disetujui PM dan masuk countdown." : "Approval WO diteruskan.",
                      );
                    }}
                    className="border border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    {canApproveWoPm ? "Approve PM" : canApproveWoKp ? "Approve KP" : canApproveWoAdvisor ? "Approve Advisor" : "Approve KD"}
                  </button>
                )}

                {/* WO Done */}
                {type === "WO" && canDoneWo && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleAction(() => markWoDone(id), "Work order berhasil diselesaikan.")}
                    className="border border-amber-500/40 bg-amber-500/[0.06] text-amber-500 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Tandai Selesai
                  </button>
                )}

                {/* WO Reject triggers subform */}
                {type === "WO" && canRejectWo && !showRejectForm && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="border border-red-500/20 bg-red-500/[0.04] text-red-400 px-3 py-1.5 text-[10px] font-mono uppercase"
                  >
                    Tolak WO
                  </button>
                )}

                {/* PR Actions */}
                {type === "PR" && canApprovePr && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleAction(() => approvePr(id, { notes: "Approved via requests space" }), "PR disetujui.")}
                    className="border border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Approve PR
                  </button>
                )}

                {type === "PR" && canOrderPr && (
                  <button
                    type="button"
                    onClick={openDetailModule}
                    className="border border-purple-500/30 bg-purple-500/[0.04] text-purple-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Lanjutkan Order di PR
                  </button>
                )}

                {type === "PR" && canReceivePr && (
                  <button
                    type="button"
                    onClick={openDetailModule}
                    className="border border-sky-500/30 bg-sky-500/[0.04] text-sky-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Lanjutkan Receive di PR
                  </button>
                )}

                {/* Vendor WO Actions */}
                {type === "WOV" && canApproveWov && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleAction(() => approveVendor(id, { notes: "Approved via requests space" }), "Vendor WO disetujui.")}
                    className="border border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Setujui WOV
                  </button>
                )}

                {type === "WOV" && canReceiveWov && (
                  <button
                    type="button"
                    onClick={openDetailModule}
                    className="border border-sky-500/30 bg-sky-500/[0.04] text-sky-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                  >
                    Lanjutkan Receive di WOV
                  </button>
                )}

              </div>

              {/* Sub-form Reject */}
              {showRejectForm && (
                <div className="mt-4 p-4 border border-white/5 bg-[#0a0a0c] space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-red-400">Tulis Alasan Penolakan</span>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Contoh: Deskripsi kerja kurang detail / Divisi sedang overload..."
                    className="w-full min-h-20 border border-white/10 bg-[#0a0a0c] p-3 text-[11px] font-mono text-white outline-none focus:border-amber-500/40 transition-colors placeholder:text-white/20"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="border border-white/10 px-3 py-1.5 text-[10px] font-mono uppercase text-white/50 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={pending || !rejectReason.trim()}
                      onClick={() => handleAction(() => rejectWo(id, { reason: rejectReason.trim() }), "Work order ditolak.")}
                      className="border border-red-500/20 bg-red-500/[0.04] text-red-400 px-3 py-1.5 text-[10px] font-mono uppercase disabled:opacity-30"
                    >
                      Tolak Permanen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Riwayat Status</span>
              <div className="space-y-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.06]">
                <div className="relative">
                  <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-amber-500 border border-black shadow" />
                  <p className="text-xs font-semibold text-white/80">Dokumen Dibuat</p>
                  <p className="text-[10px] text-white/35 mt-0.5">Oleh {woRecord?.picName || prRecord?.requestedByName || vendorRecord?.requestedByName} · {woRecord?.createdAt || prRecord?.createdAt || vendorRecord?.createdAt}</p>
                </div>
                {status !== "OPEN" && (
                  <div className="relative">
                    <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-emerald-500 border border-black shadow" />
                    <p className="text-xs font-semibold text-white/80">Status Saat Ini: <span className="text-emerald-400 font-bold">{humanizeCodeLabel(status)}</span></p>
                    <p className="text-[10px] text-white/35 mt-0.5">Terakhir dimutasi di sistem</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
