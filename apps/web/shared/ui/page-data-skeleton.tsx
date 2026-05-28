interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({
  rows = 10,
  columns = 6,
}: TableSkeletonProps) {
  return (
    <div className="overflow-hidden border border-white/[0.06] bg-[#0a0a0c]">
      <div className="grid border-b border-white/[0.05] bg-[#0f0f12]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`head-${index}`} className="px-3 py-2">
            <div className="h-2.5 w-20 animate-pulse bg-white/[0.08]" />
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid border-b border-white/[0.04] last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={`cell-${rowIndex}-${columnIndex}`} className="px-3 py-2">
                <div
                  className="h-2.5 animate-pulse bg-white/[0.06]"
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
        <div className="h-3 w-24 animate-pulse bg-white/[0.08]" />
        <div className="h-6 w-52 animate-pulse bg-white/[0.12]" />
        <div className="h-3 w-72 max-w-full animate-pulse bg-white/[0.06]" />
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {Array.from({ length: stats }).map((_, index) => (
          <div key={`stat-${index}`} className="border border-white/[0.06] bg-[#111114] px-3 py-2">
            <div className="h-2.5 w-16 animate-pulse bg-white/[0.08]" />
            <div className="mt-2 h-4 w-12 animate-pulse bg-white/[0.12]" />
          </div>
        ))}
      </div>

      <div className="border border-white/[0.06] bg-[#0a0a0c]">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-2">
          <div className="h-3 w-28 animate-pulse bg-white/[0.12]" />
          <div className="h-8 w-56 animate-pulse border border-white/[0.06] bg-white/[0.03]" />
          <div className="h-8 w-24 animate-pulse border border-white/[0.06] bg-white/[0.03]" />
        </div>
        <TableSkeleton rows={rows} columns={columns} />
      </div>

      <p className="sr-only">{title}</p>
    </div>
  );
}
