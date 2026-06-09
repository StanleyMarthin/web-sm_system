"use client";

import Image from "next/image";
import type { AuthUser } from "@smsystem/contracts/auth";
import {
  CarFront,
  Clock3,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Table2,
  Users,
  Menu,
  UserCircle,
  ClipboardList,
  Activity,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  FileText,
  Receipt,
  BarChart,
  Package,
  ChevronDown,
  Sun,
  Moon,
  Lock,
  User,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { SERIF_STYLE } from "@/lib/constants";
import type { NavigationItem, NavigationSubItem } from "@/shared/navigation/modules";
import { logoutFromWeb } from "@/shared/auth/client";

interface AppShellProps {
  user: AuthUser;
  navigation: NavigationItem[];
  children: React.ReactNode;
}

const navigationIcons = {
  dashboard: LayoutDashboard,
  grid: Table2,
  units: CarFront,
  countdown: Clock3,
  users: Users,
  roles: ShieldCheck,
} as const;

const MAX_IDLE_PREFETCH_ROUTES = 4;
const PREFETCH_DELAY_MS = 300;

function collectNavigationHrefs(items: Array<NavigationItem | NavigationSubItem>): string[] {
  const hrefs: string[] = [];

  for (const item of items) {
    if (item.href && item.href !== "#") {
      hrefs.push(item.href);
    }
    if (item.subItems?.length) {
      hrefs.push(...collectNavigationHrefs(item.subItems));
    }
  }

  return hrefs;
}

function matchesBasePath(pathname: string, href: string, id?: string): boolean {
  const targetPath = new URL(href, "http://localhost").pathname;
  return (
    pathname === targetPath ||
    (targetPath === "/spk" && pathname.startsWith("/spk/")) ||
    (targetPath === "/wo" && pathname.startsWith("/wo/")) ||
    (targetPath === "/issues" && pathname.startsWith("/issues/")) ||
    (targetPath === "/qc" && pathname.startsWith("/qc")) ||
    (targetPath === "/monitoring/division" && pathname.startsWith("/monitoring/division")) ||
    (targetPath === "/monitoring/employee" && pathname.startsWith("/monitoring/employee")) ||
    (targetPath === "/monitoring" && (pathname === "/monitoring" || pathname.startsWith("/monitoring/today") || pathname.startsWith("/monitoring/overtime"))) ||
    (targetPath === "/settings/calendar" && pathname.startsWith("/settings/calendar")) ||
    (id === "requests" && pathname.startsWith("/requests")) ||
    (id === "warehouse" && pathname.startsWith("/warehouse"))
  );
}

function initialsFromName(fullName: string): string {
  return fullName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AppShell({ user, navigation, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const isDark = mounted && theme === "dark";

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const idlePrefetchRoutes = useMemo(() => {
    const seen = new Set<string>();

    return collectNavigationHrefs(navigation)
      .filter((href) => {
        const target = new URL(href, "http://localhost");
        const normalizedHref = `${target.pathname}${target.search}`;
        if (target.pathname === pathname || seen.has(normalizedHref)) return false;
        seen.add(normalizedHref);
        return true;
      })
      .slice(0, MAX_IDLE_PREFETCH_ROUTES);
  }, [navigation, pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isHrefActive = useCallback((href: string | undefined, id?: string) => {
    if (!href) return false;
    const target = new URL(href, "http://localhost");
    if (!matchesBasePath(pathname, href, id)) return false;
    const targetSection = target.searchParams.get("section");
    if (targetSection) {
      const currentSection = searchParams.get("section") ?? (pathname === "/warehouse" ? "overview" : null);
      return currentSection === targetSection;
    }
    if ([...target.searchParams.keys()].length === 0) return true;
    for (const key of new Set(target.searchParams.keys())) {
      const targetValues = target.searchParams.getAll(key).sort().join("|");
      const currentValues = searchParams.getAll(key).sort().join("|");
      if (targetValues !== currentValues) return false;
    }
    return true;
  }, [pathname, searchParams]);

  const isNodeActive = useCallback((item: NavigationItem | NavigationSubItem): boolean => {
    function checkNodeActive(node: NavigationItem | NavigationSubItem): boolean {
      if (isHrefActive(node.href, node.id)) return true;
      return (node.subItems ?? []).some((subItem) => checkNodeActive(subItem));
    }

    return checkNodeActive(item);
  }, [isHrefActive]);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setExpandedGroups(prev => {
        const next = new Set(prev);
        for (const item of navigation) {
          if (item.subItems?.length && isNodeActive(item)) {
            next.add(item.id);
          }
        }
        return next;
      });
    });

    return () => {
      alive = false;
    };
  }, [isNodeActive, navigation]);

  useEffect(() => {
    if (idlePrefetchRoutes.length === 0) return;

    const timeoutIds: number[] = [];
    const schedulePrefetch = () => {
      idlePrefetchRoutes.forEach((href, index) => {
        const timeoutId = window.setTimeout(() => {
          router.prefetch(href);
        }, index * PREFETCH_DELAY_MS);
        timeoutIds.push(timeoutId);
      });
    };

    const idleCallback =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(schedulePrefetch, { timeout: 1_500 })
        : null;

    if (idleCallback == null) {
      timeoutIds.push(window.setTimeout(schedulePrefetch, 750));
    }

    return () => {
      if (idleCallback != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallback);
      }
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [idlePrefetchRoutes, router]);

  function toggleExpanded(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderSubItems(items: NavigationSubItem[], depth = 0): React.ReactNode {
    return (
      <div className="flex flex-col space-y-0.5 mt-0.5 pb-1">
        {items.map((subItem) => {
          const hasChildren = Boolean(subItem.subItems?.length);
          const active = isNodeActive(subItem);

          if (!subItem.href && hasChildren) {
            return (
              <div key={subItem.id} className="pt-2 first:pt-1 pb-0.5">
                <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-gray-600 dark:text-white/45">
                  {subItem.label}
                </p>
                {renderSubItems(subItem.subItems!, depth + 1)}
              </div>
            );
          }

          return (
            <div key={subItem.id}>
              <Link
                href={subItem.href ?? "#"}
                prefetch={false}
                className={[
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                  depth === 0 ? "text-[13px]" : "text-[12px]",
                  active
                    ? "font-medium text-amber-500 dark:text-amber-400"
                    : "text-gray-500 hover:text-gray-800 dark:text-white/45 dark:hover:text-white/75"
                ].join(" ")}
              >
                {active ? (
                  <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" />
                ) : (
                  <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300 dark:bg-white/[0.12]" />
                )}
                {subItem.label}
              </Link>
              {hasChildren && active ? renderSubItems(subItem.subItems!, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  }

  function renderNavItem(item: NavigationItem) {
    const Icon = navigationIcons[item.icon];
    const active = isNodeActive(item);
    const hasSubItems = Boolean(item.subItems?.length);
    const isExpanded = expandedGroups.has(item.id);

    if (hasSubItems) {
      return (
        <div key={item.id} className="flex flex-col">
          <button
            type="button"
            onClick={() => toggleExpanded(item.id)}
            className={[
              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors",
              active
                ? "font-medium text-gray-900 dark:text-white/80"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-white/48 dark:hover:bg-white/[0.04] dark:hover:text-white/78"
            ].join(" ")}
          >
            <Icon className={active ? "w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" : "w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-white/20"} />
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown className={["w-3 h-3 shrink-0 transition-transform duration-250 ease-in-out", isExpanded ? "rotate-180" : ""].join(" ")} />
          </button>

          <div className={[
            "overflow-hidden transition-[max-height] duration-250 ease-in-out ml-3 pl-2 border-l border-gray-200 dark:border-white/[0.06] mt-1",
            isExpanded ? "max-h-[500px]" : "max-h-0"
          ].join(" ")}>
            {renderSubItems(item.subItems!)}
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href ?? "#"}
        prefetch={false}
        className={[
          "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors",
          active
            ? "font-medium bg-amber-500/10 text-amber-500 dark:bg-amber-500/[0.08] dark:text-amber-400"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-white/48 dark:hover:bg-white/[0.04] dark:hover:text-white/78"
        ].join(" ")}
      >
        <Icon className={active ? "w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" : "w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-white/20"} />
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  let activeParentLabel = "";
  let activeChildLabel = "";
  for (const item of navigation) {
    if (isNodeActive(item)) {
      activeParentLabel = item.label;
      if (item.subItems) {
        for (const sub of item.subItems) {
          if (isNodeActive(sub)) {
            activeChildLabel = sub.label;
            break;
          }
        }
      }
      break;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#0a0a0c] dark:text-white print:block print:h-auto print:bg-white print:text-black print:overflow-visible">

      {/* ── Sidebar ── */}
      <aside className={[
        "flex shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-200 dark:border-white/[0.05] dark:bg-[#111114] print:hidden",
        isSidebarOpen ? "w-[248px]" : "w-0",
      ].join(" ")}>

        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-gray-200 px-3 dark:border-white/[0.06]">
          <div className="h-8 w-8 shrink-0 overflow-hidden border border-gray-300 dark:border-white/[0.10] rounded-sm">
            <Image src="/sm.jpeg" alt="SM" width={32} height={32} className="object-cover w-full h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-gray-900 leading-none dark:text-white/90" style={SERIF_STYLE}>
              Stanley Marthin System
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.04em] text-gray-500 leading-tight dark:text-white/45">
              Classic Restoration<br/>Garage
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {/* Solo Items */}
          {navigation.filter(item => !item.group).map(item => renderNavItem(item))}

          {/* Grouped Items */}
          {Array.from(new Set(navigation.map(i => i.group).filter(Boolean))).map(groupName => (
            <div key={groupName!} className="mt-4 first:mt-0">
              <div className="flex items-center gap-2 px-2 pt-3 pb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 dark:text-white/35">
                  {groupName}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.05]" />
              </div>
              <div className="space-y-0.5">
                {navigation.filter(item => item.group === groupName).map(item => renderNavItem(item))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden print:block print:h-auto print:overflow-visible">

        {/* Topbar — 56px ERP style */}
        <header className="z-50 flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 dark:border-white/[0.06] dark:bg-[#111114] print:hidden">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-transparent text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:text-white/35 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.03] dark:hover:text-white/70"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Title & Breadcrumb */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            {activeParentLabel ? (
              <div className="flex items-center gap-1.5 text-[13px] font-medium tracking-wide text-gray-600 dark:text-white/50">
                <span>{activeParentLabel}</span>
                {activeChildLabel ? (
                  <>
                    <span className="text-gray-300 dark:text-white/15">/</span>
                    <span>{activeChildLabel}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <h1 className="text-[20px] font-bold truncate leading-tight text-gray-900 dark:text-white/95">
              {activeChildLabel || activeParentLabel || "Dashboard"}
            </h1>
          </div>

          {/* Right section: User profile dropdown */}
          <div className="flex items-center relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((v) => !v)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.03]"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[14px] font-semibold leading-none truncate text-gray-800 dark:text-white/85">
                  {user.fullName}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] leading-none text-gray-500 dark:text-white/45">
                  {user.divisionName}
                </p>
              </div>

              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-slate-50 dark:border-white/[0.05] dark:bg-[#0a0a0c]">
                {user.photoUrl ? (
                  <Image src={user.photoUrl} alt={user.fullName} fill sizes="36px" className="object-cover" />
                ) : (
                  <span className="text-[12px] font-bold text-gray-400 dark:text-white/40">
                    {initialsFromName(user.fullName)}
                  </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-white/30" />
            </button>

            {/* Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 z-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl py-1 dark:border-white/[0.07] dark:bg-[#111114]">
                <div className="px-4 py-3 border-b border-gray-200 mb-1 dark:border-white/[0.05]">
                  <p className="text-[14px] font-semibold truncate leading-tight text-gray-900 dark:text-white">{user.fullName}</p>
                  <p className="text-[10px] font-mono mt-1 uppercase tracking-[0.08em] leading-snug text-gray-500 dark:text-white/50">{user.divisionName}</p>
                </div>

                <div className="px-2 py-1 space-y-0.5">
                  <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </button>

                  <Link
                    href="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  >
                    <User className="w-4 h-4" />
                    Profile Settings
                  </Link>

                  <Link
                    href="/settings/password"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </Link>
                </div>

                <div className="h-px bg-gray-200 my-1 mx-2 dark:bg-white/[0.05]" />

                <div className="px-2 py-1">
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={async () => {
                      setIsLoggingOut(true);
                      try {
                        await logoutFromWeb();
                        window.location.href = "/login";
                      } catch {
                        setIsLoggingOut(false);
                      }
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-red-500/80 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                    {isLoggingOut ? "Signing Out..." : "Sign Out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content — full width, tight padding */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0a0a0c] print:overflow-visible print:bg-white">
          <div className="p-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
