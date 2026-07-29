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
    (id === "warehouse" && pathname.startsWith("/warehouse")) ||
    (id === "spf" && pathname.startsWith("/spf"))
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
  const [logoutError, setLogoutError] = useState<string | null>(null);
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
                <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/45">
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
                    ? "border-l-2 border-sidebar-active bg-sidebar-accent font-semibold text-sidebar-foreground dark:border-primary dark:text-primary"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground"
                ].join(" ")}
              >
                {active ? (
                  <span className="h-1 w-1 shrink-0 rounded-full bg-sidebar-active dark:bg-primary" />
                ) : (
                  <span className="h-1 w-1 shrink-0 rounded-full bg-sidebar-foreground/35 dark:bg-muted-foreground/40" />
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
                ? "border-l-2 border-sidebar-active bg-sidebar-accent font-semibold text-sidebar-foreground dark:border-primary dark:text-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground"
            ].join(" ")}
          >
            <Icon className={active ? "w-3.5 h-3.5 shrink-0 text-sidebar-active dark:text-primary" : "w-3.5 h-3.5 shrink-0 text-sidebar-foreground/75 dark:text-muted-foreground"} />
            <span className="flex-1 truncate text-left">{item.label}</span>
            <ChevronDown className={["w-3 h-3 shrink-0 transition-transform duration-250 ease-in-out", isExpanded ? "rotate-180" : ""].join(" ")} />
          </button>

          <div className={[
            "overflow-hidden transition-[max-height] duration-250 ease-in-out ml-3 pl-2 border-l border-border dark:border-white/[0.06] mt-1",
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
            ? "border-l-2 border-sidebar-active bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground"
        ].join(" ")}
      >
        <Icon className={active ? "w-3.5 h-3.5 shrink-0 text-sidebar-primary-foreground" : "w-3.5 h-3.5 shrink-0 text-sidebar-foreground/75 dark:text-muted-foreground"} />
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground print:block print:h-auto print:bg-white print:text-primary-foreground print:overflow-visible">

      {/* ── Sidebar ── */}
      <aside className={[
        "flex shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 dark:border-border dark:bg-sidebar print:hidden",
        isSidebarOpen ? "w-[248px]" : "w-0",
      ].join(" ")}>

        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-3 dark:border-border">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-sidebar-border dark:border-border">
            <Image src="/sm.jpeg" alt="SM" width={32} height={32} className="object-cover w-full h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-none text-sidebar-foreground dark:text-foreground" style={SERIF_STYLE}>
              Stanley Marthin System
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase leading-tight tracking-[0.04em] text-sidebar-foreground/75 dark:text-muted-foreground">
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
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-sidebar-foreground/75 dark:text-muted-foreground">
                  {groupName}
                </span>
                <div className="h-px flex-1 bg-sidebar-border dark:bg-border" />
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
        <header className="z-50 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4 print:hidden">

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Title & Breadcrumb */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            {activeParentLabel ? (
              <div className="flex items-center gap-1.5 text-[13px] font-medium tracking-wide text-muted-foreground">
                <span>{activeParentLabel}</span>
                {activeChildLabel ? (
                  <>
                    <span className="text-app-ink-subtle">/</span>
                    <span>{activeChildLabel}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <h1 className="truncate text-[20px] font-bold leading-tight text-foreground">
              {activeChildLabel || activeParentLabel || "Dashboard"}
            </h1>
          </div>

          {/* Right section: User profile dropdown */}
          <div className="flex items-center relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((v) => !v)}
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="text-right hidden sm:block">
                <p className="truncate text-[14px] font-semibold leading-none text-foreground">
                  {user.fullName}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase leading-none tracking-[0.08em] text-muted-foreground">
                  {user.divisionName}
                </p>
              </div>

              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {user.photoUrl ? (
                  <Image src={user.photoUrl} alt={user.fullName} fill sizes="36px" className="object-cover" />
                ) : (
                  <span className="text-[12px] font-bold text-muted-foreground">
                    {initialsFromName(user.fullName)}
                  </span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                <div className="mb-1 border-b border-border px-4 py-3">
                  <p className="truncate text-[14px] font-semibold leading-tight text-popover-foreground">{user.fullName}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-muted-foreground">{user.divisionName}</p>
                </div>

                <div className="px-2 py-1 space-y-0.5">
                  <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {isDark ? "Light Mode" : "Dark Mode"}
                  </button>

                  <Link
                    href="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <User className="w-4 h-4" />
                    Profile Settings
                  </Link>

                  <Link
                    href="/settings/password"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </Link>
                </div>

                <div className="mx-2 my-1 h-px bg-border" />

                <div className="px-2 py-1">
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={async () => {
                      setIsLoggingOut(true);
                      setLogoutError(null);
                      const didLogout = await logoutFromWeb();
                      if (didLogout) {
                        window.location.href = "/login";
                        return;
                      }

                      setIsLoggingOut(false);
                      setLogoutError("Logout gagal. Coba lagi.");
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="w-4 h-4" />
                    {isLoggingOut ? "Signing Out..." : "Sign Out"}
                  </button>
                  {logoutError && (
                    <p className="px-3 pb-2 pt-1 text-[11px] text-destructive">
                      {logoutError}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content — full width, tight padding */}
        <div className="flex-1 overflow-y-auto bg-background print:overflow-visible print:bg-white">
          <div className="p-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
