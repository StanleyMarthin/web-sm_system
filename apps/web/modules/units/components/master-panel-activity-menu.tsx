"use client";

import type { UnitPanelActivityType, UnitPanelDetail } from "@smsystem/contracts/unit-panel";
import { Clock3, FileText, ShoppingCart, Truck } from "lucide-react";

const ICON_STROKE_WIDTH = 2.4;

type MasterPanelActivityChoice = Extract<UnitPanelActivityType, "COUNTDOWN" | "PR" | "WO" | "WOV">;

interface MasterPanelActivityMenuProps {
  detail: UnitPanelDetail;
  canCreateCountdown: boolean;
  canCreateWo: boolean;
  canCreatePr: boolean;
  canCreateVendor: boolean;
  onSelect: (type: MasterPanelActivityChoice) => void;
}

const CHOICES: Array<{
  type: MasterPanelActivityChoice;
  label: string;
  helper: string;
  icon: typeof Clock3;
}> = [
  { type: "COUNTDOWN", label: "Countdown", helper: "Rencana kerja awal dari part ini", icon: Clock3 },
  { type: "WO", label: "Work Order", helper: "Request pekerjaan langsung dari Master Panel", icon: FileText },
  { type: "PR", label: "Purchase Request", helper: "Pengadaan yang terikat Master Panel", icon: ShoppingCart },
  { type: "WOV", label: "Vendor WO", helper: "Pekerjaan vendor dari Countdown atau PR", icon: Truck },
];

function countType(detail: UnitPanelDetail, type: MasterPanelActivityChoice): number {
  return detail.activities.filter((activity) => activity.type === type).length;
}

export function MasterPanelActivityMenu({
  detail,
  canCreateCountdown,
  canCreateWo,
  canCreatePr,
  canCreateVendor,
  onSelect,
}: MasterPanelActivityMenuProps) {
  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Pilih Aktivitas</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Pilih satu modul. Master Panel hanya menampilkan grid modul yang dipilih.</p>
      </div>
      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
        {CHOICES.map((choice) => {
          const Icon = choice.icon;
          const count = countType(detail, choice.type);
          const disabled =
            (choice.type === "COUNTDOWN" && !canCreateCountdown) ||
            (choice.type === "WO" && !canCreateWo) ||
            (choice.type === "PR" && !canCreatePr) ||
            (choice.type === "WOV" && !canCreateVendor);
          return (
            <button
              key={choice.type}
              type="button"
              onClick={() => onSelect(choice.type)}
              className="flex min-h-24 items-start gap-3 border border-border bg-background px-3 py-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className="mt-0.5 h-4 w-4 text-app-accent-ink" strokeWidth={ICON_STROKE_WIDTH} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{choice.label}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{count}</span>
                </span>
                <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">{disabled ? "Tidak ada akses create, data tetap bisa dilihat." : choice.helper}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
