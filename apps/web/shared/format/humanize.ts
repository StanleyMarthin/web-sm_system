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
  PENDING_ADV: "Menunggu Advisor",
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
  IN_STORAGE: "Tersimpan",
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
