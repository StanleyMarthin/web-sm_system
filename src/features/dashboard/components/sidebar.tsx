"use client";

// ============================================================
// Dashboard Sidebar — Stanley Marthin luxury automotive vibe
// Black bg, gold accent, wide tracking, serif brand
// ============================================================

import { useCallback, useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getNavItems, isNavActive } from "@/features/dashboard/lib/nav-items";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { SERIF_STYLE } from "@/lib/constants";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const navItems = useMemo(
    () => (user ? getNavItems(user.role) : []),
    [user]
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const newExpanded = { ...expanded };
    let changed = false;
    navItems.forEach((item) => {
      if (item.children && isNavActive(item.href, pathname)) {
        if (!newExpanded[item.href]) {
          newExpanded[item.href] = true;
          changed = true;
        }
      }
    });
    if (changed) {
      setExpanded(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navItems]);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  if (!user) return null;

  const safeName = user.fullName || "User";
  const initials = safeName
    .split(" ")
    .map((n) => n[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex w-60 flex-col bg-[#0a0a0a] border-r border-white/[0.06] h-screen sticky top-0 shrink-0">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-white/10 shrink-0">
          <Image
            src="/sm.jpeg"
            alt="SM"
            width={36}
            height={36}
            className="object-cover w-full h-full"
            priority
          />
        </div>
        <div className="min-w-0">
          <h1
            className="text-white text-xs font-light tracking-[0.2em] uppercase leading-tight truncate"
            style={SERIF_STYLE}
          >
            Stanley Marthin
          </h1>
          <p className="text-[9px] text-amber-500/60 tracking-[0.15em] uppercase leading-tight">
            Stanley Marthin System
          </p>
        </div>
      </div>

      <Separator className="bg-white/[0.06]" />

      {/* User Info */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-amber-500">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-white/90 font-medium truncate leading-tight">{user.fullName}</p>
          <p className="text-[10px] text-white/30 tracking-wider uppercase leading-tight">
            {user.role} · {user.divisionName}
          </p>
        </div>
      </div>

      <Separator className="bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <p className="px-2 pt-1 pb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-white/25">
          Menu
        </p>
        {navItems.map((item) => {
          const active = isNavActive(item.href, pathname);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expanded[item.href];

          return (
            <div key={item.href} className="space-y-0.5">
              <button
                onClick={() => {
                  if (hasChildren) {
                    setExpanded((prev) => ({ ...prev, [item.href]: !prev[item.href] }));
                    if (!isExpanded) {
                      router.push(item.href);
                    }
                  } else {
                    router.push(item.href);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all",
                  active
                    ? "bg-amber-500/10 text-amber-500"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                )}
              >
                <span className={cn(active ? "text-amber-500" : "text-white/25")}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown className={cn("w-3.5 h-3.5", active ? "text-amber-500/50" : "text-white/20")} />
                  ) : (
                    <ChevronRight className={cn("w-3.5 h-3.5", active ? "text-amber-500/50" : "text-white/20")} />
                  )
                ) : (
                  active && <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                )}
              </button>

              {/* Sub-menu rendering if active */}
              {hasChildren && isExpanded && (
                <div className="pl-9 pr-2 py-1 space-y-0.5">
                  {item.children!.map((child, idx) => {
                    if (child.isTitle) {
                      return (
                        <p key={`title-${idx}`} className="pt-3 pb-1 text-[8px] uppercase tracking-[0.2em] text-white/20 font-medium">
                          {child.label}
                        </p>
                      );
                    }
                    const isChildActive = pathname === child.href;
                    return (
                      <button
                        key={child.href}
                        onClick={() => router.push(child.href)}
                        className={cn(
                          "w-full text-left text-[11px] py-1.5 px-3 rounded-md transition-all flex items-center gap-2",
                          isChildActive
                            ? "text-amber-400 bg-white/[0.03]"
                            : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                        )}
                      >
                        <span className="flex-1">{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <Separator className="bg-white/[0.06]" />

      {/* Logout */}
      <div className="px-3 py-2 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.05] transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
