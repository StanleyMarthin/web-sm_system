"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RotateCcw, Search } from "lucide-react";
import { PeriodList } from "./period-list";
import type { SpfPagination, SpfPeriod, SpfPeriodStatus } from "@/shared/api/spf-contracts";
import { ActionButton, CompactInput, PageHeader, SectionCard } from "@/shared/ui/compact";

interface PeriodListShellProps {
  rows: readonly SpfPeriod[];
  meta: SpfPagination;
  canAdmin: boolean;
}

const STATUS_OPTIONS: Array<{ value: "" | SpfPeriodStatus; label: string }> = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WAITING_APPROVAL", label: "Waiting Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED", label: "Published" },
];

export function PeriodListShell({ rows, meta, canAdmin }: PeriodListShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unit, setUnit] = useState(searchParams.get("unit") ?? "");
  const [year, setYear] = useState(searchParams.get("tahun") ?? searchParams.get("year") ?? "");
  const [dateStart, setDateStart] = useState(searchParams.get("date_start") ?? "");
  const [dateEnd, setDateEnd] = useState(searchParams.get("date_end") ?? "");
  const [workflowStatus, setWorkflowStatus] = useState(searchParams.get("workflow_status") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const activeFilterCount = useMemo(
    () => [unit, year, dateStart, dateEnd, workflowStatus, search].filter(Boolean).length,
    [unit, dateEnd, dateStart, search, workflowStatus, year],
  );

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) params.set(key, value.trim());
      else params.delete(key);
    };
    setOrDelete("unit", unit);
    setOrDelete("tahun", year);
    setOrDelete("date_start", dateStart);
    setOrDelete("date_end", dateEnd);
    setOrDelete("workflow_status", workflowStatus);
    setOrDelete("search", search);
    params.set("page", "1");
    if (!params.get("limit")) params.set("limit", String(meta.limit));
    router.push(`?${params.toString()}`);
  }

  function resetFilters() {
    setUnit("");
    setYear("");
    setDateStart("");
    setDateEnd("");
    setWorkflowStatus("");
    setSearch("");
    router.push("/spf/periods");
  }

  return (
    <section aria-labelledby="spf-period-title" className="space-y-4">
      <PageHeader
        eyebrow="SPF Admin"
        title="Periode SPF"
        actions={
          canAdmin ? (
            <Link
              href="/spf/periods?create=1"
              className="inline-flex h-9 items-center gap-1.5 border border-primary/35 px-3 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-app-accent-ink transition-colors hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Buat Periode
            </Link>
          ) : undefined
        }
      />

      <SectionCard label="Filter Periode">
        <form onSubmit={applyFilters} className="grid gap-3 lg:grid-cols-[1fr_120px_150px_150px_190px_1.3fr_auto]">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Nama Unit</label>
            <CompactInput value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Cari nama unit" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tahun</label>
            <CompactInput value={year} onChange={(event) => setYear(event.target.value)} placeholder="2026" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Mulai</label>
            <CompactInput type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Selesai</label>
            <CompactInput type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Workflow</label>
            <select
              value={workflowStatus}
              onChange={(event) => setWorkflowStatus(event.target.value)}
              className="h-9 w-full border border-border bg-card px-3 font-mono text-[12px] text-foreground outline-none focus:border-primary/55 dark:border-white/[0.08] dark:bg-muted"
            >
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Search</label>
            <CompactInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari periode/unit" />
          </div>
          <div className="flex items-end gap-2">
            <ActionButton type="submit" variant="primary"><Search className="h-3.5 w-3.5" />Filter</ActionButton>
            {activeFilterCount > 0 ? <ActionButton onClick={resetFilters}><RotateCcw className="h-3.5 w-3.5" />Reset</ActionButton> : null}
          </div>
        </form>
      </SectionCard>

      <PeriodList rows={rows} meta={meta} />
    </section>
  );
}
