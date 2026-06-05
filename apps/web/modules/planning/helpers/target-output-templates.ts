/**
 * Smart Target Output Templates
 * Rekomendasi kalimat target output yang konkrit per kategori divisi.
 * Kata kunci nama divisi dicocokkan secara partial (case-insensitive).
 */

export interface OutputTemplate {
  label: string;
  defaultHours: number;
}

export interface DivisionTemplate {
  /** Kata kunci untuk mencocokkan nama divisi (partial match, case-insensitive) */
  keywords: string[];
  templates: OutputTemplate[];
}

const DIVISION_TEMPLATES: DivisionTemplate[] = [
  {
    keywords: ["body work", "bdw", "bodywork"],
    templates: [
      { label: "Dempul seluruh panel bodi selesai rata dan siap amplas halus", defaultHours: 16 },
      { label: "Amplas final seluruh permukaan bodi selesai siap cat primer", defaultHours: 8 },
      { label: "Proses ketok penyok panel pintu kiri selesai rata", defaultHours: 8 },
      { label: "Bongkar dan pasang kembali seluruh panel depan kendaraan", defaultHours: 12 },
      { label: "Perapian jalur body kit terpasang dan tersambung rapi", defaultHours: 6 },
      { label: "Pemasangan spoiler dan skirt belakang selesai dan terpasang kuat", defaultHours: 4 },
      { label: "Proses buka cat lama (stripping) bodi samping kanan selesai", defaultHours: 8 },
    ],
  },
  {
    keywords: ["body paint", "bdp", "cat"],
    templates: [
      { label: "Cat dasar (primer) seluruh bodi kendaraan selesai kering sempurna", defaultHours: 8 },
      { label: "Cat akhir (top coat) seluruh bodi kendaraan selesai kilap merata", defaultHours: 16 },
      { label: "Cat panel pintu kanan dan kiri selesai warna sesuai kode", defaultHours: 8 },
      { label: "Clear coat dan poles akhir seluruh bodi selesai siap delivery", defaultHours: 8 },
      { label: "Proses masking seluruh kendaraan selesai siap cat", defaultHours: 4 },
      { label: "Cat ulang bumper depan dan belakang selesai merata", defaultHours: 6 },
      { label: "Touch-up area baret minor selesai tidak terlihat bekas", defaultHours: 2 },
    ],
  },
  {
    keywords: ["mechanic", "mec", "mekanik"],
    templates: [
      { label: "Bongkar dan overhaul mesin selesai, komponen diperiksa dan dilaporkan", defaultHours: 24 },
      { label: "Penggantian oli mesin, filter, dan cairan transmisi selesai", defaultHours: 2 },
      { label: "Servis rem depan dan belakang selesai, cakram dan kampas diganti", defaultHours: 4 },
      { label: "Perbaikan sistem pendingin (radiator, termostat) selesai dan tidak bocor", defaultHours: 6 },
      { label: "Penggantian timing belt/chain selesai sesuai spesifikasi pabrikan", defaultHours: 12 },
      { label: "Diagnosa dan perbaikan kelistrikan sistem EFI selesai, tidak ada error code", defaultHours: 8 },
      { label: "Tune-up lengkap (busi, filter, injector) selesai dan mesin berjalan normal", defaultHours: 4 },
      { label: "Perbaikan suspensi depan selesai, tidak ada bunyi abnormal", defaultHours: 8 },
    ],
  },
  {
    keywords: ["interior", "int"],
    templates: [
      { label: "Jok depan dan belakang re-upholster selesai, jahitan rapi dan kencang", defaultHours: 24 },
      { label: "Pemasangan headliner baru selesai, tidak ada gelombang", defaultHours: 8 },
      { label: "Dashboard bongkar bersih dan pasang ulang trim interior selesai", defaultHours: 12 },
      { label: "Karpet lantai baru terpasang rapi dan tidak ada bagian terangkat", defaultHours: 6 },
      { label: "Pemasangan sistem audio head unit dan speaker baru selesai", defaultHours: 6 },
      { label: "Pemasangan konsol tengah custom selesai, fitting sempurna", defaultHours: 8 },
      { label: "Perbaikan door trim dan door panel kanan kiri selesai", defaultHours: 4 },
      { label: "Pemasangan film kaca (window tint) selesai, tidak ada gelembung udara", defaultHours: 4 },
    ],
  },
  {
    keywords: ["bubut", "bbt", "lathe"],
    templates: [
      { label: "Bubut disc brake depan dan belakang selesai sesuai ukuran spesifikasi", defaultHours: 4 },
      { label: "Pembuatan komponen custom (bushing/bracket) selesai sesuai gambar teknik", defaultHours: 8 },
      { label: "Pemesinan poros roda selesai ukuran presisi", defaultHours: 6 },
      { label: "Boring cylinder head selesai sesuai oversize yang ditentukan", defaultHours: 8 },
      { label: "Bubut dan balancing velg/roda selesai", defaultHours: 3 },
    ],
  },
  {
    keywords: ["chrome", "chr", "krom"],
    templates: [
      { label: "Proses pelapisan chrome eksterior selesai kilap merata", defaultHours: 16 },
      { label: "Chrome bumper depan belakang selesai, tidak ada cacat", defaultHours: 12 },
      { label: "Pelapisan velg chrome selesai sempurna", defaultHours: 8 },
      { label: "Chrome aksesoris (list bodi, emblem) selesai terpasang", defaultHours: 4 },
    ],
  },
];

const DEFAULT_TEMPLATES: OutputTemplate[] = [
  { label: "Pekerjaan unit ini selesai 100% dan siap delivery ke customer", defaultHours: 8 },
  { label: "Inspeksi akhir (final QC) unit selesai, semua catatan perbaikan tuntas", defaultHours: 2 },
  { label: "Pembersihan total unit dan packing delivery selesai", defaultHours: 2 },
];

/** Mengambil rekomendasi template berdasarkan nama divisi */
export function getTemplatesForDivision(divisionName: string): OutputTemplate[] {
  const lower = divisionName.toLowerCase();
  for (const group of DIVISION_TEMPLATES) {
    if (group.keywords.some((kw) => lower.includes(kw))) {
      return group.templates;
    }
  }
  return DEFAULT_TEMPLATES;
}

// ─── LocalStorage saved templates ─────────────────────────────────────

const STORAGE_KEY = "sm_planning_saved_templates";

interface SavedTemplatesStore {
  [divisionId: number]: string[];
}

export function getSavedTemplates(divisionId: number): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTemplatesStore;
    return parsed[divisionId] ?? [];
  } catch {
    return [];
  }
}

export function saveTemplate(divisionId: number, text: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const store: SavedTemplatesStore = raw ? (JSON.parse(raw) as SavedTemplatesStore) : {};
    const existing = store[divisionId] ?? [];
    if (!existing.includes(text)) {
      store[divisionId] = [text, ...existing].slice(0, 10); // max 10 per divisi
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore storage errors
  }
}

export function deleteSavedTemplate(divisionId: number, text: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const store: SavedTemplatesStore = JSON.parse(raw) as SavedTemplatesStore;
    store[divisionId] = (store[divisionId] ?? []).filter((t) => t !== text);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}
