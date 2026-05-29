import type { GridFilter } from "@smsystem/contracts/grid";
import type { WarehouseTab } from "@smsystem/contracts/warehouse";
import { permissionCodes, type PermissionCode } from "@smsystem/permissions";

type WarehouseSectionGroupId = "overview" | "operations" | "references";
type WarehouseView = "active" | "pending" | "ready" | "field" | "overdue" | "all";

export type WarehouseSectionId =
  | "overview"
  | "stock-items"
  | "stock-movements"
  | "stock-card"
  | "stock-adjustment"
  | "stock-opname"
  | "operations-requests"
  | "operations-ready"
  | "operations-field"
  | "operations-returns"
  | "operations-delivery"
  | "operations-transfer"
  | "reference-usage"
  | "reference-locations";

export interface WarehouseSectionDefinition {
  id: WarehouseSectionId;
  groupId: WarehouseSectionGroupId;
  groupLabel: string;
  label: string;
  href: string;
  tab: WarehouseTab;
  permission: PermissionCode;
  status: "active" | "prepared";
  title: string;
  description: string;
  helper: string;
  preparedNote?: string;
}

interface WarehouseSectionSeed {
  id: WarehouseSectionId;
  groupId: WarehouseSectionGroupId;
  label: string;
  tab: WarehouseTab;
  permission: PermissionCode;
  status: "active" | "prepared";
  title: string;
  description: string;
  helper: string;
  preparedNote?: string;
  view?: WarehouseView;
  filters?: GridFilter[];
}

export const warehouseSectionGroups: Array<{
  id: WarehouseSectionGroupId;
  label: string;
}> = [{ id: "overview", label: "Warehouse" }];

function buildWarehouseHref(input: {
  section: WarehouseSectionId;
  tab: WarehouseTab;
  view?: WarehouseView;
  filters?: GridFilter[];
}) {
  const params = new URLSearchParams();
  params.set("section", input.section);
  params.set("tab", input.tab);

  if (input.view) {
    params.set("view", input.view);
  }

  for (const filter of input.filters ?? []) {
    params.append("filter", `${filter.field}:${filter.operator}:${filter.value}`);
  }

  return `/warehouse?${params.toString()}`;
}

