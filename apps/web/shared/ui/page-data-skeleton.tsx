interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({
  rows = 10,
  columns = 6,
}: TableSkeletonProps) {
  return (
    <div className="overflow-hidden border border-border bg-white dark:border-white/[0.06] dark:bg-background">
      <div className="grid border-b border-border bg-muted dark:border-white/[0.05] dark:bg-muted" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`head-${index}`} className="px-3 py-2">
            <div className="h-2.5 w-20 animate-pulse bg-accent dark:bg-white/[0.08]" />
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid border-b border-border last:border-b-0 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={`cell-${rowIndex}-${columnIndex}`} className="px-3 py-2">
                <div
                  className="h-2.5 animate-pulse bg-accent/80 dark:bg-white/[0.06]"
                  style={{ width: `${48 + ((rowIndex + columnIndex) % 4) * 12}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageDataSkeletonProps {
  title?: string;
  rows?: number;
  columns?: number;
  stats?: number;
}

export function PageDataSkeleton({
  title = "Memuat data",
  rows = 10,
  columns = 6,
  stats = 4,
}: PageDataSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse bg-accent dark:bg-white/[0.08]" />
        <div className="h-6 w-52 animate-pulse bg-accent dark:bg-white/[0.12]" />
        <div className="h-3 w-72 max-w-full animate-pulse bg-accent/80 dark:bg-white/[0.06]" />
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {Array.from({ length: stats }).map((_, index) => (
          <div key={`stat-${index}`} className="border border-border bg-white px-3 py-2 shadow-sm dark:border-white/[0.06] dark:bg-card dark:shadow-none">
            <div className="h-2.5 w-16 animate-pulse bg-accent dark:bg-white/[0.08]" />
            <div className="mt-2 h-4 w-12 animate-pulse bg-accent dark:bg-white/[0.12]" />
          </div>
        ))}
      </div>

      <div className="border border-border bg-white shadow-sm dark:border-white/[0.06] dark:bg-background dark:shadow-none">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 dark:border-white/[0.05]">
          <div className="h-3 w-28 animate-pulse bg-accent dark:bg-white/[0.12]" />
          <div className="h-8 w-56 animate-pulse border border-border bg-muted dark:border-white/[0.06] dark:bg-white/[0.03]" />
          <div className="h-8 w-24 animate-pulse border border-border bg-muted dark:border-white/[0.06] dark:bg-white/[0.03]" />
        </div>
        <TableSkeleton rows={rows} columns={columns} />
      </div>

      <p className="sr-only">{title}</p>
    </div>
  );
}
