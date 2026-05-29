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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import { SERIF_STYLE } from "@/lib/constants";
import type { NavigationItem, NavigationSubItem } from "@/shared/navigation/modules";
import { logoutFromWeb } from "@/shared/auth/client";
import { ThemeToggle } from "@/shared/components/theme-toggle";

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

  function isHrefActive(href: string | undefined, id?: string) {
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
  }

  function isNodeActive(item: NavigationItem | NavigationSubItem): boolean {
    if (isHrefActive(item.href, item.id)) return true;
    return (item.subItems ?? []).some((subItem) => isNodeActive(subItem));
  }

  function renderSubItems(items: NavigationSubItem[], depth = 0): React.ReactNode {
    return (
      <div className={[
        "border-l border-gray-300 dark:border-white/[0.05]",
        depth === 0 ? "ml-[26px] pl-2.5 pr-1 py-0.5" : "ml-2 pl-2",
      ].join(" ")}>
        {items.map((subItem) => {
          const hasChildren = Boolean(subItem.subItems?.length);
          const active = isNodeActive(subItem);

          if (!subItem.href && hasChildren) {
            return (
              <div key={subItem.id} className="pt-2 first:pt-1 pb-0.5">
                <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
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
                  "flex w-full items-center gap-2 px-2 py-1 text-left transition-colors",
                  depth === 0 ? "text-[11px]" : "text-[10px]",
                  active
                    ? "border-l border-amber-500 pl-[7px] font-medium text-amber-400"
                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-white/30 dark:hover:bg-white/[0.02] dark:hover:text-white/55",
                ].join(" ")}
              >
                <span className="h-1 w-1 shrink-0 flex-none bg-gray-300 dark:bg-white/[0.18]" />
                {subItem.label}
              </Link>
              {hasChildren && active ? renderSubItems(subItem.subItems!, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#0a0a0c] dark:text-white print:block print:h-auto print:bg-white print:text-black print:overflow-visible">

      {/* ── Sidebar ── */}
      <aside className={[
        "flex shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-200 dark:border-white/[0.05] dark:bg-[#111114] print:hidden",
        isSidebarOpen ? "w-52" : "w-0",
      ].join(" ")}>

        {/* Logo row */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-3 dark:border-white/[0.05]">
          <div className="h-6 w-6 shrink-0 overflow-hidden border border-gray-300 dark:border-white/[0.08]">
            <Image src="/sm.jpeg" alt="SM" width={24} height={24} className="object-cover w-full h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-gray-700 leading-none dark:text-white/70" style={SERIF_STYLE}>
              Stanley Marthin
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 leading-none dark:text-white/30">
              System
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          <p className="px-2 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 dark:text-white/30">
            Menu Utama
          </p>

          {navigation.map((item) => {
            const Icon = navigationIcons[item.icon];
            const active = isNodeActive(item);
            const hasSubItems = Boolean(item.subItems?.length);

            return (
              <div key={item.id}>
                <Link
                  href={item.href ?? "#"}
                  prefetch={false}
                  className={[
                    "flex w-full items-center gap-2.5 px-2 py-1.5 text-[12px] transition-colors",
                    active && !hasSubItems
                      ? "border-l border-amber-500 bg-amber-500/10 pl-[7px] text-amber-500"
                      : active && hasSubItems
                      ? "text-gray-800 dark:text-white/75"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-white/35 dark:hover:bg-white/[0.02] dark:hover:text-white/60",
                  ].join(" ")}
                >
                  <Icon className={[
                    "w-3.5 h-3.5 shrink-0",
                    active ? "text-amber-500" : "text-gray-400 dark:text-white/20",
                  ].join(" ")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && !hasSubItems && <span className="h-1 w-1 shrink-0 bg-amber-500" />}
                </Link>
                {hasSubItems && active ? renderSubItems(item.subItems!) : null}
              </div>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="border-t border-gray-200 pt-2 mt-2 pb-2 dark:border-white/5">
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden print:block print:h-auto print:overflow-visible">

        {/* Topbar — 44px ERP style */}
        <header className="z-20 flex h-11 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 dark:border-white/[0.05] dark:bg-[#111114] print:hidden">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-transparent text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:text-white/35 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.03] dark:hover:text-white/70"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1" />

          {/* User profile */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.03]"
            >
              {/* Name + division */}
              <div className="text-right hidden sm:block">
                <p className="text-[11px] text-gray-800 font-medium leading-none truncate dark:text-white/80">
                  {user.fullName}
                </p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 leading-none dark:text-white/30">
                  {user.divisionName}
                </p>
              </div>

              {/* Avatar */}
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-amber-500/20 bg-slate-50 dark:bg-[#0a0a0c]">
                {user.photoUrl ? (
                  <Image src={user.photoUrl} alt={user.fullName} fill sizes="28px" className="object-cover" />
                ) : (
                  <span className="text-[10px] font-semibold text-amber-500">
                    {initialsFromName(user.fullName)}
                  </span>
                )}
              </div>
            </button>

            {/* Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-52 overflow-hidden border border-gray-200 bg-white py-1 dark:border-white/[0.07] dark:bg-[#111114]">
                <div className="px-3 py-2 border-b border-gray-200 mb-1 dark:border-white/[0.05]">
                  <p className="text-[12px] text-gray-900 font-medium truncate dark:text-white">{user.fullName}</p>
                  <p className="text-[10px] text-gray-400 truncate font-mono dark:text-white/35">{user.email || user.employeeId}</p>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors dark:text-white/55 dark:hover:text-white dark:hover:bg-white/[0.04]"
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  Lihat Profile
                </Link>

                <div className="h-px bg-gray-200 my-1 dark:bg-white/[0.05]" />

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
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.04] transition-colors disabled:opacity-40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {isLoggingOut ? "Keluar..." : "Keluar"}
                </button>
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
