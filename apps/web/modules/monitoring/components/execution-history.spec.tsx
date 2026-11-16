import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoringTaskRecord } from "@smsystem/contracts/monitoring";
import { ExecutionHistory, executionTime } from "./execution-history";

describe("execution history", () => {
  it("shows each pause window and the current start without charging the pause gap", () => {
    const html = renderToStaticMarkup(<ExecutionHistory row={{
      executionNote: "Lanjut besok",
      executionSegments: [
        { segment_id: "S1", started_at: "2026-10-30T08:00:00+07:00", finished_at: "2026-10-30T09:00:00+07:00", worked_minutes: 60, break_minutes: 0, close_reason: "HOLD" },
        { segment_id: "S2", started_at: "2026-10-30T10:30:00+07:00", finished_at: "2026-10-30T11:00:00+07:00", worked_minutes: 30, break_minutes: 0, close_reason: "FINISH" },
      ], activeSegmentStartedAt: "2026-10-31T08:00:00+07:00",
    } as MonitoringTaskRecord} />);
    expect(html.match(/<li /gu)).toHaveLength(3);
    expect(html).toContain("Dijeda");
    expect(html).toContain("Sesi ditutup");
    expect(html).toContain("60 menit");
    expect(html).toContain("30 menit");
    expect(html).toContain("10.30");
    expect(html).toContain("Lanjut besok");
    expect(executionTime("08:30:00")).toBe("08:30");
    expect(executionTime("invalidTvalue")).toBe("-");
  });
  it("shows an honest empty state for legacy records", () => {
    expect(renderToStaticMarkup(<ExecutionHistory row={{} as MonitoringTaskRecord} />)).toContain("Belum ada riwayat sesi kerja.");
  });
});
