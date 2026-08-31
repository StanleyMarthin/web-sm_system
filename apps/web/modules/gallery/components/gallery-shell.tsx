"use client";

import type {
  GalleryQuery,
  GalleryRecord,
} from "@smsystem/contracts/gallery";
import { Camera } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SmartDataGrid } from "@/shared/datagrid/smart-data-grid";
import type {
  SmartDataGridColumn,
  SmartDataGridRow,
  SmartDataGridSortOption,
} from "@/shared/datagrid/types";
import { GalleryPhotoDrawer } from "@/modules/gallery/components/gallery-photo-drawer";
import { CompactDateInput } from "@/shared/ui/compact";

interface GalleryShellProps {
  rows: GalleryRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  state: GalleryQuery;
  references: {
    units: Array<{ value: string; label: string }>;
    divisions: Array<{ value: string; label: string }>;
    panels: Array<{ value: string; label: string }>;
    statuses: Array<{ value: string; label: string }>;
  };
  canManagePhotos: boolean;
  canDownloadPhotos: boolean;
}

const sortOptions: SmartDataGridSortOption[] = [
  { label: "Tanggal kerja", value: "workDate" },
  { label: "Unit", value: "unitName" },
  { label: "Panel / Part", value: "panelName" },
  { label: "Pekerjaan", value: "jobName" },
  { label: "PIC", value: "employeeName" },
  { label: "Status", value: "actualStatus" },
];

export function GalleryShell({
  rows,
  meta,
  state,
  references,
  canManagePhotos,
  canDownloadPhotos,
}: GalleryShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedActualId, setSelectedActualId] = useState<string | null>(null);

  const gridRows = rows.map((row) => ({
    actualId: row.actualId,
    workDate: row.workDate,
    unitName: row.unitName,
    divisionName: row.divisionName,
    panelName: row.panelName,
    partName: row.partName,
    panelPart: [row.panelName, row.partName].filter((value) => value && value !== "-").join(" / ") || "-",
    jobName: row.jobName,
    jobDescription: row.jobDescription,
    employeeName: row.employeeName,
    actualStatus: row.actualStatus,
  }));

  const columns = useMemo<SmartDataGridColumn[]>(
    () => [
      { key: "workDate", label: "Tanggal", kind: "mono" },
      { 
        key: "unitName", 
        label: "Unit", 
        sticky: true,
        filterKey: "unitId",
        filterOptions: references.units 
      },
      { 
        key: "divisionName", 
        label: "Divisi",
        filterKey: "divisionId",
        filterOptions: references.divisions
      },
      {
        key: "panelPart",
        label: "Panel / Part",
        filterKey: "panelId",
        filterOptions: references.panels 
      },
      {
        key: "jobName",
        label: "Pekerjaan",
        filterKey: "jobSearch",
        renderCell: (value) => (
          <span className="inline-flex items-center gap-2 text-left text-app-accent-ink">
            <Camera className="h-3.5 w-3.5 text-app-accent-ink/80" />
            <span>{value ? String(value) : "-"}</span>
          </span>
        ),
      },
      { key: "jobDescription", label: "Instruksi Kerja" },
      { key: "employeeName", label: "PIC" },
      { 
        key: "actualStatus", 
        label: "Status", 
        kind: "status",
        filterKey: "status",
        filterOptions: references.statuses 
      },
    ],
    [references],
  );

  function handleDateChange(newDate: string) {
    if (!newDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    params.set("page", "1");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-6">
      <SmartDataGrid
        viewportClassName="max-h-[calc(100svh-260px)]"
        title="Daftar jobdesc"
        description=""
        columns={columns}
        rows={gridRows}
        meta={meta}
        state={state}
        searchPlaceholder="Cari unit, panel/part, pekerjaan, instruksi, atau PIC..."
        sortOptions={sortOptions}
        emptyMessage="Belum ada jobdesc yang cocok dengan filter gallery saat ini."
        onRowClick={(row: SmartDataGridRow) => setSelectedActualId(String(row.actualId))}
        getRowAriaLabel={(row: SmartDataGridRow) =>
          `Buka foto pekerjaan ${String(row.jobName ?? "jobdesc")} untuk unit ${String(row.unitName ?? "-")}`
        }
        headerActions={
          <CompactDateInput
            value={state.date}
            onChange={handleDateChange}
            className="w-[180px]"
          />
        }
      />

      <GalleryPhotoDrawer
        actualId={selectedActualId}
        isOpen={selectedActualId !== null}
        canManagePhotos={canManagePhotos}
        canDownloadPhotos={canDownloadPhotos}
        onClose={() => setSelectedActualId(null)}
      />
    </div>
  );
}
