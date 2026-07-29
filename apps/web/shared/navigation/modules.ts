import type { PermissionCode } from "@smsystem/permissions";
import { permissionCodes } from "@smsystem/permissions";
import {
  getWarehouseSectionDefinition,
} from "@/modules/warehouse/config/workspace";

export type NavigationIcon = "dashboard" | "grid" | "units" | "countdown" | "users" | "roles";
export interface NavigationSubItem {
  id: string;
  label: string;
  href?: string;
  permission?: PermissionCode;
  subItems?: NavigationSubItem[];
}

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  permission?: PermissionCode;
  icon: NavigationIcon;
  subItems?: NavigationSubItem[];
  group?: string;
}

const warehouseOverview = getWarehouseSectionDefinition("overview");
const warehouseTransactions = getWarehouseSectionDefinition("stock-movements");
const warehouseStockCard = getWarehouseSectionDefinition("stock-card");
const warehouseLocations = getWarehouseSectionDefinition("reference-locations");

const navigationModules: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    permission: permissionCodes.profileView,
    icon: "dashboard",
  },
  {
    id: "units",
    label: "Units",
    href: "/units",
    permission: permissionCodes.viewUnits,
    icon: "units",
    group: "Production",
  },
  {
    id: "planning",
    label: "Planning",
    icon: "grid",
    group: "Production",
    subItems: [
      {
        id: "planning-workspace",
        label: "Planning & ETA",
        href: "/planning",
        permission: permissionCodes.listCarProgress,
      },
      {
        id: "planning-spk",
        label: "SPK",
        href: "/spk",
        permission: permissionCodes.updatePlan,
      },
      {
        id: "planning-spl",
        label: "Rekomendasi SPL",
        href: "/planning/spl",
        permission: permissionCodes.listCarProgress,
      },
      {
        id: "planning-evaluation",
        label: "Review Plan",
        href: "/planning/evaluation",
        permission: permissionCodes.listCarProgress,
      },
    ],
  },
  {
    id: "countdown",
    label: "Countdown",
    href: "/countdown",
    permission: permissionCodes.viewCountdown,
    icon: "countdown",
    group: "Production",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    href: "/monitoring",
    permission: permissionCodes.listCarProgress,
    icon: "grid",
    group: "Operations",
    subItems: [
      {
        id: "job-plan",
        label: "Job Plan",
        href: "/job-plan",
        permission: permissionCodes.updatePlan,
      },
      {
        id: "monitoring-list",
        label: "Job Actual",
        href: "/monitoring",
        permission: permissionCodes.listCarProgress,
      },
      {
        id: "monitoring-division",
        label: "Per Divisi",
        href: "/monitoring/division",
        permission: permissionCodes.listCarProgress,
      },
      {
        id: "monitoring-unit",
        label: "Unit",
        href: "/monitoring/unit",
        permission: permissionCodes.listCarProgress,
      },
      {
        id: "monitoring-employee",
        label: "Karyawan",
        href: "/monitoring/employee",
        permission: permissionCodes.listCarProgress,
      },
    ],
  },
  {
    id: "spf",
    label: "SPF Client Portal",
    icon: "grid",
    group: "Operations",
    subItems: [
      {
        id: "spf-periods",
        label: "Periode SPF",
        href: "/spf/periods",
        permission: permissionCodes.profileView,
      },
      {
        id: "spf-items",
        label: "Item Restorasi",
        href: "/spf/items",
        permission: permissionCodes.profileView,
      },
    ],
  },
  {
    id: "gallery",
    label: "Gallery",
    href: "/gallery",
    permission: permissionCodes.galleryView,
    icon: "grid",
    group: "Operations",
  },
  {
    id: "qa",
    label: "QA",
    href: "/qc/dashboard",
    permission: permissionCodes.qcView,
    icon: "grid",
    group: "Operations",
    subItems: [
      {
        id: "qa-dashboard",
        label: "Dashboard",
        href: "/qc/dashboard",
        permission: permissionCodes.qcView,
      },
      {
        id: "qa-history",
        label: "Riwayat",
        href: "/qc/history",
        permission: permissionCodes.qcView,
      },
    ],
  },
  {
    id: "issues",
    label: "Issue Log",
    href: "/issues",
    permission: permissionCodes.qcView,
    icon: "grid",
    group: "Operations",
  },
  {
    id: "requests",
    label: "WO / WOV / PR",
    href: "/requests/outstanding",
    permission: permissionCodes.profileView,
    icon: "grid",
    group: "Procurement",
    subItems: [
      {
        id: "requests-outstanding",
        label: "Dashboard",
        href: "/requests/outstanding",
        permission: permissionCodes.profileView,
      },
      {
        id: "requests-board",
        label: "Request",
        href: "/requests/board",
        permission: permissionCodes.profileView,
      },
      {
        id: "requests-list",
        label: "Monitoring List",
        href: "/requests/list",
        permission: permissionCodes.profileView,
      },
    ],
  },
  {
    id: "invoice",
    label: "Invoice",
    href: "/invoice/wo-bubut",
    permission: permissionCodes.bubutInvoiceView,
    icon: "grid",
    group: "Procurement",
    subItems: [
      {
        id: "invoice-wo-bubut",
        label: "WO Bubut",
        href: "/invoice/wo-bubut",
        permission: permissionCodes.bubutInvoiceView,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    permission: permissionCodes.reportView,
    icon: "grid",
    group: "Procurement",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    href: warehouseOverview.href,
    permission: permissionCodes.warehouseView,
    icon: "grid",
    group: "Inventory",
    subItems: [
      {
        id: "warehouse-dashboard",
        label: warehouseOverview.label,
        href: warehouseOverview.href,
        permission: warehouseOverview.permission,
      },
      {
        id: "warehouse-transactions",
        label: warehouseTransactions.label,
        href: warehouseTransactions.href,
        permission: warehouseTransactions.permission,
      },
      {
        id: "warehouse-stock-card",
        label: warehouseStockCard.label,
        href: warehouseStockCard.href,
        permission: warehouseStockCard.permission,
      },
      {
        id: "warehouse-locations",
        label: warehouseLocations.label,
        href: warehouseLocations.href,
        permission: warehouseLocations.permission,
      },
    ],
  },
  {
    id: "users",
    label: "User Management",
    href: "/dashboard/users",
    permission: permissionCodes.manageUsers,
    icon: "users",
    group: "Admin",
    subItems: [
      {
        id: "users-list",
        label: "Users",
        href: "/dashboard/users",
        permission: permissionCodes.manageUsers,
      },
      {
        id: "roles-matrix",
        label: "Role Matrix",
        href: "/dashboard/roles",
        permission: permissionCodes.manageUsers,
      },
      {
        id: "divisions-management",
        label: "Divisi",
        href: "/dashboard/divisions",
        permission: permissionCodes.manageUsers,
      },
    ],
  },
];

function hasRequestAccess(permissions: readonly string[]) {
  return (
    permissions.includes(permissionCodes.woView) ||
    permissions.includes(permissionCodes.prView) ||
    permissions.includes(permissionCodes.vendorView)
  );
}

function hasNodePermission(
  item: Pick<NavigationItem, "id" | "permission">,
  permissions: readonly string[],
) {
  if (item.id === "requests" || item.id.startsWith("requests-")) {
    return hasRequestAccess(permissions);
  }

  if (item.permission) {
    return permissions.includes(item.permission);
  }

  return false;
}

function firstNavigableHref(items: NavigationSubItem[] | undefined): string | undefined {
  for (const item of items ?? []) {
    if (item.href) {
      return item.href;
    }

    const nestedHref = firstNavigableHref(item.subItems);
    if (nestedHref) {
      return nestedHref;
    }
  }

  return undefined;
}

function filterSubItems(
  items: NavigationSubItem[] | undefined,
  permissions: readonly string[],
): NavigationSubItem[] {
  const filteredItems: NavigationSubItem[] = [];

  for (const item of items ?? []) {
    const filteredSubItems = filterSubItems(item.subItems, permissions);
    const selfAllowed = hasNodePermission(item, permissions);

    if (!selfAllowed && filteredSubItems.length === 0) {
      continue;
    }

    filteredItems.push({
      ...item,
      href: item.href ?? firstNavigableHref(filteredSubItems),
      subItems: filteredSubItems.length > 0 ? filteredSubItems : undefined,
    });
  }

  return filteredItems;
}

export function buildNavigation(permissions: readonly string[]): NavigationItem[] {
  const filteredItems: NavigationItem[] = [];

  for (const item of navigationModules) {
    const filteredSubItems = filterSubItems(item.subItems, permissions);
    const selfAllowed = hasNodePermission(item, permissions);

    if (!selfAllowed && filteredSubItems.length === 0) {
      continue;
    }

    filteredItems.push({
      ...item,
      href: item.href ?? firstNavigableHref(filteredSubItems),
      subItems: filteredSubItems.length > 0 ? filteredSubItems : undefined,
    });
  }

  return filteredItems;
}
