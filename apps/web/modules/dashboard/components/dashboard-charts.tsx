"use client";

import type {
  DashboardCountdownOverdueItem,
  DashboardDeliveryRiskSummary,
  DashboardDivisionKpiItem,
  DashboardManhourDivisionItem,
  DashboardQcTrendPoint,
  DashboardUnitProgressItem,
  DashboardUrgentIssueItem,
} from "@smsystem/contracts/dashboard";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Design Tokens - Modern Slate & Vibrant Highlights                 */
/* ------------------------------------------------------------------ */

const C = {
  green:   "#10b981", // Emerald
  blue:    "#3b82f6", // Electric Blue
  amber:   "#f59e0b", // Amber
  orange:  "#f97316", // Orange
  red:     "#ef4444", // Crimson Red
  gray:    "#4b5563", // Slate Gray
  grid:    "rgba(255, 255, 255, 0.05)",
  tick:    "rgba(255, 255, 255, 0.35)",
};

const AXIS = { fontSize: 10, fill: C.tick } as const;

const TT: React.CSSProperties = {
  backgroundColor: "#0d0d0d",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 8,
  fontSize: 11,
  color: "#fff",
  padding: "6px 10px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
};

/* ------------------------------------------------------------------ */
/*  Shared Legend Component                                             */
/* ------------------------------------------------------------------ */

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-[10px] text-white/45">
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{
              background: item.dashed ? "transparent" : item.color,
              border: item.dashed ? `1.5px dashed ${item.color}` : "none",
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  1. Progress Pekerjaan Per Divisi                                   */
/* ------------------------------------------------------------------ */

export function DivisionProgressChart({ rows }: { rows: DashboardUnitProgressItem[] }) {
  if (rows.length === 0) return null;

  const data = rows.map((r) => {
    const total = r.plannedPanels || 1;
    const done = r.completedPanels;
    const remaining = Math.max(0, total - done);
    const qcr = Math.round(remaining * 0.15);
    const proses = Math.round(remaining * 0.50);
    const plan = remaining - qcr - proses;
    return { name: r.divisionName, Done: done, "QC Ready": qcr, Proses: proses, Plan: plan };
  });

  return (
    <div>
      <Legend items={[
        { label: "Done",     color: C.green },
        { label: "QC Ready", color: C.blue  },
        { label: "Proses",   color: C.amber },
        { label: "Plan",     color: C.gray  },
      ]} />
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
          <Bar dataKey="Done"     stackId="s" fill={C.green} />
          <Bar dataKey="QC Ready" stackId="s" fill={C.blue}  />
          <Bar dataKey="Proses"   stackId="s" fill={C.amber} />
          <Bar dataKey="Plan"     stackId="s" fill={C.gray}  radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Delivery Risk Donut                                              */
/* ------------------------------------------------------------------ */

const RISK_KEYS: { key: keyof DashboardDeliveryRiskSummary; label: string; color: string }[] = [
  { key: "green",  label: "Aman",            color: C.green  },
  { key: "yellow", label: "Perlu Dijaga",    color: C.amber  },
  { key: "orange", label: "Sangat Rapat",    color: C.orange },
  { key: "red",    label: "Melewati Target", color: C.red    },
  { key: "black",  label: "Belum Ada Data",  color: C.gray   },
];

export function DeliveryRiskDonut({ summary }: { summary: DashboardDeliveryRiskSummary }) {
  const data = RISK_KEYS.map((d) => ({ name: d.label, value: summary[d.key], color: d.color }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <Legend items={RISK_KEYS.map((d) => ({ label: d.label, color: d.color }))} />
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
               paddingAngle={2} dataKey="value" stroke="none">
            {data.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie>
          <Tooltip contentStyle={TT} formatter={(v) => [`${v} unit`, ""]} />
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 18, fontWeight: 600, fill: "#fff" }}>{total}</text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 9, fill: C.tick }}>Total Unit</text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. QC Pass/Fail Trend                                              */
/* ------------------------------------------------------------------ */

export function QcTrendAreaChart({ rows }: { rows: DashboardQcTrendPoint[] }) {
  if (rows.length === 0) return null;

  const data = rows.map((r) => {
    const label = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" })
      .format(new Date(`${r.date}T00:00:00.000Z`));
    return { name: label, Lolos: r.passCount, Revisi: r.rejectCount };
  });

  return (
    <div>
      <Legend items={[
        { label: "Lolos",  color: C.green },
        { label: "Revisi", color: C.red },
      ]} />
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
          <Bar dataKey="Lolos"  stackId="qc" fill={C.green} />
          <Bar dataKey="Revisi" stackId="qc" fill={C.red} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Manhour Utilisasi                                                */
/* ------------------------------------------------------------------ */

export function ManhourUtilizationBars({ rows }: { rows: DashboardManhourDivisionItem[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((r) => {
        const pct   = Math.min(100, Math.round(r.utilizationPercent ?? 0));
        const color = pct >= 90 ? C.red : pct >= 75 ? C.amber : C.green;
        return (
          <div key={r.divisionId} className="flex items-center gap-2 text-[11px]">
            <span className="w-[80px] shrink-0 truncate text-white/50">{r.divisionName}</span>
            <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="w-8 text-right text-white/50 font-medium">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function ManhourBarChart({ rows }: { rows: DashboardManhourDivisionItem[] }) {
  if (rows.length === 0) return null;

  const data = rows.slice(0, 6).map((r) => ({
    name:      r.divisionName,
    Aktual:    Math.round(r.actualHours),
    Kapasitas: Math.round(r.capacityHours),
  }));

  return (
    <div className="mt-3">
      <Legend items={[
        { label: "Jam Aktual",  color: C.blue  },
        { label: "Kapasitas",   color: C.gray  },
      ]} />
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT} />
          <Bar dataKey="Aktual"    fill={C.blue} radius={[2, 2, 0, 0]} />
          <Bar dataKey="Kapasitas" fill="rgba(107,114,128,0.25)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ManhourEmployeeList({
  rows,
}: {
  rows: { employeeId: string; employeeName: string; divisionName: string | null; actualHours: number }[];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="max-h-[140px] space-y-1 overflow-y-auto pr-1">
        {rows.slice(0, 6).map((r) => (
          <div
            key={r.employeeId}
            className="flex items-center justify-between gap-2 rounded-md border border-white/[0.03] bg-white/[0.01] px-2 py-1 transition-colors hover:bg-white/[0.03]"
          >
            <div className="truncate">
              <p className="truncate text-[11px] text-white/80 font-medium">{r.employeeName}</p>
              <p className="text-[9px] text-white/30">{r.divisionName ?? "—"}</p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-white/95 bg-white/[0.04] px-1.5 py-0.5 rounded">
              {r.actualHours}j
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Panel Progress Per Unit (Stacked)                              */
/* ------------------------------------------------------------------ */

export function PanelProgressChart({
  rows,
}: {
  rows: { unitName: string; remainingHours: number; effectiveDailyCapacity: number }[];
}) {
  if (rows.length === 0) return null;

  const data = rows.slice(0, 5).map((r) => {
    const total = r.remainingHours + r.effectiveDailyCapacity * 5;
    const done  = Math.max(0, total - r.remainingHours);
    return {
      name:  r.unitName.substring(0, 16),
      Selesai: Math.round(done),
      Sisa:    Math.round(r.remainingHours),
    };
  });

  return (
    <div>
      <Legend items={[
        { label: "Jam Selesai", color: C.blue },
        { label: "Jam Sisa",    color: C.gray },
      ]} />
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} layout="vertical" barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}j`} />
          <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={80} />
          <Tooltip contentStyle={TT} formatter={(v) => [`${v} jam`, ""]} />
          <Bar dataKey="Selesai" stackId="p" fill={C.blue} />
          <Bar dataKey="Sisa"    stackId="p" fill="rgba(107,114,128,0.25)" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Countdown Overdue                                                */
/* ------------------------------------------------------------------ */

export function CountdownOverdueChart({ rows }: { rows: DashboardCountdownOverdueItem[] }) {
  if (rows.length === 0) return null;

  const data = rows.slice(0, 5).map((r) => ({
    name:  r.unitName.substring(0, 14),
    panel: r.panelName,
    Hari:  r.overdueDays,
    fill:  r.overdueDays >= 10 ? C.red : C.amber,
  }));

  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} layout="vertical" barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}d`} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={80} />
        <Tooltip contentStyle={TT} formatter={(v) => [`${v} hari lewat`, ""]} />
        <Bar dataKey="Hari" radius={[0, 2, 2, 0]}>
          {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  7. Issue Severity                                                   */
/* ------------------------------------------------------------------ */

export function IssueSeverityChart({ rows }: { rows: DashboardUrgentIssueItem[] }) {
  if (rows.length === 0) return null;

  const divMap: Record<string, { HIGH: number; MEDIUM: number; LOW: number }> = {};
  for (const r of rows) {
    const div = r.divisionName ?? "Lainnya";
    if (!divMap[div]) divMap[div] = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    divMap[div][r.severity]++;
  }

  const data = Object.entries(divMap).slice(0, 5).map(([name, v]) => ({ name: name.substring(0, 12), ...v }));
  if (data.length === 0) return null;

  return (
    <div>
      <Legend items={[
        { label: "HIGH",   color: C.red   },
        { label: "MEDIUM", color: C.amber },
        { label: "LOW",    color: C.gray  },
      ]} />
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TT} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
          <Bar dataKey="HIGH"   stackId="i" fill={C.red}   />
          <Bar dataKey="MEDIUM" stackId="i" fill={C.amber} />
          <Bar dataKey="LOW"    stackId="i" fill={C.gray}  radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  8. Division KPI Progress                                           */
/* ------------------------------------------------------------------ */

export function DivisionKpiProgressBars({ rows }: { rows: DashboardDivisionKpiItem[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.slice(0, 4).map((r) => {
        const pct   = Math.round(r.avgProgressPercent);
        const color = pct >= 70 ? C.green : pct >= 50 ? C.amber : C.red;
        return (
          <div key={r.divisionId} className="text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-[80px] shrink-0 truncate text-white/55">{r.divisionName}</span>
              <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
              </div>
              <span className="w-8 text-right text-white/55 font-medium">{pct}%</span>
            </div>
            <p className="ml-[88px] text-[9px] text-white/30">{r.activeUnits} unit aktif</p>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  9. Timeline Unit Aktif                                              */
/* ------------------------------------------------------------------ */

export function UnitTimelineList({
  rows,
  asOfDate,
}: {
  rows: { unitName: string; remainingHours: number; effectiveDailyCapacity: number; targetDeliveryDate: string | null }[];
  asOfDate?: string;
}) {
  if (rows.length === 0) return null;

  const activeDate = asOfDate ? new Date(asOfDate) : new Date();
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();

  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(activeDate);

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { dayNumber: number | null; dateString: string | null }[] = [];
  for (let i = 0; i < startDayIndex; i++) {
    days.push({ dayNumber: null, dateString: null });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ dayNumber: d, dateString: dStr });
  }

  const scheduled = rows.filter((r) => r.targetDeliveryDate !== null);
  const unscheduled = rows.filter((r) => r.targetDeliveryDate === null);

  const unitsByDate: Record<string, typeof rows> = {};
  for (const r of scheduled) {
    if (r.targetDeliveryDate) {
      const dateKey = r.targetDeliveryDate.split("T")[0];
      if (!unitsByDate[dateKey]) unitsByDate[dateKey] = [];
      unitsByDate[dateKey].push(r);
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/90">{monthLabel}</span>
          <span className="text-[9px] text-white/45">Kalender Pengiriman</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-medium text-white/30 uppercase tracking-wider mb-1">
          <span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((item, idx) => {
            if (item.dayNumber === null) {
              return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />;
            }

            const isToday = item.dateString === todayStr;
            const dayUnits = unitsByDate[item.dateString || ""] || [];
            const hasUnits = dayUnits.length > 0;

            return (
              <div
                key={`day-${item.dayNumber}`}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-[4px] border transition-all text-[10px] ${
                  isToday
                    ? "border-blue-500/50 bg-blue-500/10 text-white font-bold"
                    : hasUnits
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold hover:bg-emerald-500/20 cursor-pointer"
                    : "border-white/[0.03] bg-white/[0.01] text-white/50 hover:bg-white/[0.04]"
                }`}
                title={hasUnits ? dayUnits.map((u) => u.unitName).join(", ") : undefined}
              >
                <span>{item.dayNumber}</span>
                {hasUnits && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col justify-between space-y-3">
        {scheduled.length > 0 ? (
          <div>
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1.5">Terjadwal Bulan Ini</h4>
            <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
              {scheduled.slice(0, 4).map((r, i) => {
                const fmtDate = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" })
                  .format(new Date(`${r.targetDeliveryDate}T00:00:00.000Z`));
                return (
                  <div key={i} className="flex items-center justify-between rounded bg-emerald-500/5 border border-emerald-500/10 px-2 py-1 text-[11px]">
                    <span className="truncate text-white/80 font-medium">{r.unitName}</span>
                    <span className="text-[9px] text-emerald-400 font-semibold">{fmtDate}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <h4 className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-1.5">Belum Terjadwal (Draft)</h4>
          {unscheduled.length > 0 ? (
            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
              {unscheduled.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white/[0.02] border border-white/[0.04] px-2 py-1 text-[11px]">
                  <span className="truncate text-white/70">{r.unitName}</span>
                  <span className="shrink-0 text-[9px] text-white/45 bg-white/[0.04] px-1 rounded">
                    Sisa {Math.round(r.remainingHours)}j
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-white/30 italic">Semua unit aktif sudah memiliki tanggal target.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  10. Jam Kerja Unit Terpilih                                        */
/* ------------------------------------------------------------------ */

export function UnitWorkHoursBarChart({
  rows,
}: {
  rows: Array<{ carId: string; unitName: string; actualHours: number }>;
}) {
  if (!rows || rows.length === 0) return null;

  const data = rows.slice(0, 5).map((r) => ({
    name: r.unitName.substring(0, 14),
    Jam: r.actualHours,
  }));

  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} layout="vertical" barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}j`} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={80} />
        <Tooltip contentStyle={TT} formatter={(v) => [`${v} jam`, ""]} />
        <Bar dataKey="Jam" fill={C.blue} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  11. Sisa Jam Kerja Per Unit                                       */
/* ------------------------------------------------------------------ */

export function UnitRemainingHoursChart({
  rows,
}: {
  rows: Array<{ carId: string; unitName: string; remainingHours: number }>;
}) {
  if (!rows || rows.length === 0) return null;

  const data = rows.slice(0, 5).map((r) => ({
    name: r.unitName.substring(0, 14),
    Sisa: r.remainingHours,
  }));

  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} layout="vertical" barCategoryGap="24%">
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}j`} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={80} />
        <Tooltip contentStyle={TT} formatter={(v) => [`${v} jam`, ""]} />
        <Bar dataKey="Sisa" fill={C.red} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
