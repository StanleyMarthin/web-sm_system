import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchUnitBoard,
  fetchUnitBom,
  fetchUnitWorkspace,
} from "@/shared/api/units";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("units api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses unit board payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              unitId: "MB500SEL_MRSILMY",
              unitName: "MB 500 SEL",
              customerName: "Mr. SILMY",
              kpName: "IQBAL",
              advisorName: "-",
              targetDeliveryDate: "2026-05-30",
              etaDate: "2026-05-28",
              riskLevel: "YELLOW",
              progressPercent: 55,
              remainingHours: 124.5,
              woOpenCount: 2,
              prOpenCount: 0,
              qcIssueOpenCount: 1,
              issueOpenCount: 0,
              status: "In_Progress",
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "targetDeliveryDate",
            sortDirection: "asc",
            view: null,
            filters: [],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchUnitBoard("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.unitId).toBe("MB500SEL_MRSILMY");
  });

  it("parses unit workspace payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            unitId: "MB500SEL_MRSILMY",
            countdownSummary: {
              total: 10,
              plan: 3,
              proses: 5,
              qcReady: 1,
              done: 1,
              remainingHours: 124.5,
              progressPercent: 55,
            },
            woSummary: {
              submitted: 0,
              approved: 2,
              rejected: 0,
              open: 2,
            },
            issueSummary: {
              open: 0,
              resolved: 0,
              highSeverityOpen: 0,
            },
            deliveryRisk: {
              level: "YELLOW",
              reason: "ETA mendekati target delivery.",
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchUnitWorkspace("session=abc", "MB500SEL_MRSILMY");
    expect(result.status).toBe(200);
    expect(result.payload?.data.deliveryRisk.level).toBe("YELLOW");
  });

  it("parses unit bom payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            unitId: "MB500SEL_MRSILMY",
            summary: {
              totalParts: 2,
              installedParts: 1,
              inDivisionParts: 0,
              disassembledParts: 1,
            },
            tree: [
              {
                nodeId: "category-1",
                nodeType: "CATEGORY",
                label: "Interior",
                category: "Interior",
                section: null,
                panelId: null,
                physicalStatus: null,
                divisionId: null,
                divisionName: null,
                progressPercent: 50,
                remainingHours: 2,
                actualId: null,
                logisticStatus: null,
                logisticReference: null,
                logisticPath: null,
                children: [
                  {
                    nodeId: "section-1",
                    nodeType: "SECTION",
                    label: "ASBAK COIN",
                    category: "Interior",
                    section: "ASBAK COIN",
                    panelId: null,
                    physicalStatus: null,
                    divisionId: null,
                    divisionName: null,
                    progressPercent: 50,
                    remainingHours: 2,
                    actualId: null,
                    logisticStatus: null,
                    logisticReference: null,
                    logisticPath: null,
                    children: [
                      {
                        nodeId: "part-1",
                        nodeType: "PART",
                        label: "ASBAK COIN",
                        category: "Interior",
                        section: "ASBAK COIN",
                        panelId: 459,
                        physicalStatus: "DISASSEMBLED",
                        divisionId: null,
                        divisionName: null,
                        progressPercent: 0,
                        remainingHours: 2,
                        actualId: null,
                        logisticStatus: "READY_GUDANG",
                        logisticReference: "Ready Gudang",
                        logisticPath: "/warehouse?section=stock-card&tab=stock-card&search=ASBAK%20COIN",
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchUnitBom("session=abc", "MB500SEL_MRSILMY");
    expect(result.status).toBe(200);
    expect(result.payload?.data.tree[0]?.children[0]?.children[0]?.logisticStatus).toBe("READY_GUDANG");
  });
});
