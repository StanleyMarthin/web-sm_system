"use client";

/**
 * Step indicator untuk Planning Work Control wizard.
 * Menampilkan 5 langkah dengan status aktif / selesai.
 */

import { CheckCircle2 } from "lucide-react";

const STEPS = [
  { number: 1, label: "Pilih Unit" },
  { number: 2, label: "Progress" },
  { number: 3, label: "Kapasitas" },
  { number: 4, label: "Target" },
  { number: 5, label: "Rilis" },
] as const;

interface PlanningStepHeaderProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  onStepClick?: (step: 1 | 2 | 3 | 4 | 5) => void;
  /** Langkah tertinggi yang pernah dicapai (untuk enable klik navigasi mundur) */
  maxReachedStep?: number;
}

export function PlanningStepHeader({
  currentStep,
  onStepClick,
  maxReachedStep,
}: PlanningStepHeaderProps) {
  const maxReached = maxReachedStep ?? currentStep;

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((step) => {
        const active = currentStep === step.number;
        const done = currentStep > step.number;
        const reachable = step.number <= maxReached;

        return (
          <button
            key={step.number}
            type="button"
            disabled={!reachable || !onStepClick}
            onClick={() => onStepClick?.(step.number as 1 | 2 | 3 | 4 | 5)}
            className={[
              "flex items-center justify-between gap-2 border px-3 py-3 text-left transition-colors",
              active
                ? "border-amber-500/30 bg-amber-500/[0.08]"
                : done
                  ? "border-emerald-500/25 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]"
                  : reachable && onStepClick
                    ? "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/[0.06] dark:bg-[#111114] dark:hover:bg-white/[0.03]"
                    : "border-gray-200 bg-gray-50 opacity-40 cursor-not-allowed dark:border-white/[0.06] dark:bg-[#111114]",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/25">
                Langkah {step.number}
              </p>
              <p
                className={[
                  "mt-0.5 truncate text-[11px] font-medium",
                  active
                    ? "text-amber-700 dark:text-amber-300"
                    : done
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-gray-600 dark:text-white/50",
                ].join(" ")}
              >
                {step.label}
              </p>
            </div>
            <div
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[10px] font-semibold",
                active
                  ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : done
                    ? "border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-300 text-gray-400 dark:border-white/[0.08] dark:text-white/25",
              ].join(" ")}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.number}
            </div>
          </button>
        );
      })}
    </div>
  );
}
