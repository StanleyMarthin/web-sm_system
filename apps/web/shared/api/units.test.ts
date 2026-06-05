import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  createUnitPanel,
  deleteUnitPanel,
  fetchUnitBoard,
  fetchUnitBom,
  fetchUnitPanels,
  updateUnitPanel,
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

  it("parses unit panel collection payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            unitId: "MB500SEL_MRSILMY",
            tree: [
              {
                id: 1,
                carId: "MB500SEL_MRSILMY",
                parentId: null,
                nodeType: "PANEL",
                section: "Interior",
                name: "Dashboard",
                category: "Interior",
                isActive: true,
                sortOrder: 1,
                qty: 1,
                defaultLocationType: "UNIT",
                defaultStockStatus: "INSTALLED",
                defaultConditionType: "BEKAS",
                countdownUsageCount: 0,
                statusUsageCount: 0,
                childCount: 1,
                createdAt: "2026-05-30 10:00:00",
                updatedAt: "2026-05-30 10:00:00",
                children: [
                  {
                    id: 2,
                    carId: "MB500SEL_MRSILMY",
                    parentId: 1,
                    nodeType: "PART",
                    section: "Interior",
                    name: "Panel Speedometer",
                    category: "Interior",
                    isActive: true,
                    sortOrder: 1,
                    qty: 1,
                    defaultLocationType: "UNIT",
                    defaultStockStatus: "INSTALLED",
                    defaultConditionType: "BEKAS",
                    countdownUsageCount: 0,
                    statusUsageCount: 0,
                    childCount: 0,
                    createdAt: "2026-05-30 10:00:00",
                    updatedAt: "2026-05-30 10:00:00",
                    children: [],
                  },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchUnitPanels("session=abc", "MB500SEL_MRSILMY");
    expect(result.status).toBe(200);
    expect(result.payload?.data.tree[0]?.children[0]?.nodeType).toBe("PART");
  });

  it("creates unit panel on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "created",
          data: {
            record: {
              id: 10,
              carId: "MB500SEL_MRSILMY",
              parentId: null,
              nodeType: "PANEL",
              section: "Interior",
              name: "Console Tengah",
              category: "Interior",
              isActive: true,
              sortOrder: 2,
              qty: 1,
              defaultLocationType: "UNIT",
              defaultStockStatus: "INSTALLED",
              defaultConditionType: "BEKAS",
              countdownUsageCount: 0,
              statusUsageCount: 0,
              childCount: 0,
              createdAt: "2026-05-30 10:00:00",
              updatedAt: "2026-05-30 10:00:00",
              children: [],
            },
          },
        }),
        { status: 201 },
      );
    }) as typeof fetch;

    const result = await createUnitPanel("MB500SEL_MRSILMY", {
      parentId: null,
      section: "Interior",
      name: "Console Tengah",
      category: "Interior",
      sortOrder: 2,
      qty: 1,
      defaultLocationType: "UNIT",
      defaultStockStatus: "INSTALLED",
      defaultConditionType: "BEKAS",
      isActive: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.id).toBe(10);
    }
  });

  it("updates unit panel on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "updated",
          data: {
            record: {
              id: 10,
              carId: "MB500SEL_MRSILMY",
              parentId: null,
              nodeType: "PANEL",
              section: "Interior",
              name: "Console Tengah Revisi",
              category: "Interior",
              isActive: true,
              sortOrder: 3,
              qty: 1,
              defaultLocationType: "UNIT",
              defaultStockStatus: "INSTALLED",
              defaultConditionType: "BEKAS",
              countdownUsageCount: 0,
              statusUsageCount: 0,
              childCount: 0,
              createdAt: "2026-05-30 10:00:00",
              updatedAt: "2026-05-30 10:05:00",
              children: [],
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await updateUnitPanel("MB500SEL_MRSILMY", 10, {
      section: "Interior",
      name: "Console Tengah Revisi",
      category: "Interior",
      sortOrder: 3,
      qty: 1,
      defaultLocationType: "UNIT",
      defaultStockStatus: "INSTALLED",
      defaultConditionType: "BEKAS",
      isActive: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.sortOrder).toBe(3);
    }
  });

  it("deletes unit panel on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "deleted",
          data: {
            deletedId: 10,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await deleteUnitPanel("MB500SEL_MRSILMY", 10);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.result.deletedId).toBe(10);
    }
  });
});
