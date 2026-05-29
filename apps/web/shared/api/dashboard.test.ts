import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchDashboardSummary,
} from "@/shared/api/dashboard";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("dashboard api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses dashboard summary payload", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            generatedAt: "2026-05-18T10:00:00.000Z",
            asOfDate: "2026-05-18",
            headline: {
              title: "Ringkasan kerja hari ini",
              subtitle: "Prioritas utama sudah dirangkum untuk Anda.",
              scopeNote: "Anda sedang melihat semua unit aktif.",
              highlights: ["1 unit perlu diselesaikan lebih dulu."],
            },
            kpis: {
              activeUnits: 8,
              deliveryThisWeek: 3,
              overdueUnits: 1,
              urgentIssues: 2,
            },
            deliveryRisk: {
              summary: {
                green: 3,
                yellow: 2,
                orange: 2,
                red: 1,
                black: 0,
              },
              topUnits: [],
            },
            unitProgress: [],
            qcTrend: [],
            urgentIssues: [],
            countdownOverdue: [],
            manhour: null,
            divisionKpis: [],
            pendingActions: {
              woApproval: 1,
              prApproval: 1,
              vendorApproval: 0,
              warehouseApproval: null,
              total: 2,
            },
            monitoringFlags: {
              noStart: 1,
              noSubmit: 0,
              delayRisk: 1,
              overtimeCount: 0,
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchDashboardSummary("session=abc");
    expect(result.status).toBe(200);
    expect(result.payload?.data.kpis.activeUnits).toBe(8);
    expect(result.payload?.data.headline.title).toBe("Ringkasan kerja hari ini");
  });
});
