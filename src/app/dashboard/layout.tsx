// ============================================================
// Dashboard Layout — Sidebar + TopBar + Main content (Server Component)
// Web-only: no mobile responsive — min-screen blocker handles small viewports
// ============================================================

import { AuthGuard } from "@/features/auth/components/auth-guard";
import { Sidebar } from "@/features/dashboard/components/sidebar";
import { TopBar } from "@/features/dashboard/components/top-bar";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky TopBar with mobile nav trigger */}
          <TopBar />

          {/* Content area — deep dark SM background */}
          <main className="flex-1 p-6 overflow-auto bg-[#0e0e0e]">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
