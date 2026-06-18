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
                ? "border-primary/30 bg-primary/[0.08]"
                : done
                  ? "border-success/25 bg-success/[0.08] hover:bg-success/[0.12]"
                  : reachable && onStepClick
                    ? "border-border bg-card hover:bg-muted dark:border-border dark:bg-card dark:hover:bg-accent"
                    : "border-border bg-muted opacity-40 cursor-not-allowed dark:border-border dark:bg-card",
            ].join(" ")}
          >
            <div className="min-w-0">
              <p className="font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground dark:text-muted-foreground">
                Langkah {step.number}
              </p>
              <p
                className={[
                  "mt-0.5 truncate text-[15px] font-medium",
                  active
                    ? "text-app-accent-ink dark:text-app-accent-ink"
                    : done
                      ? "text-success dark:text-success"
                      : "text-muted-foreground dark:text-muted-foreground",
                ].join(" ")}
              >
                {step.label}
              </p>
            </div>
            <div
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[14px] font-semibold",
                active
                  ? "border-primary/30 text-app-accent-ink dark:text-app-accent-ink"
                  : done
                    ? "border-success/25 text-success dark:text-success"
                    : "border-border text-muted-foreground dark:border-border dark:text-muted-foreground",
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
