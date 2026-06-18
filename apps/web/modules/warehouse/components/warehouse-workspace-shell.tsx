"use client";

import Image from "next/image";
import type {
  CreateWarehouseRequest,
  CreateWarehouseStorageLocation,
  UpdateWarehouseStorageLocation,
  WarehouseDashboardDivisionUsageRecord,
  WarehouseDashboardLateUserRecord,
  WarehouseDashboardLowStockRecord,
  WarehouseDashboardMaterialOutRecord,
  WarehouseDashboardSummary,
  WarehouseItemRecord,
  WarehouseMaterialUsageRecord,
  WarehouseRequestEmployeeOption,
  WarehouseRequestJobOption,
  WarehouseRequestStockCardOption,
  WarehouseStockAdjustmentRecord,
  WarehouseStockCardRecord,
  WarehouseStockOpnameRecord,
  WarehouseStorageLocationRecord,
  WarehouseTab,
  WarehouseTransactionQuery,
  WarehouseTransactionRecord,
  WarehouseTransactionsSummary,
} from "@smsystem/contracts/warehouse";
import type { GridQueryState } from "@smsystem/contracts/grid";
import {
  AlertTriangle,
  Boxes,
  CheckCheck,
  ClipboardList,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  MapPinned,
  PackagePlus,
  Pencil,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CompactDateRangeInput } from "@/shared/ui/compact";
import { type WarehouseSectionId } from "@/modules/warehouse/config/workspace";
import {
  approveWarehouseRequest,
  createWarehouseRequest,
  createWarehouseStorageLocation,
  fetchWarehouseRequestReferencesClient,
  fetchWarehouseStorageLocationsClient,
  issueWarehouseRequest,
  readyWarehouseRequest,
  requestWarehouseStockCardUploadTicket,
  returnWarehouseRequest,
  storeWarehouseRequest,
  updateWarehouseStockCardPhotos,
  updateWarehouseStorageLocation,
  deleteWarehouseStorageLocation,
  rejectWarehouseRequest,
} from "@/shared/api/warehouse";
import { WarehouseReturnForm, type ReturnFormValues } from "./forms/warehouse-return-form";
import { WarehouseStoreForm, type StoreFormValues } from "./forms/warehouse-store-form";
import { WarehouseLocationForm, type LocationFormValues } from "./forms/warehouse-location-form";
import { WarehouseRequestForm, type RequestFormValues } from "./forms/warehouse-request-form";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridFilterDefinition,
  SmartDataGridRow,
} from "@/shared/datagrid/types";
import { humanizeCodeLabel } from "@/shared/format/humanize";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

