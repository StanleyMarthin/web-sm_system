// ============================================================
// Shared Navigation Items — Single source of truth for sidebar & mobile nav
//
// REFACTORED: Previously duplicated in sidebar.tsx and mobile-nav.tsx.
// Now centralized here to ensure consistency and reduce maintenance cost.
// ============================================================

import { hasPermission, Permission } from "@/config/rbac";
import {
  canManageWarehouseReference,
  canOperateWarehouse,
  canViewWarehouseReports,
  isWarehouseApproverOnly,
} from "@/features/warehouse/services/warehouse-access";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  BarChart3,
  Car,
  Wrench,
  FolderKanban,
  CalendarClock,
  Layers,
  Truck,
  ShieldCheck,
  Database,
  Package,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string; isTitle?: boolean }[];
}

/**
 * Returns the navigation items for a given role.
 * Mechanic gets a simplified task-focused menu.
 * Other roles get permission-gated ERP navigation.
 */
export function getNavItems(role: UserRole): NavItem[] {
  const items: NavItem[] = [];

  if (role === "mechanic") {
    items.push(
      { label: "Tugas Hari Ini", href: "/dashboard/operational/monitoring", icon: <Wrench className="w-4 h-4" /> },
      { label: "Work Order", href: "/dashboard/operational/work-orders", icon: <FileText className="w-4 h-4" /> },
      { label: "Plan Saya", href: "/dashboard/operational/planning", icon: <Calendar className="w-4 h-4" /> }
    );
    return items;
  }

  // Non-mechanic roles: permission-gated navigation
  items.push({
    label: "Overview",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
  });



  // ── OPERATIONAL HUB (Job Plan + Tasks + QC + WO) ──────────────────────────
  if (hasPermission(role, Permission.VIEW_OPERATIONAL)) {
    items.push({
      label: "Operational",
      href: "/dashboard/operational",
      icon: <Layers className="w-4 h-4" />,
      children: [
        { label: "Planning", href: "/dashboard/operational/planning" },
        { label: "Monitoring", href: "/dashboard/operational/monitoring" },
        { label: "Quality Check", href: "/dashboard/operational/qc" },
        { label: "Work Order", href: "/dashboard/operational/work-orders" },
      ],
    });
  }

  // ── COUNTDOWN MONITOR (menggantikan Core Jobs) ────────────────────────────
  if (hasPermission(role, Permission.VIEW_COUNTDOWN)) {
    items.push({
      label: "Countdown",
      href: "/dashboard/countdown",
      icon: <CalendarClock className="w-4 h-4" />,
    });
  }


  if (hasPermission(role, Permission.VIEW_KPI)) {
    items.push({ label: "KPI", href: "/dashboard/kpi", icon: <BarChart3 className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_UNIT_PROGRESS)) {
    items.push({ label: "Unit Progress", href: "/dashboard/unit-progress", icon: <Car className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_PROJECTS)) {
    items.push({ label: "Projects", href: "/dashboard/projects", icon: <FolderKanban className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_WORKLOAD)) {
    items.push({ label: "Workload", href: "/dashboard/workload", icon: <CalendarClock className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_VENDORS)) {
    items.push({ label: "Vendors", href: "/dashboard/vendors", icon: <Truck className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_APPROVALS)) {
    items.push({ label: "Approvals", href: "/dashboard/approvals", icon: <ShieldCheck className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_REPORTS)) {
    items.push({ label: "Reports", href: "/dashboard/reports", icon: <BarChart3 className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_MASTER_DATA)) {
    items.push({ label: "Master Data", href: "/dashboard/master-data", icon: <Database className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_WAREHOUSE)) {
    const warehouseChildren: { label: string; href: string; isTitle?: boolean }[] = [
      { label: "Dashboard", href: "/dashboard/warehouse" },
      { label: "Transaksi", href: "/dashboard/warehouse/transactions" },
    ];

    if (canOperateWarehouse(role)) {
      warehouseChildren.push(
        { label: "Stock Card", href: "/dashboard/warehouse/stock-card" },
        { label: "Master Item", href: "/dashboard/warehouse/master-item" },
        { label: "Lokasi Rak", href: "/dashboard/warehouse/locations" },
      );
    }

    if (canViewWarehouseReports(role)) {
      warehouseChildren.push({ label: "Laporan", href: "/dashboard/warehouse/reports" });
    }

    if (canManageWarehouseReference(role) && !isWarehouseApproverOnly(role)) {
      warehouseChildren.push(
        { label: "REFERENSI", href: "#", isTitle: true },
        { label: "Referensi", href: "/dashboard/warehouse/ref" },
      );
    }

    items.push({
      label: "Gudang",
      href: "/dashboard/warehouse",
      icon: <Package className="w-4 h-4" />,
      children: warehouseChildren,
    });
  }

  return items;
}

/** Check if a nav item is active based on current pathname */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  // Strip query string before matching
  const cleanHref = href.split("?")[0];
  return pathname.startsWith(cleanHref);
}
