import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { warehouseTabSchema, type WarehouseTab } from "@smsystem/contracts/warehouse";
import {
  getWarehouseSectionDefinition,
  resolveWarehouseSection,
} from "@/modules/warehouse/config/workspace";
import {
  fetchWarehouseDashboard,
  fetchWarehouseStockAdjustments,
  fetchWarehouseItems,
  fetchWarehouseMaterialUsage,
  fetchWarehousePendingApproval,
  fetchWarehouseRequestReferences,
  fetchWarehouseStockCard,
  fetchWarehouseStockOpnames,
  fetchWarehouseStorageLocations,
  fetchWarehouseTransactions,
} from "@/shared/api/warehouse";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const WarehouseShell = dynamic(
  () =>
    import("@/modules/warehouse/components/warehouse-shell").then(
      (mod) => mod.WarehouseShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat warehouse" />,
  },
);

interface WarehousePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveWarehouseMode(input: {
  canRequest: boolean;
  canApprove: boolean;
  canReady: boolean;
  canIssue: boolean;
  canReturn: boolean;
  canView: boolean;
}): "requester" | "console" {
  const canProcessWarehouse = input.canReady || input.canIssue || input.canReturn;
  return input.canApprove || canProcessWarehouse || (input.canView && !input.canRequest)
    ? "console"
    : "requester";
}

function resolveWarehouseTab(input: string | string[] | undefined): WarehouseTab {
  const rawValue = Array.isArray(input) ? input[0] : input;
  const parsed = warehouseTabSchema.safeParse(rawValue ?? "transactions");
  return parsed.success ? parsed.data : "transactions";
}

function getWarehouseTabLabel(tab: WarehouseTab): string {
  switch (tab) {
    case "stock-card":
      return "kartu stok";
    case "items":
      return "master barang";
    case "usage":
      return "pemakaian material";
    case "locations":
      return "lokasi penyimpanan";
    case "opname":
      return "stock opname";
    case "adjustments":
      return "penyesuaian stok";
    default:
      return "transaksi";
  }
}

function normalizeWarehouseItemCategory(
  value: string | null,
): "TOOLS" | "BAHAN" | "SPARE_PART" | "CONSUMABLE" | null {
  if (
    value === "TOOLS" ||
    value === "BAHAN" ||
    value === "SPARE_PART" ||
    value === "CONSUMABLE"
  ) {
    return value;
  }

  return null;
}

function buildWarehouseDashboardFallback(input: {
  transactions:
    | Awaited<ReturnType<typeof fetchWarehouseTransactions>>["payload"]
    | null;
  usage:
    | Awaited<ReturnType<typeof fetchWarehouseMaterialUsage>>["payload"]
    | null;
  stockCard:
    | Awaited<ReturnType<typeof fetchWarehouseStockCard>>["payload"]
    | null;
}) {
  const transactionRows = input.transactions?.data ?? [];
  const transactionSummary = input.transactions?.summary ?? {
    pendingApproval: 0,
    readyCount: 0,
    releasedCount: 0,
    overdueCount: 0,
    storedCount: 0,
  };
  const usageRows = input.usage?.data ?? [];
  const stockRows = input.stockCard?.data ?? [];

  const lateUsers = transactionRows
    .filter((row) => row.isOverdue)
    .sort((left, right) => (right.daysOverdue ?? 0) - (left.daysOverdue ?? 0))
    .slice(0, 8)
    .map((row) => ({
      transactionId: row.transactionId,
      requesterName: row.requesterName,
      divisionName: row.divisionName,
      itemName: row.itemName,
      unitName: row.unitName,
      daysOverdue: row.daysOverdue ?? 0,
    }));

  const divisionsUsing = Array.from(
    transactionRows
      .filter((row) => row.itemStatus === "RELEASED")
      .reduce<
        Map<
          string,
          {
            divisionId: number | null;
            divisionName: string;
            itemCount: number;
            totalQty: number;
          }
        >
      >((accumulator, row) => {
        const key = `${row.divisionId ?? "null"}:${row.divisionName}`;
        const current = accumulator.get(key) ?? {
          divisionId: row.divisionId,
          divisionName: row.divisionName,
          itemCount: 0,
          totalQty: 0,
        };
        current.itemCount += 1;
        current.totalQty += row.qty;
        accumulator.set(key, current);
        return accumulator;
      }, new Map())
      .values(),
  )
    .sort(
      (left, right) =>
        right.itemCount - left.itemCount ||
        right.totalQty - left.totalQty ||
        left.divisionName.localeCompare(right.divisionName),
    )
    .slice(0, 8);

  const materialsOut = usageRows.slice(0, 8).map((row) => ({
    usageId: row.usageId,
    divisionName: row.divisionName,
    itemName: row.itemName,
    qty: row.qty,
    uom: row.uom,
    usageDate: row.usageDate,
  }));

  const lowStockAlerts = Array.from(
    stockRows
      .filter((row) => row.status === "IN_STORAGE")
      .reduce<
        Map<
          string,
          {
            itemName: string;
            itemCategory: string | null;
            qtyAvailable: number;
            uom: string;
          }
        >
      >((accumulator, row) => {
        const key = `${row.partName}:${row.itemCategory ?? "null"}:${row.uom}`;
        const current = accumulator.get(key) ?? {
          itemName: row.partName,
          itemCategory: row.itemCategory ?? null,
          qtyAvailable: 0,
          uom: row.uom,
        };
        current.qtyAvailable += row.qty;
        accumulator.set(key, current);
        return accumulator;
      }, new Map())
      .values(),
  )
    .filter((row) => row.qtyAvailable <= 10)
    .sort(
      (left, right) =>
        left.qtyAvailable - right.qtyAvailable ||
        left.itemName.localeCompare(right.itemName),
    )
    .slice(0, 8)
    .map((row) => ({
      ...row,
      itemCategory: normalizeWarehouseItemCategory(row.itemCategory),
      alertLevel: row.qtyAvailable <= 3 ? ("CRITICAL" as const) : ("LOW" as const),
    }));

  return {
    summary: {
      pendingApproval: transactionSummary.pendingApproval,
      notPrepared: transactionRows.filter(
        (row) => row.approvalStatus === "APPROVED" && row.itemStatus === "OPEN",
      ).length,
      notPickedUp: transactionSummary.readyCount,
      inUse: transactionSummary.releasedCount,
      overdueNotReturned: transactionSummary.overdueCount,
    },
    lateUsers,
    divisionsUsing,
    materialsOut,
    lowStockAlerts,
  };
}

