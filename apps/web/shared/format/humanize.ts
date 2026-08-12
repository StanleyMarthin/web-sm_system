const CODE_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  OPEN: "Terbuka",
  SUBMITTED: "Diajukan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  DONE: "Selesai",
  CLOSED: "Ditutup",
  CANCELLED: "Dibatalkan",
  CANCEL: "Dibatalkan",
  ARRIVED: "Sudah Datang",
  ORDERED: "Sudah Dipesan",
  HUNTING: "Sedang Dicari",
  READY: "Siap",
  RELEASED: "Keluar",
  RETURNED: "Dikembalikan",
  STORED: "Tersimpan",
  LOST: "Hilang",
  PLAN: "Rencana",
  DRAFT: "Draft",
  PROSES: "Proses",
  QC_READY: "Siap QC",
  IN_PROGRESS: "Sedang Berjalan",
  INPROGRESS: "Sedang Berjalan",
  PENDING: "Menunggu",
  PENDING_ADV: "Menunggu QA",
  PENDING_ADVISOR_APPROVAL: "Menunggu Persetujuan QA",
  ADVISOR: "QA",
  ADV: "QA",
  QA: "QA",
  QUALITY_ASSURANCE: "QA",
  PENDING_KP: "Menunggu KP",
  PENDING_MP: "Menunggu MP",
  PENDING_PM: "Menunggu PM",
  PENDING_KEPALA_GUDANG: "Menunggu Kepala Gudang",
  PENDING_PPIC: "Menunggu PPIC",
  SENT: "Dikirim",
  PROSES_VENDOR: "Diproses Vendor",
  DONE_VENDOR: "Selesai di Vendor",
  REWORK_VENDOR: "Kembali ke Vendor",
  TIDAK_LOLOS: "Tidak Lolos",
  GOOD: "Baik",
  BAD: "Perlu Cek",
  ONPROGRESS: "Sedang Dikerjakan",
  PENGAMBILAN: "Pengambilan",
  PENGEMBALIAN: "Pengembalian",
  PENYIMPANAN: "Penyimpanan",
  PEMINJAMAN: "Peminjaman",
  SPARE_PART: "Spare Part",
  TOOLS: "Peralatan",
  BAHAN: "Bahan",
  CONSUMABLE: "Barang Habis Pakai",
  MATERIAL: "Bahan",
  ADDITIONAL: "Tambahan",
  MAIN: "Utama",
  WOV: "Vendor",
  LOKAL: "Lokal",
  LN: "Luar Negeri",
  UNKNOWN: "Belum Diketahui",
  HIGH: "Tinggi",
  NORMAL: "Normal",
  LOW: "Rendah",
  TRUE: "Ya",
  FALSE: "Tidak",
  YES: "Ya",
  NO: "Tidak",
  GREEN: "Aman",
  YELLOW: "Perlu Perhatian",
  ORANGE: "Waspada",
  RED: "Kritis",
  FIELD: "Lapangan",
  IN_STORAGE: "Di Gudang",
  RETRIEVED: "Sudah Diambil",
  INSTALLED: "Terpasang",
  BARU: "Baru",
  RESTORE: "Restorasi",
  BEKAS: "Bekas",
  GUDANG: "Gudang",
  WORKSHOP: "Workshop",
  UNIT: "Unit",
  SELF: "Pribadi",
  ASSIGNED: "Sesuai Penugasan",
  GLOBAL: "Semua Unit",
  RESOLVED: "Terselesaikan",
};

const ACRONYMS = new Set(["ETA", "ID", "KP", "LN", "MP", "PIC", "PM", "PR", "QC", "SPK", "WO", "WOV"]);

export function humanizeCodeLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return "-";
  }

  const normalizedValue = rawValue.replace(/[\s-]+/g, "_").toUpperCase();
  const mappedValue = CODE_LABELS[normalizedValue];
  if (mappedValue) {
    return mappedValue;
  }

  return rawValue
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (ACRONYMS.has(upperWord) || /^[A-Z0-9]{2,}$/u.test(word)) {
        return upperWord;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

/**
 * Format jam ke H:mm (tanpa leading zero pada jam).
 * Input: ISO datetime ("2026-06-15 09:05:00"), time ("09:05"), atau Date.
 * Contoh: "2026-06-15 09:05:00" → "9:05" | "14:30:00" → "14:30"
 */
export function fmtTime(value: unknown): string {
  if (!value) return "-";

  try {
    const str = value instanceof Date ? value.toISOString() : String(value).trim();

    // Pure time string: HH:MM or HH:MM:SS
    const pureTime = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str);
    if (pureTime) {
      const h = parseInt(pureTime[1]!, 10);
      const m = pureTime[2]!;
      return `${h}:${m}`;
    }

    // Datetime string "YYYY-MM-DD HH:MM:SS" or ISO
    const normalized = str.includes(" ") ? str.replace(" ", "T") : str;
    const date = new Date(normalized.includes("T") ? normalized : `${normalized}T00:00:00`);
    if (isNaN(date.getTime())) return str;

    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return String(value);
  }
}

/**
 * Format datetime ke "D MMM · H:mm".
 * Contoh: "2026-06-15 14:30:00" → "15 Jun · 14:30"
 */
export function fmtDateTime(value: unknown): string {
  if (!value) return "-";

  try {
    const str = value instanceof Date ? value.toISOString() : String(value).trim();
    const normalized = str.includes(" ") ? str.replace(" ", "T") : str;
    const date = new Date(normalized.includes("T") ? normalized : `${normalized}T00:00:00`);
    if (isNaN(date.getTime())) return str;

    const day = date.getDate();
    const month = date.toLocaleString("id-ID", { month: "short" });
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${day} ${month} · ${h}:${m}`;
  } catch {
    return String(value);
  }
}
