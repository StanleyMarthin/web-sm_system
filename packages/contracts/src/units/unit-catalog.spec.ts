import { describe, expect, it } from "bun:test";
import {
  createPanelJobdescsRequestSchema,
  catalogWorkspaceItemSchema,
  openCatalogPanelRequestSchema,
  parseCatalogSpreadsheetText,
  saveCatalogPanelsRequestSchema,
  saveCatalogWorkspaceRequestSchema,
  updateCatalogSurveyRequestSchema,
} from "./unit-catalog";

describe("unit catalog contracts", () => {
  it("allows partial unit catalog item data", () => {
    const payload = saveCatalogWorkspaceRequestSchema.parse({
      items: [
        {
          id: null,
          code: null,
          partNumber: "PN-128",
          itemName: null,
          position: null,
          qtyNormal: null,
        },
      ],
    });

    expect(payload.items[0]).toMatchObject({
      code: null,
      partNumber: "PN-128",
      itemName: null,
      position: null,
      qtyNormal: null,
      isRestoration: false,
    });
  });

  it("parses pasted spreadsheet catalog rows with nullable optional fields", () => {
    const rows = parseCatalogSpreadsheetText([
      "CODE\tPARTS NUMBER\tNAME\tPOSITION\tQTY NORMAL\tRESTORATION",
      "127\t\tOil Dipstick\tA1\t1\tYA",
      "128\tPN-128\t\t\t\t",
    ].join("\n"));

    expect(rows).toEqual([
      {
        code: "127",
        partNumber: null,
        itemName: "Oil Dipstick",
        position: "A1",
        qtyNormal: 1,
        isRestoration: true,
        id: null,
        clientRowId: null,
      },
      {
        code: "128",
        partNumber: "PN-128",
        itemName: null,
        position: null,
        qtyNormal: null,
        isRestoration: false,
        id: null,
        clientRowId: null,
      },
    ]);
  });

  it("accepts derived catalog workspace status fields", () => {
    const item = catalogWorkspaceItemSchema.parse({
      id: 9,
      promotedPanelId: 44,
      aliasName: "Door Handle LH",
      itemName: "Inside Door Handle",
      availabilityStatus: "AVAILABLE",
      conditionStatus: "RESTORE",
      surveyStatus: "MASTER_PANEL_CREATED",
    });

    expect(item.promotedPanelId).toBe(44);
    expect(item.aliasName).toBe("Door Handle LH");
    expect(item.availabilityStatus).toBe("AVAILABLE");
    expect(item.conditionStatus).toBe("RESTORE");
    expect(item.surveyStatus).toBe("MASTER_PANEL_CREATED");
  });

  it("maps old survey action into explicit restoration boolean", () => {
    const payload = updateCatalogSurveyRequestSchema.parse({
      actionType: "JOBDESC",
      actualName: "Seal baru",
    });

    expect(payload.actionType).toBe("JOBDESC");
    expect(payload.actualName).toBe("Seal baru");
  });

  it("opens panel workspace without legacy reference fields", () => {
    const payload = openCatalogPanelRequestSchema.parse({
      componentCode: "BODY",
      panelName: "FRONT DOOR LH",
    });

    expect(payload).toEqual({
      componentCode: "BODY",
      panelName: "FRONT DOOR LH",
    });
  });

  it("accepts catalog panel batch rows", () => {
    const payload = saveCatalogPanelsRequestSchema.parse({
      items: [
        { id: null, panelName: " Front Door LH " },
        { id: 5, panelName: "Rear Door RH" },
      ],
      deletedIds: [7],
    });

    expect(payload).toEqual({
      items: [
        { id: null, panelName: "Front Door LH" },
        { id: 5, panelName: "Rear Door RH" },
      ],
      deletedIds: [7],
    });
  });

  it("allows more than one jobdesc for the same master panel request", () => {
    const request = createPanelJobdescsRequestSchema.parse({
      jobs: [
        { divisionId: 1, jobTypeId: "MECH", description: "Bongkar", targetHoursInitial: 2 },
        { divisionId: 1, jobTypeId: "MECH", description: "Pasang", targetHoursInitial: 2 },
      ],
    });

    expect(request.jobs).toHaveLength(2);
  });
});
