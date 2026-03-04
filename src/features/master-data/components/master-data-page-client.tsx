"use client";

// ============================================================
// Master Data Page Client — DataTable view (API #14, #15)
// ============================================================

import { useState, useMemo } from "react";
import { EMPLOYEES, MASTER_PANELS } from "@/lib/dummy-data";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SERIF_STYLE } from "@/lib/constants";
import { DarkCard } from "@/components/ui/dark-card";
import type { Employee, MasterPanel } from "@/types";

type Tab = "employees" | "panels";

const EMP_COLUMNS: DataTableColumn<Employee>[] = [
  { key: "id", label: "ID", sortable: true, sortValue: (r) => r.id, render: (r) => <span className="font-medium text-sm text-white/50 font-mono">{r.id}</span> },
  { key: "name", label: "Nama", sortable: true, sortValue: (r) => r.fullName, render: (r) => <span className="font-medium text-sm text-white/70">{r.fullName}</span> },
  { key: "role", label: "Role", sortable: true, sortValue: (r) => r.role, render: (r) => <Badge className="bg-white/[0.06] text-white/40 border-0 text-[10px] uppercase">{r.role}</Badge> },
  { key: "division", label: "Division", sortable: true, sortValue: (r) => r.divisionName, render: (r) => <span className="text-white/50 text-sm">{r.divisionName}</span> },
];

const PANEL_COLUMNS: DataTableColumn<MasterPanel>[] = [
  { key: "panelId", label: "Panel ID", sortable: true, sortValue: (r) => r.panelId, render: (r) => <span className="font-medium text-sm text-white/50 font-mono tabular-nums">{r.panelId}</span> },
  { key: "panelName", label: "Panel Name", sortable: true, sortValue: (r) => r.panelName, render: (r) => <span className="font-medium text-sm text-white/70">{r.panelName}</span> },
  { key: "category", label: "Category", sortable: true, sortValue: (r) => r.category, render: (r) => <Badge className="bg-white/[0.06] text-white/40 border-0 text-[10px]">{r.category}</Badge> },
];

export function MasterDataPageClient() {
  const [tab, setTab] = useState<Tab>("employees");

  const categories = useMemo(() => {
    const cats = new Set(MASTER_PANELS.map((p) => p.category));
    return Array.from(cats);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light text-white/90 tracking-wide" style={SERIF_STYLE}>
          Master Data
        </h2>
        <p className="text-[11px] text-white/30 tracking-[0.15em] uppercase mt-1">
          Employees & Panels · GET /api/v1/web/master/*
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        {(["employees", "panels"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs tracking-wider uppercase transition-colors ${
              tab === t
                ? "bg-white/[0.08] text-white/80"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {tab === "employees" ? (
          <>
            <DarkCard className="p-4 text-center">
              <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{EMPLOYEES.length}</p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Total Employees</p>
            </DarkCard>
            <DarkCard className="p-4 text-center">
              <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>
                {new Set(EMPLOYEES.map((e) => e.role)).size}
              </p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Roles</p>
            </DarkCard>
            <DarkCard className="p-4 text-center">
              <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>
                {new Set(EMPLOYEES.map((e) => e.divisionName)).size}
              </p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Divisions</p>
            </DarkCard>
          </>
        ) : (
          <>
            <DarkCard className="p-4 text-center">
              <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{MASTER_PANELS.length}</p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Total Panels</p>
            </DarkCard>
            <DarkCard className="p-4 text-center">
              <p className="text-2xl font-bold text-white/90" style={SERIF_STYLE}>{categories.length}</p>
              <p className="text-[11px] text-white/35 tracking-wider uppercase">Categories</p>
            </DarkCard>
            <DarkCard className="p-4 text-center" />
          </>
        )}
      </div>

      {/* Employees DataTable */}
      {tab === "employees" && (
        <DataTable
          data={EMPLOYEES}
          columns={EMP_COLUMNS}
          rowKey={(r) => r.id}
          selectable
          searchable
          searchPlaceholder="Cari nama, role, divisi..."
          searchFn={(r, q) =>
            r.fullName.toLowerCase().includes(q) ||
            r.role.toLowerCase().includes(q) ||
            r.divisionName.toLowerCase().includes(q)
          }
          emptyMessage="Tidak ada data karyawan."
        />
      )}

      {/* Panels DataTable */}
      {tab === "panels" && (
        <DataTable
          data={MASTER_PANELS}
          columns={PANEL_COLUMNS}
          rowKey={(r) => String(r.panelId)}
          selectable
          searchable
          searchPlaceholder="Cari panel, kategori..."
          searchFn={(r, q) =>
            r.panelName.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)
          }
          emptyMessage="Tidak ada data panel."
        />
      )}
    </div>
  );
}
