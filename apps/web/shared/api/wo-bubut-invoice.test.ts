import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchBubutInvoiceWorkHistory } from "@/shared/api/bubut-invoice";

const originalFetch = global.fetch;

describe("wo bubut invoice api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  it("parses work-history response", async () => {
    global.fetch = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/wo-bubut-invoice/WO-1/work-history");
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: {
            sourceKey: "WO-1",
            header: {
              woId: "WO-1",
              wobNo: "WO/001/05/2026",
              woDate: "2026-05-22",
              teamName: "TETEN",
              carId: "CAR-1",
              carName: "MB 500 SEL",
              divisionName: "BUBUT",
              operatorName: "SUMARYATNO",
              sparepartName: "BUBUT DISCBRAKE",
              qtyLabel: "2 pcs",
              jobdesc: "Bubut discbrake",
              invoiceStatus: "NO_INVOICE",
              direksiInvoiceId: null,
              customerInvoiceId: null,
            },
            workRows: [
              {
                id: "CD-1",
                workDate: "2026-05-22",
                startTime: "08:00",
                breakTime: "01:30",
                finishTime: "15:00",
                workingHourText: "05:30",
                workingHourDecimal: 5.5,
                resultStatus: "DONE",
                operatorName: "SUMARYATNO",
                panelPartName: "BUBUT DISCBRAKE",
                jobdesc: "Bubut discbrake",
                processDetail: "Finishing",
                documentationUrls: [],
                powerWatt: 7500,
                powerCostKwh: 1444,
                workingHourCost: 119130,
              },
            ],
            materialRows: [],
            totals: {
              totalWorkingHourText: "05:30",
              totalWorkingHourDecimal: 5.5,
              totalWorkingHourCost: 119130,
              totalMaterial: 0,
              totalBasePrice: 119130,
              customerUpTotal: 399086,
              customerRoundedTotal: 400000,
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchBubutInvoiceWorkHistory("WO-1");
    expect(result.header.wobNo).toBe("WO/001/05/2026");
    expect(result.materialRows).toEqual([]);
    expect(result.workRows[0]?.documentationUrls).toEqual([]);
  });

  it("throws on failed work-history response", async () => {
    global.fetch = mock(async () => new Response("not found", { status: 404 })) as typeof fetch;

    let errorMessage = "";
    try {
      await fetchBubutInvoiceWorkHistory("INVALID");
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toBe("WORK_HISTORY_FAILED");
  });
});
