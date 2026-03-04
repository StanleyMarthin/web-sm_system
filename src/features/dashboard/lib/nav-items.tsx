// ============================================================
// Shared Navigation Items — Single source of truth for sidebar & mobile nav
//
// REFACTORED: Previously duplicated in sidebar.tsx and mobile-nav.tsx.
// Now centralized here to ensure consistency and reduce maintenance cost.
// ============================================================

import { hasPermission, Permission } from "@/config/rbac";
import {
  LayoutDashboard,
  Monitor,
  Calendar,
  FileText,
  CheckSquare,
  BarChart3,
  Car,
  Wrench,
  FolderKanban,
  CalendarClock,
  Layers,
  Truck,
  ShieldCheck,
  Database,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
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
      { label: "Tugas Hari Ini", href: "/dashboard/tasks", icon: <Wrench className="w-4 h-4" /> },
      { label: "Work Order", href: "/dashboard/work-orders", icon: <FileText className="w-4 h-4" /> },
      { label: "Plan Saya", href: "/dashboard/planning", icon: <Calendar className="w-4 h-4" /> }
    );
    return items;
  }

  // Non-mechanic roles: permission-gated navigation
  items.push({
    label: "Overview",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
  });

  if (hasPermission(role, Permission.VIEW_MONITORING)) {
    items.push({ label: "Monitoring", href: "/dashboard/monitoring", icon: <Monitor className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_PLANNING)) {
    items.push({ label: "Planning", href: "/dashboard/planning", icon: <Calendar className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_WORK_ORDERS)) {
    items.push({ label: "Work Order", href: "/dashboard/work-orders", icon: <FileText className="w-4 h-4" /> });
  }
  if (hasPermission(role, Permission.VIEW_QC)) {
    items.push({ label: "Quality Check", href: "/dashboard/qc", icon: <CheckSquare className="w-4 h-4" /> });
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
  if (hasPermission(role, Permission.VIEW_CORE_JOBS)) {
    items.push({ label: "Core Jobs", href: "/dashboard/core-jobs", icon: <Layers className="w-4 h-4" /> });
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

  return items;
}

/** Check if a nav item is active based on current pathname */
export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}