const warehouseSectionSeeds: WarehouseSectionSeed[] = [
  {
    id: "overview",
    groupId: "overview",
    label: "Dashboard",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Dashboard warehouse",
    description:
      "Pantau permintaan aktif, barang siap keluar, barang yang masih dipakai, dan jalur simpan kembali dalam satu tempat.",
    helper:
      "Fokus utama bagian ini adalah melihat beban kerja gudang hari ini tanpa harus pindah-pindah layar.",
    view: "active",
  },
  {
    id: "stock-items",
    groupId: "references",
    label: "Daftar Barang",
    tab: "items",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Daftar barang dan material",
    description:
      "Lihat daftar barang baku, kategori, satuan, dan jejak pemakaian yang sudah tercatat di gudang.",
    helper:
      "Cocok dipakai untuk cek apakah nama barang sudah konsisten sebelum dipakai di transaksi berikutnya.",
  },
  {
    id: "stock-movements",
    groupId: "overview",
    label: "Transaksi",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Transaksi warehouse",
    description:
      "Lihat riwayat pengajuan, persetujuan, pengambilan, pengembalian, dan simpan kembali dalam satu alur.",
    helper:
      "Bagian ini setara dengan tab aktivitas di mobile, dipakai saat perlu cek jejak proses yang sudah lewat.",
    view: "all",
  },
  {
    id: "stock-card",
    groupId: "overview",
    label: "Stock Card",
    tab: "stock-card",
    permission: permissionCodes.warehouseStockCardView,
    status: "active",
    title: "Stock card bahan, sparepart, dan tools",
    description:
      "Cek posisi fisik, kondisi barang, label lokasi, dan riwayat masuk-keluar untuk bahan, sparepart, dan tools.",
    helper:
      "Dipakai saat perlu melacak barang per unit, panel, atau lokasi rak secara lebih rinci.",
  },
  {
    id: "stock-adjustment",
    groupId: "references",
    label: "Penyesuaian Stok",
    tab: "adjustments",
    permission: permissionCodes.warehouseStockAdjustmentView,
    status: "active",
    title: "Penyesuaian stok",
    description:
      "Catat koreksi selisih stok, barang rusak, barang hilang, atau koreksi manual dengan jejak alasan yang jelas.",
    helper:
      "Bagian ini dipakai setelah selisih ditemukan, baik dari opname maupun koreksi operasional lain yang memang perlu dicatat resmi.",
  },
  {
    id: "stock-opname",
    groupId: "references",
    label: "Stock Opname",
    tab: "opname",
    permission: permissionCodes.warehouseStockOpnameView,
    status: "active",
    title: "Stock opname",
    description:
      "Cocokkan jumlah fisik barang dengan catatan gudang, lalu tandai apakah sesuai, kurang, lebih, atau tidak ditemukan.",
    helper:
      "Gunakan jalur ini saat pengecekan fisik barang di rak, area simpan, atau part yang terkait langsung ke unit tertentu.",
  },
  {
    id: "operations-requests",
    groupId: "operations",
    label: "Pengajuan",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Pengajuan barang yang masih berjalan",
    description:
      "Lihat pengajuan yang belum selesai, mulai dari menunggu persetujuan sampai menunggu proses gudang.",
    helper:
      "Ini mengikuti tab pengajuan di mobile agar pengguna langsung paham posisi permintaannya.",
    view: "active",
  },
  {
    id: "operations-ready",
    groupId: "operations",
    label: "Antrean Gudang",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Antrean kerja gudang",
    description:
      "Pantau item yang sedang menunggu keputusan, perlu disiapkan, siap diambil, atau perlu ditindaklanjuti gudang.",
    helper:
      "Bagian ini disesuaikan dengan tab antrean pada mobile untuk staf gudang dan approver.",
    view: "active",
  },
  {
    id: "operations-field",
    groupId: "operations",
    label: "Barang di Lapangan",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Barang yang sedang dipakai di unit atau workshop",
    description:
      "Pantau alat atau material yang sudah keluar dari gudang dan masih ada di lapangan atau area kerja.",
    helper:
      "Dipakai untuk kontrol keterlambatan, tindak lanjut pengembalian, dan memastikan barang tidak hilang dari alur gudang.",
    view: "field",
  },
  {
    id: "operations-returns",
    groupId: "operations",
    label: "Pengembalian",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Pengembalian barang dan simpan kembali",
    description:
      "Fokus ke transaksi pengembalian alat atau part yang sudah selesai dipakai sebelum kembali masuk penyimpanan.",
    helper:
      "Gunakan bagian ini untuk menindaklanjuti barang yang harus dicek kondisinya sebelum dinyatakan selesai dan tersimpan lagi.",
    filters: [{ field: "transactionType", operator: "eq", value: "PENGEMBALIAN" }],
    view: "all",
  },
  {
    id: "operations-delivery",
    groupId: "operations",
    label: "Delivery / Serah Terima",
    tab: "transactions",
    permission: permissionCodes.warehouseView,
    status: "prepared",
    title: "Delivery dan serah terima sedang disiapkan",
    description:
      "Area kerja ini disiapkan untuk memisahkan jalur barang siap keluar, serah terima ke peminta, dan bukti barang sudah diterima.",
    helper:
      "Saat ini antriannya tetap bisa dipantau lewat data barang siap dikeluarkan di bawah.",
    preparedNote:
      "Struktur data aktif belum punya tabel serah terima terpisah. Jalur ini disiapkan dulu agar nanti bisa ditambah bukti penerimaan tanpa membongkar tata letak halaman.",
    view: "ready",
  },
  {
    id: "operations-transfer",
    groupId: "references",
    label: "Transfer Lokasi",
    tab: "locations",
    permission: permissionCodes.warehouseView,
    status: "prepared",
    title: "Transfer lokasi penyimpanan sedang disiapkan",
    description:
      "Area kerja ini disiapkan untuk perpindahan barang antar rak, zona, workshop, atau titik simpan lain yang resmi.",
    helper:
      "Peta lokasi yang ada sekarang tetap bisa dipakai untuk menyiapkan standar label dan tujuan perpindahan.",
    preparedNote:
      "Struktur data aktif baru punya master lokasi dan relasi lokasi di kartu stok. Riwayat transfer lokasi khusus belum tersedia sebagai tabel terpisah.",
  },
  {
    id: "reference-usage",
    groupId: "references",
    label: "Pemakaian Material",
    tab: "usage",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Pemakaian material per unit dan divisi",
    description:
      "Baca material yang benar-benar terpakai untuk unit, divisi, dan PIC agar gudang punya dasar kebutuhan ulang yang lebih akurat.",
    helper:
      "Bagian ini membantu melihat barang cepat habis, pola pemakaian, dan beban material tiap pekerjaan.",
  },
  {
    id: "reference-locations",
    groupId: "overview",
    label: "Lokasi",
    tab: "locations",
    permission: permissionCodes.warehouseView,
    status: "active",
    title: "Peta lokasi penyimpanan aktif",
    description:
      "Lihat daftar zona, rak, shelf, dan kapasitas isi lokasi yang sudah dipakai untuk penyimpanan barang.",
    helper:
      "Dipakai untuk menata label gudang dan memastikan penempatan barang tetap konsisten.",
  },
];

export const warehouseSectionDefinitions: WarehouseSectionDefinition[] = warehouseSectionSeeds.map(
  (section) => {
    const groupLabel =
      warehouseSectionGroups.find((group) => group.id === section.groupId)?.label ??
      "Warehouse";

    return {
      ...section,
      groupLabel,
      href: buildWarehouseHref({
        section: section.id,
        tab: section.tab,
        view: section.view,
        filters: section.filters,
      }),
    };
  },
);

export function resolveWarehouseSection(
  input: string | string[] | undefined,
): WarehouseSectionId {
  const rawValue = Array.isArray(input) ? input[0] : input;
  const fallback: WarehouseSectionId = "overview";

  if (!rawValue) {
    return fallback;
  }

  return (
    warehouseSectionDefinitions.find((section) => section.id === rawValue)?.id ?? fallback
  );
}

export function getWarehouseSectionDefinition(
  sectionId: WarehouseSectionId,
): WarehouseSectionDefinition {
  return (
    warehouseSectionDefinitions.find((section) => section.id === sectionId) ??
    warehouseSectionDefinitions[0]
  );
}
