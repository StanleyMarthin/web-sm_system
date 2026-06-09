"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ClipboardList, Wrench } from "lucide-react";
import type { ServiceTemplate } from "@/modules/planning/types/planning.types";
import { buildServiceIntake } from "@/modules/planning/helpers/operational-planning";
import {
  createServiceIntake,
  fetchServiceTemplates,
} from "@/shared/api/work-control";
import type { DivisionCapacityData } from "./division-capacity-step";
import type { UnitPriorityItem } from "./unit-priority-step";

interface ServiceIntakePageProps {
  units: UnitPriorityItem[];
  divisions: DivisionCapacityData[];
  weekStartDate: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function statusLabel(status: string): string {
  if (status === "SPK_READY") return "Aman";
  if (status === "SPK_WITH_SPL") return "Butuh Lembur";
  return "Pilih Jadwal Ulang";
}

function ServiceTemplateSelector({
  templates,
  selectedIds,
  onChange,
}: {
  templates: ServiceTemplate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {templates.map((template) => {
        const selected = selectedIds.includes(template.id);
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => {
              onChange(selected ? selectedIds.filter((id) => id !== template.id) : [...selectedIds, template.id]);
            }}
            className={[
              "border px-4 py-3 text-left transition-colors",
              selected
                ? "border-amber-500/35 bg-amber-500/[0.08]"
                : "border-white/5 bg-[#0a0a0c] hover:border-white/15",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[12px] text-white/80">{template.name}</p>
                <p className="mt-2 text-[11px] leading-5 text-white/40">
                  {template.estimatedHours} jam · Divisi {template.divisionId}
                </p>
              </div>
              {selected ? <Check className="h-4 w-4 text-amber-400" /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ServiceIntakePage({ units, divisions, weekStartDate }: ServiceIntakePageProps) {
  const [step, setStep] = useState(1);
  const [unitId, setUnitId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchServiceTemplates()
      .then((response) => {
        if (cancelled) return;
        setTemplates(response.data);
        setTemplateError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateError("Template service belum bisa dimuat dari Redis.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplates = templates.filter((template) => templateIds.includes(template.id));
  const availableHours = useMemo(() => {
    const divisionIds = new Set(selectedTemplates.map((template) => template.divisionId));
    if (divisionIds.size === 0) return 0;
    return divisions
      .filter((division) => divisionIds.has(String(division.divisionId)))
      .reduce((sum, division) => sum + division.availableCapacityHours, 0);
  }, [divisions, selectedTemplates]);

  const intake = buildServiceIntake({
    unitId,
    diagnosis,
    templateIds,
    templates,
    availableHours,
    startDate: new Date(`${weekStartDate}T00:00:00.000Z`),
  });

  function handleCreateDraft() {
    setReleaseMessage(null);
    startTransition(async () => {
      try {
        const response = await createServiceIntake({
          unitId,
          diagnosis,
          templateIds,
          totalEstimatedHours: intake.totalEstimatedHours,
          capacityStatus: intake.capacityStatus as "SPK_READY" | "SPK_WITH_SPL" | "TARGET_PERLU_DIREVISI",
          targetFinishDate: intake.targetFinishDate.toISOString().slice(0, 10),
        });
        setReleaseMessage(`Draft ${response.data.intakeId} tersimpan sementara di Redis.`);
      } catch {
        setReleaseMessage("Draft SPK Service belum berhasil disimpan.");
      }
    });
  }

  return (
    <section className="border border-white/5 bg-[#111114]">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Service Maintenance</p>
            <h3 className="mt-1 font-mono text-[14px] text-white">Quick intake ke SPK Service</h3>
          </div>
          <span className="border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
            Step {step} / 4
          </span>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4">
        {step === 1 ? (
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-[12px] text-white/55">
              Unit
              <select
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                className="h-8 border border-white/10 bg-[#0a0a0c] px-3 font-mono text-[12px] text-white outline-none focus:border-amber-500/40"
              >
                <option value="">Pilih unit</option>
                {units.map((unit) => (
                  <option key={unit.carId} value={unit.carId}>{unit.unitName}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-[12px] text-white/55">
              Keluhan / diagnosis awal
              <textarea
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                className="min-h-20 border border-white/10 bg-[#0a0a0c] px-3 py-2 text-[12px] text-white outline-none focus:border-amber-500/40"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3">
            {templateError ? (
              <div className="border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[12px] text-red-200">
                {templateError}
              </div>
            ) : null}
            <ServiceTemplateSelector templates={templates} selectedIds={templateIds} onChange={setTemplateIds} />
            {templates.length === 0 && !templateError ? (
              <div className="border border-white/5 bg-[#0a0a0c] px-4 py-6 text-[12px] text-white/35">
                Memuat template service...
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Estimasi Service</p>
              <p className="mt-1 font-mono text-[20px] text-white/80">{intake.totalEstimatedHours.toFixed(0)} jam</p>
            </div>
            <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Slot Divisi</p>
              <p className="mt-1 font-mono text-[20px] text-white/80">{availableHours.toFixed(0)} jam</p>
            </div>
            <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/25">Status</p>
              <p className={intake.capacityStatus === "SPK_READY" ? "mt-1 font-mono text-[20px] text-emerald-300" : "mt-1 font-mono text-[20px] text-amber-300"}>
                {statusLabel(intake.capacityStatus)}
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="border border-white/5 bg-[#0a0a0c] px-4 py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-400" />
                <p className="font-mono text-[13px] text-white">Rekomendasi SPK Service</p>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-white/50">
                {statusLabel(intake.capacityStatus)} · estimasi selesai {formatDate(intake.targetFinishDate)}.
              </p>
            </div>
            <button
              type="button"
              disabled={intake.capacityStatus === "TARGET_PERLU_DIREVISI" || isPending}
              onClick={handleCreateDraft}
              className="inline-flex h-9 items-center justify-center gap-2 border border-amber-500/30 bg-amber-500/[0.08] px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ClipboardList className="h-4 w-4" />
              {isPending ? "Menyimpan..." : "Siapkan Draft SPK"}
            </button>
            {releaseMessage ? (
              <p className="md:col-span-2 border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-200">
                {releaseMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="h-8 border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45 disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(4, current + 1))}
            disabled={(step === 1 && (!unitId || !diagnosis.trim())) || (step === 2 && templateIds.length === 0) || step === 4}
            className="h-8 border border-amber-500/30 bg-amber-500/[0.08] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
