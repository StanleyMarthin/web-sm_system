"use client";

// ============================================================
// useMonitoringData — SWR hook for fetching monitoring jobs
// ============================================================

import useSWR from "swr";
import { useEffect } from "react";
import { getMonitoringJobs } from "@/features/monitoring/services/monitoring-service";
import { useMonitoringStore } from "@/features/monitoring/stores/monitoring-store";

interface UseMonitoringDataParams {
  division: string;
  date: string;
}

/**
 * Fetches monitoring jobs via SWR and syncs into Zustand.
 *
 * PERF NOTES:
 * - shiftFilter removed from SWR key — filtering is done client-side
 *   in the store selector. Changing the filter no longer triggers a refetch.
 * - Triple useEffect collapsed into a single effect to avoid 3 separate
 *   re-render cycles per data update.
 */
export function useMonitoringData({ division, date }: UseMonitoringDataParams) {
  const setJobs = useMonitoringStore((s) => s.setJobs);
  const setLoading = useMonitoringStore((s) => s.setLoading);
  const setError = useMonitoringStore((s) => s.setError);

  const { data, error, isLoading, mutate } = useSWR(
    ["monitoring-jobs", division, date],
    () => getMonitoringJobs({ division, date }),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  // Single effect — sync all SWR state into Zustand in one render cycle
  useEffect(() => {
    setLoading(isLoading);
    if (error) {
      setError(error.message ?? "Gagal memuat data monitoring");
    } else if (data) {
      setJobs(data);
    }
  }, [data, error, isLoading, setJobs, setLoading, setError]);

  return { mutate };
}