async function WarehousePageContent({ searchParams }: WarehousePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user, status: userStatus } = await fetchCurrentUser(cookieHeader);

  if (userStatus === 401) {
    redirect("/login");
  }

  if (userStatus === 403) {
    redirect("/forbidden");
  }

  if (!user) {
    return (
      <ModuleUnavailableState
        module="Warehouse"
        title="Warehouse belum bisa dimuat"
        message="Sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  const canRequest = user.permissions.includes(permissionCodes.warehouseRequest);
  const canApprove = user.permissions.includes(permissionCodes.warehouseApprove);
  const canReady = user.permissions.includes(permissionCodes.warehouseReady);
  const canIssue = user.permissions.includes(permissionCodes.warehouseIssue);
  const canReturn = user.permissions.includes(permissionCodes.warehouseReturn);
  const canView = user.permissions.includes(permissionCodes.warehouseView);
  const canManageStockCard = user.permissions.includes(permissionCodes.warehouseStockCardManage);
  const canManageLocation = user.permissions.includes(permissionCodes.warehouseLocationManage);
  const canCreateOpname = user.permissions.includes(permissionCodes.warehouseStockOpnameCreate);
  const canCreateAdjustment = user.permissions.includes(permissionCodes.warehouseStockAdjustmentCreate);
  const mode = resolveWarehouseMode({
    canRequest,
    canApprove,
    canReady,
    canIssue,
    canReturn,
    canView,
  });
  const shellBaseProps = {
    mode,
    canRequest,
    canApprove,
    canReady,
    canIssue,
    canReturn,
    canManageStockCard,
    canManageLocation,
    canCreateOpname,
    canCreateAdjustment,
    currentUserDivisionId: user.divisionId ? String(user.divisionId) : null,
    currentUserDivisionName: user.divisionName,
    currentUserFullName: user.fullName,
    canChooseRequestDivision: user.scope.canViewAllUnits,
  };
  const defaultSection = "overview";
  const activeSection = resolveWarehouseSection(
    resolvedSearchParams.section ?? defaultSection,
  );
  const sectionDefinition = getWarehouseSectionDefinition(activeSection);
  const activeTab = resolveWarehouseTab(resolvedSearchParams.tab ?? sectionDefinition.tab);

  if (activeTab === "transactions" && activeSection === "overview") {
    const { payload, status } = await fetchWarehouseDashboard(cookieHeader);

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    let dashboardData = payload?.data ?? null;

    if (!dashboardData) {
      const [transactionsFallback, usageFallback, stockCardFallback] = await Promise.all([
        fetchWarehouseTransactions(cookieHeader, {
          page: "1",
          limit: "100",
          sortBy: "requestDate",
          sortDirection: "desc",
          view: "all",
        }),
        fetchWarehouseMaterialUsage(cookieHeader, {
          page: "1",
          limit: "50",
          sortBy: "usageDate",
          sortDirection: "desc",
        }),
        fetchWarehouseStockCard(cookieHeader, {
          page: "1",
          limit: "100",
          sortBy: "dateIn",
          sortDirection: "desc",
        }),
      ]);

      if (
        transactionsFallback.status === 401 ||
        usageFallback.status === 401 ||
        stockCardFallback.status === 401
      ) {
        redirect("/login");
      }

      if (
        transactionsFallback.status === 403 ||
        usageFallback.status === 403 ||
        stockCardFallback.status === 403
      ) {
        redirect("/forbidden");
      }

      if (
        transactionsFallback.payload ||
        usageFallback.payload ||
        stockCardFallback.payload
      ) {
        dashboardData = buildWarehouseDashboardFallback({
          transactions: transactionsFallback.payload,
          usage: usageFallback.payload,
          stockCard: stockCardFallback.payload,
        });
      }
    }

    if (!dashboardData) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Dashboard warehouse belum bisa dimuat"
          message="Ringkasan gudang belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        dashboard={{
          summary: dashboardData.summary,
          lateUsers: dashboardData.lateUsers,
          divisionsUsing: dashboardData.divisionsUsing,
          materialsOut: dashboardData.materialsOut,
          lowStockAlerts: dashboardData.lowStockAlerts,
        }}
      />
    );
  }

  if (activeTab === "transactions") {
    const requestDate =
      typeof resolvedSearchParams.dateFrom === "string"
        ? resolvedSearchParams.dateFrom
        : new Date().toISOString().slice(0, 10);
    const [{ payload, status }, pendingApprovalResponse, requestReferencesResponse, locationOptionsResponse] =
      await Promise.all([
        fetchWarehouseTransactions(cookieHeader, {
          ...resolvedSearchParams,
          view: "active",
        }),
        user.permissions.includes(permissionCodes.warehouseApprove)
          ? fetchWarehousePendingApproval(cookieHeader)
          : Promise.resolve({ payload: null, status: 200 }),
        canRequest
          ? fetchWarehouseRequestReferences(cookieHeader, {
              date: requestDate,
              isOvertime: "0",
              divisionId: user.divisionId ? String(user.divisionId) : undefined,
            })
          : Promise.resolve({ payload: null, status: 200 }),
        canReturn || canManageLocation
          ? fetchWarehouseStorageLocations(cookieHeader, {
              page: "1",
              limit: "100",
              sortBy: "label",
              sortDirection: "asc",
            })
          : Promise.resolve({ payload: null, status: 200 }),
      ]);

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Transaksi warehouse belum bisa dimuat"
          message="Data transaksi warehouse belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        transactions={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
          references: payload.references,
          summary: payload.summary,
          pendingApprovals: pendingApprovalResponse.payload?.data ?? [],
        }}
        requestReferences={requestReferencesResponse.payload?.data ?? null}
        locationOptions={locationOptionsResponse.payload?.data ?? []}
      />
    );
  }

  if (activeTab === "stock-card") {
    const { payload, status } = await fetchWarehouseStockCard(
      cookieHeader,
      resolvedSearchParams,
    );

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Kartu stok belum bisa dimuat"
          message="Data kartu stok warehouse belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        stockCard={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
        }}
      />
    );
  }

  if (activeTab === "items") {
    const { payload, status } = await fetchWarehouseItems(cookieHeader, resolvedSearchParams);

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Master barang belum bisa dimuat"
          message="Data master barang warehouse belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        items={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
        }}
      />
    );
  }

  if (activeTab === "usage") {
    const { payload, status } = await fetchWarehouseMaterialUsage(
      cookieHeader,
      resolvedSearchParams,
    );

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Pemakaian material belum bisa dimuat"
          message="Data pemakaian material warehouse belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        usage={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
        }}
      />
    );
  }

  if (activeTab === "opname") {
    const { payload, status } = await fetchWarehouseStockOpnames(
      cookieHeader,
      resolvedSearchParams,
    );

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Stock opname belum bisa dimuat"
          message="Data stock opname belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        stockOpnames={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
        }}
      />
    );
  }

  if (activeTab === "adjustments") {
    const { payload, status } = await fetchWarehouseStockAdjustments(
      cookieHeader,
      resolvedSearchParams,
    );

    if (status === 401) {
      redirect("/login");
    }

    if (status === 403) {
      redirect("/forbidden");
    }

    if (!payload) {
      return (
        <ModuleUnavailableState
          module="Warehouse"
          title="Penyesuaian stok belum bisa dimuat"
          message="Data penyesuaian stok belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
        />
      );
    }

    return (
      <WarehouseShell
        activeTab={activeTab}
        activeSection={activeSection}
        {...shellBaseProps}
        stockAdjustments={{
          rows: payload.data,
          meta: payload.meta,
          state: payload.query,
        }}
      />
    );
  }

  const { payload, status } = await fetchWarehouseStorageLocations(
    cookieHeader,
    resolvedSearchParams,
  );

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Warehouse"
        title={`${getWarehouseTabLabel(activeTab)} belum bisa dimuat`}
        message={`Data ${getWarehouseTabLabel(activeTab)} warehouse belum terbaca saat ini. Coba muat ulang beberapa saat lagi.`}
      />
    );
  }

  return (
    <WarehouseShell
      activeTab={activeTab}
      activeSection={activeSection}
      {...shellBaseProps}
      locations={{
        rows: payload.data,
        meta: payload.meta,
        state: payload.query,
      }}
    />
  );
}


export default function WarehousePage(props: WarehousePageProps) {
  return <WarehousePageContent {...props} />;
}
