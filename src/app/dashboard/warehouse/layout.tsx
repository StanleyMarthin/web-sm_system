// ============================================================
// Warehouse Workspace Layout — wraps sub-sidebar + content
// ============================================================

import type { ReactNode } from "react";

export const metadata = {
  title: "Gudang | Stanley Marthin System",
  description: "Warehouse Command Center — manajemen transaksi, stok, dan approval gudang",
};

export default function WarehouseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
