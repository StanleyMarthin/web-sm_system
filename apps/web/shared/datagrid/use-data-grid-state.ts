"use client";

import type { GridFilter, GridQueryState } from "@smsystem/contracts/grid";
import { encodeGridFilterToken } from "@smsystem/contracts/grid";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { SmartDataGridSavedView } from "@/shared/datagrid/types";

interface ReplaceGridStateInput {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: GridQueryState["sortDirection"];
  filters?: GridFilter[];
  view?: string | null;
}

function upsertFilter(filters: GridFilter[], field: string, value: string): GridFilter[] {
  const remainingFilters = filters.filter((filter) => filter.field !== field);
  if (!value) {
    return remainingFilters;
  }

  return [...remainingFilters, { field, operator: "eq", value }];
}

export function useDataGridState(initialState: GridQueryState) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function replaceGridState(input: ReplaceGridStateInput) {
    const params = new URLSearchParams(searchParams.toString());
    const nextState: GridQueryState = {
      ...initialState,
      ...input,
      view: input.view === undefined ? initialState.view : input.view,
      filters: input.filters ?? initialState.filters,
    };

    params.set("page", String(nextState.page));
    params.set("limit", String(nextState.limit));

    if (nextState.search) {
      params.set("search", nextState.search);
    } else {
      params.delete("search");
    }

    params.set("sortBy", nextState.sortBy);
    params.set("sortDirection", nextState.sortDirection);

    if (nextState.view) {
      params.set("view", nextState.view);
    } else {
      params.delete("view");
    }

    params.delete("filter");
    for (const filter of nextState.filters) {
      params.append("filter", encodeGridFilterToken(filter));
    }

    const nextUrl = params.toString() ? `${pathname}?${params}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  return {
    isPending,
    setPage(page: number) {
      replaceGridState({ page });
    },
    setLimit(limit: number) {
      replaceGridState({ page: 1, limit });
    },
    setSearch(search: string) {
      replaceGridState({ page: 1, search, view: null });
    },
    setSort(sortBy: string, sortDirection: GridQueryState["sortDirection"]) {
      replaceGridState({ page: 1, sortBy, sortDirection, view: null });
    },
    setFilter(field: string, value: string) {
      replaceGridState({
        page: 1,
        view: null,
        filters: upsertFilter(initialState.filters, field, value),
      });
    },
    applySavedView(view: SmartDataGridSavedView) {
      replaceGridState({
        page: 1,
        search: view.search ?? "",
        sortBy: view.sortBy ?? initialState.sortBy,
        sortDirection: view.sortDirection ?? initialState.sortDirection,
        filters: view.filters ?? [],
        view: view.id,
      });
    },
  };
}