interface WarehouseShellProps {
  mode: "requester" | "console";
  activeTab: WarehouseTab;
  activeSection: WarehouseSectionId;
  canRequest: boolean;
  canApprove: boolean;
  canReady: boolean;
  canIssue: boolean;
  canReturn: boolean;
  canManageStockCard: boolean;
  canManageLocation: boolean;
  canCreateOpname: boolean;
  canCreateAdjustment: boolean;
  currentUserDivisionId?: string | null;
  currentUserDivisionName?: string | null;
  currentUserFullName?: string | null;
  canChooseRequestDivision?: boolean;
  dashboard?: {
    summary: WarehouseDashboardSummary;
    lateUsers: WarehouseDashboardLateUserRecord[];
    divisionsUsing: WarehouseDashboardDivisionUsageRecord[];
    materialsOut: WarehouseDashboardMaterialOutRecord[];
    lowStockAlerts: WarehouseDashboardLowStockRecord[];
  } | null;
  transactions?: {
    rows: WarehouseTransactionRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: WarehouseTransactionQuery;
    references: {
      units: Array<{ value: string; label: string }>;
      divisions: Array<{ value: string; label: string }>;
      itemCategories: Array<{ value: string; label: string }>;
      itemStatuses: Array<{ value: string; label: string }>;
      approvalStatuses: Array<{ value: string; label: string }>;
      transactionTypes: Array<{ value: string; label: string }>;
    };
    summary: WarehouseTransactionsSummary;
    pendingApprovals: WarehouseTransactionRecord[];
  };
  requestReferences?: {
    jobs: WarehouseRequestJobOption[];
    stockCards: WarehouseRequestStockCardOption[];
    employees: WarehouseRequestEmployeeOption[];
  } | null;
  locationOptions?: WarehouseStorageLocationRecord[];
  stockCard?: {
    rows: WarehouseStockCardRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
  items?: {
    rows: WarehouseItemRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
  usage?: {
    rows: WarehouseMaterialUsageRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
  locations?: {
    rows: WarehouseStorageLocationRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
  stockOpnames?: {
    rows: WarehouseStockOpnameRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
  stockAdjustments?: {
    rows: WarehouseStockAdjustmentRecord[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    state: GridQueryState;
  };
}

interface ReturnModalState {
  transactionId: string;
  itemName: string;
  qtyReturned: string;
}

interface StoreModalState {
  transactionId: string;
  itemName: string;
}

interface LocationModalState {
  isOpen: boolean;
  initialValues: LocationFormValues | null;
}

const darkSelectStyle = {
  backgroundColor: "var(--card)",
  color: "var(--card-foreground)",
} as const;





function buildStorageLocationDetail(location: WarehouseStorageLocationRecord): string {
  const segments: string[] = [];

  if (location.zone) {
    segments.push(location.zone);
  }

  if (location.rack) {
    segments.push(`Rak ${location.rack}`);
  }

  if (location.shelf) {
    segments.push(`Shelf ${location.shelf}`);
  }

  return segments.join(" · ");
}

function getTransactionDate(state: WarehouseTransactionQuery) {
  return state.dateFrom ?? new Date().toISOString().slice(0, 10);
}

function isActiveWarehouseTransaction(row: WarehouseTransactionRecord) {
  if (row.approvalStatus.startsWith("PENDING")) {
    return true;
  }

  return (
    row.approvalStatus === "APPROVED" &&
    ["OPEN", "READY", "RELEASED", "RETURNED"].includes(row.itemStatus)
  );
}

function buildGridFilters(
  references: NonNullable<WarehouseShellProps["transactions"]>["references"],
): SmartDataGridFilterDefinition[] {
  return [
    { field: "itemCategory", label: "Kategori", options: references.itemCategories },
    { field: "itemStatus", label: "Status", options: references.itemStatuses },
    { field: "approvalStatus", label: "Persetujuan", options: references.approvalStatuses },
    { field: "divisionId", label: "Divisi", options: references.divisions },
    { field: "transactionType", label: "Jenis", options: references.transactionTypes },
  ];
}

function SummaryBlock({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">{label}</p>
      <p className="mt-1 font-mono text-[13px] font-semibold text-foreground dark:text-foreground">{value}</p>
    </div>
  );
}

function Sheet({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border dark:border-white/[0.05] px-3 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">{title}</h3>
        {action}
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function TableList({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: Array<React.ReactNode[]>;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground dark:text-foreground/35">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto border border-border dark:border-white/[0.05] bg-muted dark:bg-background">
      <table className="min-w-full text-left text-[12px]">
        <thead className="sticky top-0 z-10 bg-white dark:bg-card">
          <tr className="border-b border-border dark:border-white/[0.06] bg-white dark:bg-card font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`row-${index}`}
              className="border-b border-white/[0.04] transition-colors last:border-b-0 hover:bg-muted dark:hover:bg-white/[0.02]"
            >
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`} className="px-3 py-2 align-top text-[12px] text-foreground/82">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl border border-border dark:border-white/[0.08] bg-popover">
        <div className="flex items-center justify-between gap-3 border-b border-border dark:border-white/[0.06] px-4 py-3">
          <h3 className="text-[13px] font-medium text-foreground dark:text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="border border-border dark:border-white/[0.08] p-2 text-muted-foreground dark:text-foreground/55 transition-colors hover:text-foreground dark:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

const stockCardColumns: SmartDataGridColumn[] = [
  {
    key: "photoPreview",
    label: "Foto",
    widthClassName: "w-20",
    renderCell: (value, row) => {
      const photoUrls = Array.isArray((row as unknown as { photoUrls?: unknown }).photoUrls)
        ? ((row as unknown as { photoUrls?: string[] }).photoUrls ?? [])
        : [];
      const firstPhoto = photoUrls[0];
      if (!firstPhoto) {
        return (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border dark:border-white/[0.08] bg-white/[0.02] text-muted-foreground dark:text-foreground/25">
            <ImageIcon className="h-4 w-4" />
          </div>
        );
      }

      return (
        <img
          src={firstPhoto}
          alt={String(row.partName ?? "Foto barang")}
          className="h-12 w-12 rounded-lg border border-border dark:border-white/[0.06] object-cover"
        />
      );
    },
  },
  { key: "unitName", label: "Unit" },
  { key: "panelSection", label: "Panel / Part" },
  { key: "partCode", label: "Kode", kind: "mono" },
  { key: "partName", label: "Barang" },
  { key: "itemCategory", label: "Kategori", kind: "status" },
  { key: "qty", label: "Qty", kind: "number", align: "right" },
  { key: "locationLabel", label: "Lokasi", filterKey: "storageLocationId" },
  { key: "status", label: "Status", kind: "status", filterKey: "status", filterOptions: [
    { value: "IN_STORAGE", label: "IN_STORAGE" },
    { value: "RETRIEVED", label: "RETRIEVED" },
    { value: "INSTALLED", label: "INSTALLED" },
    { value: "LOST", label: "LOST" },
  ] },
];

const locationColumns: SmartDataGridColumn[] = [
  { key: "label", label: "Lokasi", kind: "mono" },
  { key: "locationType", label: "Tipe", kind: "status", filterKey: "locationType", filterOptions: [
    { value: "GUDANG", label: "Gudang" },
    { value: "WORKSHOP", label: "Workshop" },
    { value: "UNIT", label: "Unit" },
  ] },
  { key: "zone", label: "Zona" },
  { key: "rack", label: "Rak" },
  { key: "shelf", label: "Shelf" },
  { key: "itemCount", label: "Isi", kind: "number", align: "right" },
  { key: "isActive", label: "Aktif", kind: "status", filterKey: "isActive", filterOptions: [
    { value: "1", label: "Aktif" },
    { value: "0", label: "Tidak Aktif" },
  ] },
];

const itemColumns: SmartDataGridColumn[] = [
  { key: "itemCode", label: "Kode", kind: "mono" },
  { key: "itemName", label: "Barang" },
  { key: "itemCategory", label: "Kategori", kind: "status" },
  { key: "uom", label: "Satuan" },
  { key: "latestPrice", label: "Harga Terakhir", kind: "number", align: "right" },
  { key: "usageCount", label: "Dipakai", kind: "number", align: "right" },
];

const usageColumns: SmartDataGridColumn[] = [
  { key: "usageDate", label: "Tanggal", kind: "mono" },
  { key: "divisionName", label: "Divisi" },
  { key: "itemName", label: "Bahan" },
  { key: "qty", label: "Qty", kind: "number", align: "right" },
  { key: "uom", label: "Satuan" },
];

const opnameColumns: SmartDataGridColumn[] = [
  { key: "opnameNo", label: "No. Opname", kind: "mono" },
  { key: "unitName", label: "Unit" },
  { key: "itemName", label: "Barang" },
  { key: "varianceQty", label: "Selisih", kind: "number", align: "right" },
  { key: "findingStatus", label: "Hasil", kind: "status" },
];

const adjustmentColumns: SmartDataGridColumn[] = [
  { key: "adjustmentNo", label: "No. Penyesuaian", kind: "mono" },
  { key: "unitName", label: "Unit" },
  { key: "itemName", label: "Barang" },
  { key: "adjustmentQty", label: "Selisih", kind: "number", align: "right" },
  { key: "adjustmentReason", label: "Alasan", kind: "status" },
];

export function WarehouseShell({
  activeTab,
  activeSection,
  canRequest,
  canApprove,
  canReady,
  canIssue,
  canReturn,
  canManageStockCard,
  canManageLocation,
  dashboard,
  transactions,
  requestReferences,
  locationOptions,
  stockCard,
  items,
  usage,
  locations,
  stockOpnames,
  stockAdjustments,
  currentUserDivisionId = null,
  currentUserDivisionName = null,
  currentUserFullName = null,
  canChooseRequestDivision = false,
}: WarehouseShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sweetAlert = useSweetAlert();
  const [isRefreshing, startRefresh] = useTransition();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestJobs, setRequestJobs] = useState<WarehouseRequestJobOption[]>(requestReferences?.jobs ?? []);
  const [requestStockCards, setRequestStockCards] = useState<WarehouseRequestStockCardOption[]>([]);
  const [requestEmployees, setRequestEmployees] = useState<WarehouseRequestEmployeeOption[]>(
    requestReferences?.employees ?? [],
  );
  const [isLoadingRequestRefs, setIsLoadingRequestRefs] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [returnModal, setReturnModal] = useState<ReturnModalState | null>(null);
  const [storeModal, setStoreModal] = useState<StoreModalState | null>(null);
  const [storeLocationOptions, setStoreLocationOptions] = useState<WarehouseStorageLocationRecord[]>([]);
  const [isLoadingStoreLocations, setIsLoadingStoreLocations] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<WarehouseStockCardRecord | null>(null);
  const [photoUrlsDraft, setPhotoUrlsDraft] = useState<string[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [locationModal, setLocationModal] = useState<LocationModalState>({ isOpen: false, initialValues: null });
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const isOverview = activeTab === "transactions" && activeSection === "overview";
  const isTransactions = activeTab === "transactions" && activeSection !== "overview";
  const transactionDate =
    transactions ? getTransactionDate(transactions.state) : new Date().toISOString().slice(0, 10);
  const transactionDateEnd = transactions?.state.dateTo ?? transactionDate;
  const stockCategoryFilter = useMemo(() => {
    const filters = searchParams.getAll("filter");
    const itemCategoryFilter = filters.find((filter) => filter.startsWith("itemCategory:eq:"));
    return itemCategoryFilter?.split(":").at(-1) ?? "";
  }, [searchParams]);
  const prepareRows = useMemo(
    () =>
      (transactions?.rows ?? []).filter(
        (row) => row.approvalStatus === "APPROVED" && row.itemStatus === "OPEN",
      ),
    [transactions],
  );
  const returnedRows = useMemo(
    () => (transactions?.rows ?? []).filter((row) => row.itemStatus === "RETURNED"),
    [transactions],
  );
  const activeTransactionRows = useMemo(
    () => (transactions?.rows ?? []).filter(isActiveWarehouseTransaction),
    [transactions],
  );
  const defaultStoreLocationOptions = useMemo(
    () => (locationOptions ?? []).filter((row) => row.isActive),
    [locationOptions],
  );
  const effectiveStoreLocationOptions =
    storeLocationOptions.length > 0 ? storeLocationOptions : defaultStoreLocationOptions;
  const requestStockCardOptions = useMemo(
    () =>
      requestStockCards.map((stockCard) => ({
        stockCardId: stockCard.stockCardId,
        partName: stockCard.partName,
        partCode: stockCard.partCode ?? "",
        qty: stockCard.qty,
        uom: stockCard.uom,
        unitName: stockCard.unitName,
      })),
    [requestStockCards],
  );


  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      if (!photoTarget) {
        setPhotoUrlsDraft([]);
        setSelectedPhotoUrl(null);
        return;
      }

      setPhotoUrlsDraft(photoTarget.photoUrls);
      setSelectedPhotoUrl(photoTarget.photoUrls[0] ?? null);
    });

    return () => {
      alive = false;
    };
  }, [photoTarget]);

  async function ensureStoreLocationOptions() {
    if (effectiveStoreLocationOptions.length > 0) {
      return effectiveStoreLocationOptions;
    }

    setIsLoadingStoreLocations(true);
    const result = await fetchWarehouseStorageLocationsClient({
      page: "1",
      limit: "100",
      sortBy: "label",
      sortDirection: "asc",
    });
    setIsLoadingStoreLocations(false);

    if (!result.payload) {
      sweetAlert.notifyError(
        "Lokasi belum terbaca",
        "Daftar lokasi penyimpanan belum berhasil dimuat dari server.",
      );
      return [];
    }

    const nextOptions = result.payload.data.filter((row) => row.isActive);
    setStoreLocationOptions(nextOptions);
    return nextOptions;
  }

  async function openStoreModal(input: { transactionId: string; itemName: string }) {
    const options = await ensureStoreLocationOptions();
    if (options.length === 0) {
      sweetAlert.notifyError(
        "Lokasi belum tersedia",
        "Belum ada lokasi aktif yang bisa dipakai untuk simpan kembali.",
      );
      return;
    }

    setStoreModal({
      transactionId: input.transactionId,
      itemName: input.itemName,
    });
  }

  function updateSearch(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    params.delete("page");
    startRefresh(() => {
      router.push(`/warehouse?${params.toString()}`);
    });
  }

  function setTransactionDateRange(start: string, end: string) {
    updateSearch((params) => {
      params.set("section", "stock-movements");
      params.set("tab", "transactions");
      params.set("dateFrom", start);
      params.set("dateTo", end || start);
    });
  }

  function setStockCategory(value: string) {
    updateSearch((params) => {
      params.set("section", "stock-card");
      params.set("tab", "stock-card");
      const nextFilters = params
        .getAll("filter")
        .filter((filter) => !filter.startsWith("itemCategory:eq:"));
      params.delete("filter");
      for (const filter of nextFilters) {
        params.append("filter", filter);
      }
      if (value) {
        params.append("filter", `itemCategory:eq:${value}`);
      }
    });
  }

  async function refreshRequestReferences(input?: {
    divisionId?: string;
    coreId?: string;
    date?: string;
    isOvertime?: boolean;
    transactionType?: "PEMINJAMAN" | "PENGAMBILAN" | "TRANSFER_PART";
  }) {
    const nextDivisionId = input?.divisionId ?? "";
    const nextCoreId = input?.coreId ?? "";
    const nextDate = input?.date ?? transactionDate;
    const nextIsOvertime = input?.isOvertime ?? false;
    const nextTransactionType = input?.transactionType ?? "PEMINJAMAN";

    setIsLoadingRequestRefs(true);
    const response = await fetchWarehouseRequestReferencesClient({
      date: nextDate,
      isOvertime: nextIsOvertime ? "1" : "0",
      divisionId: nextDivisionId || undefined,
      coreId: nextCoreId || undefined,
      transactionType: nextTransactionType,
    });
    if (!response.payload) {
      sweetAlert.notifyError("Referensi belum terbaca", "Pekerjaan gudang untuk tanggal ini belum bisa dimuat.");
      setIsLoadingRequestRefs(false);
      return;
    }
    setRequestJobs(response.payload.data.jobs);
    setRequestEmployees(response.payload.data.employees);
    setRequestStockCards(response.payload.data.stockCards);
    setIsLoadingRequestRefs(false);
  }

  async function handleOpenRequestDialog() {
    setRequestStockCards([]);
    setRequestEmployees(requestReferences?.employees ?? []);
    setIsRequestDialogOpen(true);
    await refreshRequestReferences({
      divisionId: currentUserDivisionId ?? "",
      coreId: "",
      date: transactionDate,
      isOvertime: false,
      transactionType: "PEMINJAMAN",
    });
  }


  async function submitRequest(data: RequestFormValues) {
    if (!data.requesterEmployeeId.trim()) {
      sweetAlert.notifyError("PIC belum dipilih", "Pilih anggota divisi yang mengajukan lebih dulu.");
      return;
    }

    const selectedJob = requestJobs.find((job) => job.coreId === data.coreId);
    if (!selectedJob) {
      sweetAlert.notifyError("Pekerjaan belum dipilih", "Pilih pekerjaan aktif lebih dulu.");
      return;
    }

    const selectedDivision =
      transactions?.references.divisions.find((division) => division.value === data.divisionId) ??
      (data.divisionId && currentUserDivisionId === data.divisionId
        ? {
            value: data.divisionId,
            label: currentUserDivisionName ?? data.divisionId,
          }
        : null);

    if (!selectedDivision) {
      sweetAlert.notifyError("Divisi belum dipilih", "Pilih divisi pengaju lebih dulu.");
      return;
    }

    if (data.items.length === 0) {
      return;
    }

    setIsSubmittingRequest(true);
    let submittedCount = 0;

    for (const item of data.items) {
      const result = await createWarehouseRequest({
        carId: selectedJob.carId ?? null,
        coreId: selectedJob.coreId,
        unitName: selectedJob.unitName,
        panelName: selectedJob.panelName,
        jobName: selectedJob.jobName,
        divisionId: Number(selectedDivision.value),
        divisionName: selectedDivision.label,
        requesterEmployeeId: data.requesterEmployeeId.trim(),
        stockCardId: item.stockCardId ?? null,
        itemCategory: data.itemCategory,
        transactionType:
          data.itemCategory === "SPARE_PART"
            ? data.transactionType
            : data.itemCategory === "BAHAN"
              ? "PENGAMBILAN"
              : data.itemCategory === "TOOLS"
                ? "PEMINJAMAN"
                : data.transactionType,
        itemMasterId: item.itemMasterId ?? null,
        itemAliasUsed: item.itemName,
        itemName: item.itemName,
        qty: Number(item.qty),
        uom: item.uom,
        targetSearchDate: selectedJob.taskDate,
        deadlineDate: selectedJob.deadlineDate ?? null,
        notes: [
          data.notes?.trim() || null,
          data.installToUnit ? "[INSTALL_TO_UNIT]" : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
      });

      if (!result.success) {
        setIsSubmittingRequest(false);
        sweetAlert.notifyError(
          "Pengajuan gagal",
          submittedCount > 0
            ? `${submittedCount} item sudah masuk. Gagal di ${item.itemName}: ${result.message}`
            : result.message,
        );
        return;
      }

      submittedCount += 1;
    }

    setIsSubmittingRequest(false);
    sweetAlert.notifySuccess(
      submittedCount > 1 ? "Pengajuan dikirim" : "Permintaan dikirim",
      `${submittedCount} item berhasil diajukan ke gudang.`
    );
    setIsRequestDialogOpen(false);
    router.refresh();
  }

  async function handleApprove(transactionId: string) {
    const confirmed = await sweetAlert.confirm({
      title: "Setujui permintaan ini?",
      description: "Permintaan akan lanjut ke tahap berikutnya sesuai alur gudang.",
      confirmLabel: "Setujui",
    });
    if (!confirmed) {
      return;
    }
    const result = await approveWarehouseRequest({ transactionId, notes: null });
    if (!result.success) {
      sweetAlert.notifyError("Approval gagal", result.message);
      return;
    }
    sweetAlert.notifySuccess("Approval diproses");
    router.refresh();
  }

  async function handleReject(transactionId: string) {
    const confirmed = await sweetAlert.confirm({
      title: "Tolak permintaan ini?",
      description: "Permintaan akan berhenti di antrean gudang.",
      tone: "warning",
      confirmLabel: "Tolak",
    });
    if (!confirmed) {
      return;
    }
    const result = await rejectWarehouseRequest({ transactionId, notes: null });
    if (!result.success) {
      sweetAlert.notifyError("Penolakan gagal", result.message);
      return;
    }
    sweetAlert.notifySuccess("Permintaan ditolak");
    router.refresh();
  }

  async function handleReady(transactionId: string) {
    const result = await readyWarehouseRequest({ transactionId, notes: null });
    if (!result.success) {
      sweetAlert.notifyError("Belum bisa ditandai siap", result.message);
      return;
    }
    sweetAlert.notifySuccess("Barang siap diambil");
    router.refresh();
  }

  async function handleIssue(transactionId: string) {
    const result = await issueWarehouseRequest({
      transactionId,
      notes: null,
      actualReleaseDate: transactionDate,
    });
    if (!result.success) {
      sweetAlert.notifyError("Belum bisa ditandai diambil", result.message);
      return;
    }
    sweetAlert.notifySuccess("Barang sudah diambil");
    router.refresh();
  }

  async function submitReturn(data: ReturnFormValues) {
    if (!returnModal) {
      return;
    }

    const result = await returnWarehouseRequest({
      transactionId: returnModal.transactionId,
      notes: data.notes?.trim() || null,
      actualReturnDate: transactionDate,
      qtyReturned: Number(data.qtyReturned),
      itemCondition: data.itemCondition || null,
    });

    if (!result.success) {
      sweetAlert.notifyError("Pengembalian gagal", result.message);
      return;
    }

    sweetAlert.notifySuccess("Barang diterima kembali");
    setReturnModal(null);
    router.refresh();
  }

  async function submitStore(data: StoreFormValues) {
    if (!storeModal) {
      return;
    }

    const result = await storeWarehouseRequest({
      transactionId: storeModal.transactionId,
      storageLocationId: data.storageLocationId ? Number(data.storageLocationId) : null,
      locationDetail: data.locationDetail?.trim() || null,
      notes: data.notes?.trim() || null,
    });

    if (!result.success) {
      sweetAlert.notifyError("Simpan kembali gagal", result.message);
      return;
    }

    sweetAlert.notifySuccess("Barang tersimpan kembali");
    setStoreModal(null);
    router.refresh();
  }

  async function uploadStockPhoto(file: File) {
    if (!photoTarget) {
      return;
    }

    setIsUploadingPhoto(true);
    const ticketResult = await requestWarehouseStockCardUploadTicket({
      stockCardId: photoTarget.stockCardId,
      filename: file.name,
      contentType: file.type || "image/jpeg",
    });
    if (!ticketResult.success) {
      setIsUploadingPhoto(false);
      sweetAlert.notifyError("Upload belum siap", ticketResult.message);
      return;
    }

    const uploadResponse = await fetch(ticketResult.result.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "image/jpeg",
      },
      body: file,
    });
    if (!uploadResponse.ok) {
      setIsUploadingPhoto(false);
      sweetAlert.notifyError("Upload gagal", "Foto belum berhasil dikirim ke penyimpanan.");
      return;
    }

    const nextPhotoUrls = [...photoUrlsDraft, ticketResult.result.publicUrl];
    const result = await updateWarehouseStockCardPhotos({
      stockCardId: photoTarget.stockCardId,
      photoUrls: nextPhotoUrls,
    });
    setIsUploadingPhoto(false);

    if (!result.success) {
      sweetAlert.notifyError("Foto belum tersimpan", result.message);
      return;
    }

    setPhotoUrlsDraft(result.result.photoUrls);
    setSelectedPhotoUrl(result.result.photoUrls.at(-1) ?? null);
    sweetAlert.notifySuccess("Foto ditambahkan");
    router.refresh();
  }

  async function deletePhoto(photoUrl: string) {
    if (!photoTarget) {
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: "Hapus foto ini?",
      description: "Foto akan dilepas dari stock card yang sedang dibuka.",
      confirmLabel: "Hapus",
    });
    if (!confirmed) {
      return;
    }

    const result = await updateWarehouseStockCardPhotos({
      stockCardId: photoTarget.stockCardId,
      photoUrls: photoUrlsDraft.filter((item) => item !== photoUrl),
    });
    if (!result.success) {
      sweetAlert.notifyError("Foto belum terhapus", result.message);
      return;
    }

    setPhotoUrlsDraft(result.result.photoUrls);
    setSelectedPhotoUrl(result.result.photoUrls[0] ?? null);
    sweetAlert.notifySuccess("Foto dihapus");
    router.refresh();
  }

  function openCreateLocationDialog() {
    setLocationModal({ isOpen: true, initialValues: null });
  }

  function openEditLocationDialog(row: WarehouseStorageLocationRecord) {
    setLocationModal({
      isOpen: true,
      initialValues: {
        storageLocationId: row.storageLocationId,
        locationType: row.locationType,
        zone: row.zone ?? "",
        rack: row.rack ?? "",
        shelf: row.shelf ?? "",
        label: row.label,
        isActive: row.isActive,
      },
    });
  }

  async function submitLocation(data: LocationFormValues) {
    setIsSavingLocation(true);
    const payload = {
      locationType: data.locationType,
      zone: data.zone?.trim() || null,
      rack: data.rack?.trim() || null,
      shelf: data.shelf?.trim() || null,
      label: data.label.trim(),
      isActive: data.isActive,
    };
    const result =
      data.storageLocationId === null
        ? await createWarehouseStorageLocation(payload as CreateWarehouseStorageLocation)
        : await updateWarehouseStorageLocation({
            storageLocationId: data.storageLocationId,
            ...payload,
          } as UpdateWarehouseStorageLocation);
    setIsSavingLocation(false);

    if (!result.success) {
      sweetAlert.notifyError("Lokasi belum tersimpan", result.message);
      return;
    }

    setLocationModal({ isOpen: false, initialValues: null });
    sweetAlert.notifySuccess(
      data.storageLocationId === null ? "Lokasi ditambahkan" : "Lokasi diperbarui",
    );
    router.refresh();
  }

  async function handleDeleteLocation(row: WarehouseStorageLocationRecord) {
    const confirmed = await sweetAlert.confirm({
      title: "Nonaktifkan lokasi ini?",
      description: "Lokasi tidak akan dipakai lagi untuk penyimpanan baru.",
      confirmLabel: "Nonaktifkan",
    });
    if (!confirmed) {
      return;
    }

    const result = await deleteWarehouseStorageLocation(row.storageLocationId);
    if (!result.success) {
      sweetAlert.notifyError("Lokasi belum bisa dinonaktifkan", result.message);
      return;
    }

    sweetAlert.notifySuccess("Lokasi dinonaktifkan");
    router.refresh();
  }

  const transactionColumns: SmartDataGridColumn[] = [
    { key: "requestDate", label: "Tanggal", kind: "mono" },
    { key: "requesterName", label: "Peminta" },
    { key: "divisionName", label: "Divisi", filterKey: "divisionId", filterOptions: transactions?.references?.divisions },
    { key: "unitName", label: "Unit", filterKey: "unitId", filterOptions: transactions?.references?.units },
    { key: "sourceUnitName", label: "Asal donor" },
    { key: "itemName", label: "Barang" },
    { key: "qty", label: "Qty", kind: "number", align: "right" },
    { key: "locationLabel", label: "Lokasi" },
    { key: "deadlineDate", label: "Target", kind: "mono" },
    { key: "itemStatus", label: "Status", kind: "status", filterKey: "itemStatus", filterOptions: transactions?.references?.itemStatuses },
    { key: "approvalStatus", label: "Persetujuan", kind: "status", filterKey: "approvalStatus", filterOptions: transactions?.references?.approvalStatuses },
    {
      key: "actions",
      label: "Aksi",
      align: "right",
      renderCell: (_, row) => {
        const itemStatus = String(row.itemStatus ?? "");
        const approvalStatus = String(row.approvalStatus ?? "");
        const transactionId = String(row.transactionId ?? "");
        const itemName = String(row.itemName ?? "Barang");

        return (
          <div className="flex flex-wrap justify-end gap-2">
            {canApprove && approvalStatus.startsWith("PENDING") ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleApprove(transactionId)}
                  className="border border-primary/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink"
                >
                  Setujui
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(transactionId)}
                  className="border border-destructive/35 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive"
                >
                  Tolak
                </button>
              </>
            ) : null}
            {canReady && approvalStatus === "APPROVED" && itemStatus === "OPEN" ? (
              <button
                type="button"
                onClick={() => void handleReady(transactionId)}
                className="border border-success/35 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-success"
              >
                Siap diambil
              </button>
            ) : null}
            {canIssue && itemStatus === "READY" ? (
              <button
                type="button"
                onClick={() => void handleIssue(transactionId)}
                className="border border-border dark:border-white/[0.08] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground dark:text-foreground/70"
              >
                Sudah diambil
              </button>
            ) : null}
            {canReturn && itemStatus === "RELEASED" ? (
              <button
                type="button"
                onClick={() =>
                 setReturnModal({
                  transactionId: String(row.transactionId),
                  itemName: String(row.itemName),
                  qtyReturned: String(row.qty),
                })
                }
                className="border border-border dark:border-white/[0.08] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground dark:text-foreground/70"
              >
                Dikembalikan
              </button>
            ) : null}
            {canReturn && itemStatus === "RETURNED" ? (
              <button
                type="button"
                onClick={() => void openStoreModal({ transactionId, itemName })}
                className="border border-primary/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink"
              >
                Tersimpan kembali
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const locationRowsWithActions = useMemo(
    () =>
      (locations?.rows ?? []).map((row) => ({
        ...row,
        actions: row.storageLocationId,
      })),
    [locations],
  );

  const locationColumnsWithActions: SmartDataGridColumn[] = [
    ...locationColumns,
    {
      key: "actions",
      label: "Aksi",
      align: "right",
      renderCell: (_, row) => {
        const actualRow = (locations?.rows ?? []).find(
          (item) => item.storageLocationId === Number(row.storageLocationId),
        );
        if (!actualRow || !canManageLocation) {
          return null;
        }

        return (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => openEditLocationDialog(actualRow)}
              className="border border-border dark:border-white/[0.08] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground dark:text-foreground/70"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteLocation(actualRow)}
              className="border border-destructive/35 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive"
            >
              Nonaktifkan
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {sweetAlert.alertElement}

      {isOverview && dashboard ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">
                  Dashboard gudang
                </p>
                <h2 className="text-lg font-semibold text-foreground dark:text-foreground">Ringkasan pergerakan material</h2>
              </div>
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-5">
            <SummaryBlock label="Menunggu persetujuan" value={dashboard.summary.pendingApproval} />
            <SummaryBlock label="Belum disiapkan" value={dashboard.summary.notPrepared} />
            <SummaryBlock label="Belum diambil" value={dashboard.summary.notPickedUp} />
            <SummaryBlock label="Sedang digunakan" value={dashboard.summary.inUse} />
            <SummaryBlock label="Terlambat" value={dashboard.summary.overdueNotReturned} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Sheet
              title="Keterlambatan pengembalian"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{dashboard.lateUsers.length} user</span>}
            >
              <TableList
                columns={["User", "Divisi", "Barang", "Terlambat"]}
                rows={dashboard.lateUsers.map((row) => [
                  <div key={`${row.transactionId}-user`}>
                    <p className="text-foreground dark:text-foreground">{row.requesterName}</p>
                    <p className="text-xs text-muted-foreground dark:text-foreground/35">{row.unitName}</p>
                  </div>,
                  row.divisionName,
                  row.itemName,
                  <span key={`${row.transactionId}-days`} className="text-app-accent-ink">
                    {row.daysOverdue} hari
                  </span>,
                ])}
                emptyMessage="Belum ada barang yang terlambat pada scope aktif."
              />
            </Sheet>

            <Sheet
              title="Pemakaian aktif per divisi"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{dashboard.divisionsUsing.length} divisi</span>}
            >
              <TableList
                columns={["Divisi", "Barang aktif", "Total qty"]}
                rows={dashboard.divisionsUsing.map((row) => [
                  row.divisionName,
                  row.itemCount,
                  row.totalQty,
                ])}
                emptyMessage="Belum ada barang yang sedang dipakai."
              />
            </Sheet>

            <Sheet
              title="Bahan keluar terbaru"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{dashboard.materialsOut.length} transaksi</span>}
            >
              <TableList
                columns={["Tanggal", "Divisi", "Bahan", "Qty"]}
                rows={dashboard.materialsOut.map((row) => [
                  row.usageDate,
                  row.divisionName,
                  row.itemName,
                  `${row.qty} ${row.uom}`,
                ])}
                emptyMessage="Belum ada catatan bahan keluar."
              />
            </Sheet>

            <Sheet
              title="Alert stok menipis"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{dashboard.lowStockAlerts.length} alert</span>}
            >
              <TableList
                columns={["Barang", "Kategori", "Sisa", "Alert"]}
                rows={dashboard.lowStockAlerts.map((row) => [
                  row.itemName,
                  row.itemCategory ? humanizeCodeLabel(row.itemCategory) : "-",
                  `${row.qtyAvailable} ${row.uom}`,
                  <span
                    key={`${row.itemName}-alert`}
                    className={row.alertLevel === "CRITICAL" ? "text-destructive" : "text-app-accent-ink"}
                  >
                    {row.alertLevel === "CRITICAL" ? "Hampir habis" : "Menipis"}
                  </span>,
                ])}
                emptyMessage="Belum ada stok yang masuk alert."
              />
            </Sheet>
          </section>
        </>
      ) : null}

      {isTransactions && transactions ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">
                    Gudang
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Transaksi material</h2>
                </div>

                <div className="flex flex-wrap items-end gap-3 border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground dark:text-foreground/35">Rentang tanggal</p>
                    <CompactDateRangeInput
                      from={transactionDate}
                      to={transactionDateEnd}
                      onChange={(range) => setTransactionDateRange(range.from, range.to)}
                      className="w-64"
                    />
                  </div>
                  <div className="min-w-[120px] border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">Total antrean</p>
                    <p className="mt-1 font-mono text-[12px] font-semibold text-foreground dark:text-foreground">{transactions.meta.total} transaksi</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isRefreshing ? "Memuat" : "Refresh"}
                </button>
                {canRequest ? (
                  <button
                    type="button"
                    onClick={() => void handleOpenRequestDialog()}
                    className="inline-flex h-8 items-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    Ajukan permintaan
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Sheet
              title="Perlu disiapkan"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{prepareRows.length} item</span>}
            >
              <TableList
                columns={["Barang", "Divisi", "Unit", "Aksi"]}
                rows={prepareRows.slice(0, 6).map((row) => [
                  row.itemName,
                  row.divisionName,
                  row.unitName,
                  canReady ? (
                    <button
                      key={`${row.transactionId}-ready`}
                      type="button"
                      onClick={() => void handleReady(row.transactionId)}
                      className="border border-success/30 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-success"
                    >
                      Siap diambil
                    </button>
                  ) : (
                    "-"
                  ),
                ])}
                emptyMessage="Belum ada barang yang menunggu disiapkan."
              />
            </Sheet>

            <Sheet
              title="Sudah dikembalikan"
              action={<span className="text-[11px] text-muted-foreground dark:text-foreground/35">{returnedRows.length} item</span>}
            >
              <TableList
                columns={["Barang", "Divisi", "Unit", "Aksi"]}
                rows={returnedRows.slice(0, 6).map((row) => [
                  row.itemName,
                  row.divisionName,
                  row.unitName,
                  canReturn ? (
                    <button
                      key={`${row.transactionId}-store`}
                      type="button"
                      onClick={() => void openStoreModal(row)}
                      className="border border-primary/30 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink"
                    >
                      Simpan kembali
                    </button>
                  ) : (
                    "-"
                  ),
                ])}
                emptyMessage="Belum ada barang yang masuk antrean simpan kembali."
              />
            </Sheet>
          </section>

          <SmartDataGrid
            title="Daftar transaksi"
            description=""
            columns={transactionColumns}
            rows={activeTransactionRows as Array<Record<string, string | number | boolean | null>>}
            meta={transactions.meta}
            state={transactions.state}
            filters={buildGridFilters(transactions.references)}
            sortOptions={[
              { label: "Tanggal", value: "requestDate" },
              { label: "Target", value: "deadlineDate" },
              { label: "Unit", value: "unitName" },
              { label: "Peminta", value: "requesterName" },
              { label: "Barang", value: "itemName" },
            ]}
            searchPlaceholder="Cari barang, user, atau unit..."
            emptyMessage="Belum ada transaksi untuk filter saat ini."
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {activeTab === "stock-card" && stockCard ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">
                    Gudang
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Stock card</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 border border-border dark:border-white/[0.05] bg-muted dark:bg-background px-3 py-2">
                  {[
                    { value: "", label: "Semua" },
                    { value: "TOOLS", label: "Tool" },
                    { value: "SPARE_PART", label: "Sparepart" },
                    { value: "BAHAN", label: "Bahan" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setStockCategory(option.value)}
                      className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                        stockCategoryFilter === option.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border dark:border-white/[0.08] bg-transparent text-muted-foreground dark:text-foreground/55"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>

          <SmartDataGrid
            title="Sheet stock"
            description=""
            columns={stockCardColumns}
            rows={stockCard.rows as unknown as Array<Record<string, string | number | boolean | null>>}
            meta={stockCard.meta}
            state={stockCard.state}
            sortOptions={[
              { label: "Tanggal masuk", value: "dateIn" },
              { label: "Nama barang", value: "partName" },
              { label: "Status", value: "status" },
            ]}
            searchPlaceholder="Cari part, panel, unit, atau kode..."
            emptyMessage="Belum ada stock card untuk filter saat ini."
            viewportClassName="max-h-[calc(100svh-260px)]"
            filters={[
              { field: "status", label: "Status", options: [
                { value: "IN_STORAGE", label: "IN_STORAGE" },
                { value: "RETRIEVED", label: "RETRIEVED" },
                { value: "INSTALLED", label: "INSTALLED" },
                { value: "LOST", label: "LOST" },
              ] },
              ...(locationOptions && locationOptions.length > 0 ? [{ field: "storageLocationId", label: "Lokasi", options: locationOptions.map((loc) => ({ value: String(loc.storageLocationId), label: loc.label })) }] : []),
            ]}
            onRowClick={(row) => {
              const actualRow = stockCard.rows.find(
                (item) => item.stockCardId === String(row.stockCardId ?? ""),
              );
              if (actualRow) {
                setPhotoTarget(actualRow);
              }
            }}
            getRowAriaLabel={(row) => `Buka foto stock card ${String(row.partName ?? "barang")}`}
          />
        </>
      ) : null}

      {activeTab === "locations" && locations ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">
                  Gudang
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Lokasi penyimpanan</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageLocation ? (
                  <button
                    type="button"
                    onClick={openCreateLocationDialog}
                    className="inline-flex h-8 items-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10"
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    Tambah lokasi
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {isRefreshing ? "Memuat" : "Refresh"}
                </button>
              </div>
            </div>
          </section>

          <SmartDataGrid
            title="Sheet lokasi"
            description=""
            columns={locationColumnsWithActions}
            rows={locationRowsWithActions as Array<Record<string, string | number | boolean | null>>}
            meta={locations.meta}
            state={locations.state}
            sortOptions={[
              { label: "Lokasi", value: "label" },
              { label: "Tipe", value: "locationType" },
              { label: "Zona", value: "zone" },
              { label: "Isi", value: "itemCount" },
            ]}
            searchPlaceholder="Cari label, zona, rak, atau shelf..."
            emptyMessage="Belum ada lokasi untuk query saat ini."
            filters={[
              { field: "locationType", label: "Tipe Lokasi", options: [
                { value: "GUDANG", label: "Gudang" },
                { value: "WORKSHOP", label: "Workshop" },
                { value: "UNIT", label: "Unit" },
              ] },
              { field: "isActive", label: "Status Aktif", options: [
                { value: "1", label: "Aktif" },
                { value: "0", label: "Tidak Aktif" },
              ] },
            ]}
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {activeTab === "items" && items ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">Gudang</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Master barang</h2>
              </div>
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>
          <SmartDataGrid
            title="Master barang"
            description=""
            columns={itemColumns}
            rows={items.rows as Array<Record<string, string | number | boolean | null>>}
            meta={items.meta}
            state={items.state}
            searchPlaceholder="Cari barang atau kode..."
            emptyMessage="Belum ada data barang."
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {activeTab === "usage" && usage ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">Gudang</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Bahan keluar</h2>
              </div>
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>
          <SmartDataGrid
            title="Bahan keluar"
            description=""
            columns={usageColumns}
            rows={usage.rows as Array<Record<string, string | number | boolean | null>>}
            meta={usage.meta}
            state={usage.state}
            searchPlaceholder="Cari divisi atau bahan..."
            emptyMessage="Belum ada bahan keluar."
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {activeTab === "opname" && stockOpnames ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">Gudang</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Stock opname</h2>
              </div>
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>
          <SmartDataGrid
            title="Stock opname"
            description=""
            columns={opnameColumns}
            rows={stockOpnames.rows as Array<Record<string, string | number | boolean | null>>}
            meta={stockOpnames.meta}
            state={stockOpnames.state}
            searchPlaceholder="Cari nomor opname atau barang..."
            emptyMessage="Belum ada hasil stock opname."
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {activeTab === "adjustments" && stockAdjustments ? (
        <>
          <section className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-accent-ink/80">Gudang</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground dark:text-foreground">Penyesuaian stok</h2>
              </div>
              <button
                type="button"
                onClick={() => startRefresh(() => router.refresh())}
                  className="inline-flex h-8 items-center gap-2 border border-border dark:border-white/[0.08] bg-transparent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/55"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isRefreshing ? "Memuat" : "Refresh"}
              </button>
            </div>
          </section>
          <SmartDataGrid
            title="Penyesuaian stok"
            description=""
            columns={adjustmentColumns}
            rows={stockAdjustments.rows as Array<Record<string, string | number | boolean | null>>}
            meta={stockAdjustments.meta}
            state={stockAdjustments.state}
            searchPlaceholder="Cari nomor penyesuaian atau barang..."
            emptyMessage="Belum ada penyesuaian stok."
            viewportClassName="max-h-[calc(100svh-260px)]"
          />
        </>
      ) : null}

      {isRequestDialogOpen ? (
        <ModalFrame title="Ajukan permintaan gudang" onClose={() => setIsRequestDialogOpen(false)}>
          <WarehouseRequestForm
            divisions={transactions?.references.divisions ?? []}
            employees={requestEmployees}
            jobs={requestJobs}
            stockCards={requestStockCardOptions}
            isLoading={isLoadingRequestRefs}
            isPending={isSubmittingRequest}
            canChooseRequestDivision={canChooseRequestDivision}
            currentUserDivisionName={currentUserDivisionName ?? null}
            transactionDate={transactionDate}
            onFetchReferences={refreshRequestReferences}
            onSubmit={(data) => void submitRequest(data)}
          />
        </ModalFrame>
      ) : null}

      {returnModal ? (
        <ModalFrame title={`Terima kembali • ${returnModal.itemName}`} onClose={() => setReturnModal(null)}>
          <WarehouseReturnForm
            initialValues={{ qtyReturned: returnModal.qtyReturned }}
            isPending={false}
            onSubmit={(data) => {
              void submitReturn(data);
            }}
          />
        </ModalFrame>
      ) : null}

      {storeModal ? (
        <ModalFrame title={`Simpan kembali • ${storeModal.itemName}`} onClose={() => setStoreModal(null)}>
          <WarehouseStoreForm
            initialValues={null}
            locations={effectiveStoreLocationOptions}
            isPending={false}
            onSubmit={(data) => {
              void submitStore(data);
            }}
          />
        </ModalFrame>
      ) : null}

      {photoTarget ? (
        <ModalFrame title={`Foto stock card • ${photoTarget.partName}`} onClose={() => setPhotoTarget(null)}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="border border-border dark:border-white/[0.05] bg-white dark:bg-card p-3">
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border border-border dark:border-white/[0.05] bg-black">
                {selectedPhotoUrl ? (
                  <Image src={selectedPhotoUrl} alt={photoTarget.partName} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground dark:text-foreground/35">
                    <ImageIcon className="mx-auto h-8 w-8" />
                    <p className="mt-2 text-sm">Belum ada foto</p>
                  </div>
                )}
              </div>
              {photoUrlsDraft.length > 0 ? (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {photoUrlsDraft.map((photoUrl) => (
                    <button
                      key={photoUrl}
                      type="button"
                      onClick={() => setSelectedPhotoUrl(photoUrl)}
                      className={`relative overflow-hidden rounded-lg border ${
                        selectedPhotoUrl === photoUrl
                          ? "border-primary/50"
                          : "border-border dark:border-white/[0.06]"
                      }`}
                    >
                      <Image src={photoUrl} alt={photoTarget.partName} fill sizes="64px" className="object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground dark:text-foreground/30">Info</p>
                <div className="mt-3 space-y-2 text-sm text-foreground/82">
                  <p>{photoTarget.partName}</p>
                  <p className="text-muted-foreground dark:text-foreground/45">{photoTarget.unitName}</p>
                  <p className="text-muted-foreground dark:text-foreground/45">{photoTarget.locationLabel ?? "Belum ada lokasi"}</p>
                </div>
              </div>

              <div className="border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground dark:text-foreground">Foto</p>
                  {canManageStockCard ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadStockPhoto(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="inline-flex h-8 items-center gap-2 border border-primary/40 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:opacity-50"
                      >
                        {isUploadingPhoto ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {photoUrlsDraft.length === 0 ? (
                    <p className="text-sm text-muted-foreground dark:text-foreground/35">Belum ada foto di stock card ini.</p>
                  ) : (
	                    photoUrlsDraft.map((photoUrl, index) => (
	                      <div
	                        key={photoUrl}
	                        className="flex items-center justify-between gap-3 border border-border dark:border-white/[0.05] bg-white dark:bg-card px-3 py-2"
	                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoUrl(photoUrl)}
                          className="min-w-0 flex-1 truncate text-left text-sm text-foreground/82"
                        >
                          Foto {index + 1}
                        </button>
                        <div className="flex items-center gap-2">
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="border border-border dark:border-white/[0.08] p-2 text-muted-foreground dark:text-foreground/55 transition-colors hover:text-foreground dark:text-foreground"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          {canManageStockCard ? (
                            <button
                              type="button"
                              onClick={() => void deletePhoto(photoUrl)}
                              className="border border-destructive/20 p-2 text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {locationModal.isOpen ? (
        <ModalFrame
          title={locationModal.initialValues === null ? "Tambah lokasi" : "Edit lokasi"}
          onClose={() => setLocationModal({ isOpen: false, initialValues: null })}
        >
          <WarehouseLocationForm
            initialValues={locationModal.initialValues}
            isPending={isSavingLocation}
            onSubmit={(data) => void submitLocation(data)}
          />
        </ModalFrame>
      ) : null}
    </div>
  );
}
