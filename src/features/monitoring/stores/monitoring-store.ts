"use client";

// ============================================================
// Monitoring Store (Zustand) — Optimized Real-Time State
//
// REFACTORED:
// - Data structure changed from flat Array to Record<string, MonitoringJob>
//   (Dictionary keyed by job ID) for O(1) lookup & update.
// - History log per mechanic capped at MAX_HISTORY_PER_MECHANIC (FIFO)
//   to prevent memory leaks when tab stays open all day.
// - Derived selectors use Object.values() only when needed,
//   keeping the hot path (updateJob) allocation-free.
// ============================================================

import { create } from "zustand";
import type {
  MonitoringJob,
  MonitoringJobStatus,
  ShiftType,
} from "@/types";

/** Maximum jobs kept per mechanic — oldest are evicted FIFO */
const MAX_HISTORY_PER_MECHANIC = 100;

// ── Types ──────────────────────────────────────────────────

/** Dictionary keyed by job.id for O(1) access */
export type JobsMap = Record<string, MonitoringJob>;

/** Tracks insertion order per mechanic for FIFO eviction */
type MechanicIndex = Record<string, string[]>; // mechanicId → jobId[]

export type ShiftFilter = "ALL" | ShiftType;

export interface MonitoringState {
  /** Primary data — O(1) read/write by jobId */
  jobsMap: JobsMap;
  /** Secondary index — tracks job IDs per mechanic for FIFO limits */
  _mechanicIndex: MechanicIndex;

  isLoading: boolean;
  error: string | null;
  shiftFilter: ShiftFilter;

  // ── Actions ──
  /** Bulk-set jobs (e.g. initial fetch). Rebuilds the entire map + index. */
  setJobs: (jobs: MonitoringJob[]) => void;
  /** Add a single job. Enforces FIFO per-mechanic limit. */
  addJob: (job: MonitoringJob) => void;
  /** O(1) partial update of a single job by ID. */
  updateJob: (jobId: string, updates: Partial<MonitoringJob>) => void;
  /** Remove a single job by ID. */
  removeJob: (jobId: string) => void;
  /** Batch-update multiple jobs at once (e.g. from WebSocket push). */
  batchUpdateJobs: (updates: { id: string; data: Partial<MonitoringJob> }[]) => void;

  setFilter: (filter: ShiftFilter) => void;
  setLoading: (val: boolean) => void;
  setError: (err: string | null) => void;
}

// ── Helpers ─────────────────────────────────────────────────

/** Build both the jobsMap and mechanicIndex from an array, respecting FIFO limits */
function buildIndexedState(jobs: MonitoringJob[]): Pick<MonitoringState, "jobsMap" | "_mechanicIndex"> {
  const mechanicIndex: MechanicIndex = {};
  const jobsMap: JobsMap = {};

  // Group job IDs by mechanic, preserving insertion order
  for (const job of jobs) {
    const mid = job.mechanicId;
    if (!mechanicIndex[mid]) mechanicIndex[mid] = [];
    mechanicIndex[mid].push(job.id);
    jobsMap[job.id] = job;
  }

  // Enforce FIFO limit per mechanic
  for (const mid of Object.keys(mechanicIndex)) {
    const ids = mechanicIndex[mid];
    if (ids.length > MAX_HISTORY_PER_MECHANIC) {
      const overflow = ids.splice(0, ids.length - MAX_HISTORY_PER_MECHANIC);
      for (const evictId of overflow) {
        delete jobsMap[evictId];
      }
    }
  }

  return { jobsMap, _mechanicIndex: mechanicIndex };
}

// ── Store ───────────────────────────────────────────────────

export const useMonitoringStore = create<MonitoringState>((set) => ({
  jobsMap: {},
  _mechanicIndex: {},
  isLoading: false,
  error: null,
  shiftFilter: "ALL",

  setJobs: (jobs) =>
    set({
      ...buildIndexedState(jobs),
      isLoading: false,
      error: null,
    }),

  addJob: (job) =>
    set((state) => {
      // Skip duplicates
      if (state.jobsMap[job.id]) return state;

      const newMap = { ...state.jobsMap, [job.id]: job };
      const mid = job.mechanicId;
      const newIndex = { ...state._mechanicIndex };
      const ids = [...(newIndex[mid] ?? []), job.id];

      // FIFO eviction if limit exceeded
      if (ids.length > MAX_HISTORY_PER_MECHANIC) {
        const evictId = ids.shift()!;
        delete newMap[evictId];
      }
      newIndex[mid] = ids;

      return { jobsMap: newMap, _mechanicIndex: newIndex };
    }),

  updateJob: (jobId, updates) =>
    set((state) => {
      const existing = state.jobsMap[jobId];
      if (!existing) return state; // no-op if job doesn't exist

      return {
        jobsMap: {
          ...state.jobsMap,
          [jobId]: { ...existing, ...updates },
        },
      };
    }),

  removeJob: (jobId) =>
    set((state) => {
      const existing = state.jobsMap[jobId];
      if (!existing) return state;

      const newMap = { ...state.jobsMap };
      delete newMap[jobId];

      const mid = existing.mechanicId;
      const newIndex = { ...state._mechanicIndex };
      newIndex[mid] = (newIndex[mid] ?? []).filter((id) => id !== jobId);
      if (newIndex[mid].length === 0) delete newIndex[mid];

      return { jobsMap: newMap, _mechanicIndex: newIndex };
    }),

  batchUpdateJobs: (updates) =>
    set((state) => {
      let newMap = state.jobsMap;
      let changed = false;

      for (const { id, data } of updates) {
        const existing = newMap[id];
        if (!existing) continue;
        if (!changed) {
          newMap = { ...newMap };
          changed = true;
        }
        newMap[id] = { ...existing, ...data };
      }

      return changed ? { jobsMap: newMap } : state;
    }),

  setFilter: (shiftFilter) => set({ shiftFilter }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

// ── Derived Selectors ──────────────────────────────────────

/** Convert the map back to array (use sparingly in render) */
export function selectAllJobs(state: MonitoringState): MonitoringJob[] {
  return Object.values(state.jobsMap);
}

/** Filter jobs by current shift filter */
export function selectFilteredJobs(state: MonitoringState): MonitoringJob[] {
  const jobs = Object.values(state.jobsMap);
  if (state.shiftFilter === "ALL") return jobs;
  return jobs.filter((j) => j.shiftType === state.shiftFilter);
}

/** Group jobs by mechanic name (for UI grouping) */
export function selectJobsByMechanic(
  jobs: MonitoringJob[]
): Map<string, MonitoringJob[]> {
  const grouped = new Map<string, MonitoringJob[]>();
  for (const job of jobs) {
    const key = job.mechanicName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(job);
  }
  return grouped;
}

/** Compute summary counts from a job list */
export function selectSummary(jobs: MonitoringJob[]) {
  const total = jobs.length;
  const byStatus = (s: MonitoringJobStatus) =>
    jobs.filter((j) => j.status === s).length;
  return {
    total,
    toDo: byStatus("TO_DO"),
    inProgress: byStatus("IN_PROGRESS"),
    done: byStatus("DONE"),
    urgent: jobs.filter((j) => j.isUrgent).length,
  };
}

/** O(1) select a single job by ID */
export function selectJobById(state: MonitoringState, jobId: string): MonitoringJob | undefined {
  return state.jobsMap[jobId];
}
