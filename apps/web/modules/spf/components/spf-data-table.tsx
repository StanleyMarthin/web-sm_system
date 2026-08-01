import type { ReactNode } from "react";
import { EmptyRow } from "@/shared/ui/compact";

export interface SpfDataTableColumn<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function SpfDataTable<T extends { id?: string }>({
  rows,
  columns,
  emptyMessage,
  minWidth = 900,
}: {
  rows: readonly T[];
  columns: readonly SpfDataTableColumn<T>[];
  emptyMessage: string;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <EmptyRow message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto border border-border dark:border-white/[0.05]">
      <table className="w-full text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border bg-muted dark:border-white/[0.05] dark:bg-white/[0.02]">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground dark:text-foreground/40 ${column.className ?? ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id ?? String(index)}
              className="border-b border-border last:border-b-0 hover:bg-muted/40 dark:border-white/[0.04] dark:hover:bg-white/[0.02]"
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-2.5 align-top ${column.className ?? ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
