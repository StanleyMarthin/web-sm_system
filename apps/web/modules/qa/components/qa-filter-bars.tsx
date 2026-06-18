"use client";

import type { QaReferences } from "@smsystem/contracts/qa";
import { RefreshCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CompactDateRangeInput } from "@/shared/ui/compact";

function updateParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: URLSearchParams,
  updates: Record<string, string>,
) {
  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  params.delete("page");
  const nextQuery = params.toString();
  router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
}

export function QaDashboardFilterBar({
  references,
  divisionId,
  month,
  title,
}: {
  title?: string;
  references: QaReferences;
  divisionId: string;
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-white/[0.06] bg-card px-3 py-2">
      {title && (
        <>
          <div className="mr-auto px-2">
            <h1 className="text-sm font-semibold text-foreground/90">{title}</h1>
          </div>
          <div className="h-4 w-px bg-white/[0.08]" />
        </>
      )}

      <select
        value={divisionId}
        onChange={(event) => updateParams(router, pathname, searchParams, { divisionId: event.target.value })}
        className="h-8 rounded-lg bg-transparent border border-white/[0.06] px-2 text-[11px] text-foreground outline-none focus:border-primary/30"
      >
        <option value="">Semua divisi</option>
        {references.divisions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="h-4 w-px bg-white/[0.08]" />

      <input
        type="month"
        value={month}
        onChange={(event) => updateParams(router, pathname, searchParams, { month: event.target.value })}
        className="h-8 rounded-lg bg-transparent border border-white/[0.06] px-2 text-[11px] text-foreground outline-none focus:border-primary/30 [color-scheme:dark]"
      />

      <div className="h-4 w-px bg-white/[0.08]" />

      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="flex items-center gap-1.5 h-8 rounded-lg bg-white/[0.03] px-2.5 text-[10px] uppercase tracking-wider text-foreground/55 hover:bg-white/[0.06] hover:text-foreground transition-colors"
      >
        <RefreshCcw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  );
}

export function QaHistoryFilterBar({
  references,
  divisionId,
  dateFrom,
  dateTo,
  title,
}: {
  title?: string;
  references: QaReferences;
  divisionId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-white/[0.06] bg-card px-3 py-2">
      {title && (
        <>
          <div className="mr-auto px-2">
            <h1 className="text-sm font-semibold text-foreground/90">{title}</h1>
          </div>
          <div className="h-4 w-px bg-white/[0.08]" />
        </>
      )}

      <select
        value={divisionId}
        onChange={(event) => updateParams(router, pathname, searchParams, { divisionId: event.target.value })}
        className="h-8 rounded-lg bg-transparent border border-white/[0.06] px-2 text-[11px] text-foreground outline-none focus:border-primary/30"
      >
        <option value="">Semua divisi</option>
        {references.divisions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="h-4 w-px bg-white/[0.08]" />

      <CompactDateRangeInput
        from={dateFrom}
        to={dateTo}
        onChange={(range) => updateParams(router, pathname, searchParams, {
          dateFrom: range.from,
          dateTo: range.to,
        })}
        className="w-64"
      />

      <div className="h-4 w-px bg-white/[0.08] ml-auto" />

      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="flex items-center gap-1.5 h-8 rounded-lg bg-white/[0.03] px-2.5 text-[10px] uppercase tracking-wider text-foreground/55 hover:bg-white/[0.06] hover:text-foreground transition-colors"
      >
        <RefreshCcw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  );
}
