import { describe, expect, it } from "bun:test";
import { unitPanelDetailSchema, updateUnitPanelRequestSchema } from "./unit-panel";

describe("unit panel contracts", () => {
  it("accepts editable master panel spreadsheet fields", () => {
    const payload = updateUnitPanelRequestSchema.parse({
      section: "FRONT BUMPER",
      name: "Bracket Foglamp Custom",
      category: "BODY",
      aliasName: "Bracket Foglamp",
      partNumber: "CUSTOM-01",
      initialCondition: "RESTORE",
      currentStatus: "WAITING",
      location: "UNIT",
      notes: "Temuan lapangan",
      qty: 2,
    });

    expect(payload).toMatchObject({
      section: "FRONT BUMPER",
      name: "Bracket Foglamp Custom",
      category: "BODY",
      aliasName: "Bracket Foglamp",
      partNumber: "CUSTOM-01",
      initialCondition: "RESTORE",
      currentStatus: "WAITING",
      location: "UNIT",
      notes: "Temuan lapangan",
      qty: 2,
    });
  });

  it("carries countdown form references in the master panel detail hub", () => {
    const detail = unitPanelDetailSchema.parse({
      unitId: "220S",
      panel: {
        id: 123,
        carId: "220S",
        componentId: null,
        catalogPanelId: null,
        code: null,
        aliasName: null,
        partNumber: "A 123",
        sourcePart: "CATALOG",
        initialCondition: "RESTORE",
        currentStatus: "WAITING",
        location: "UNIT",
        notes: null,
        totalJobdesc: 0,
        totalHours: 0,
        remainingHours: 0,
        sourceGeneralId: null,
        parentId: null,
        nodeType: "PART",
        section: "91 DRIVER SEAT 2",
        name: "Lock Bracket",
        category: "INTERIOR",
        isActive: true,
        sortOrder: 0,
        qty: 1,
        defaultLocationType: "UNIT",
        defaultStockStatus: "INSTALLED",
        defaultConditionType: "RESTORE",
        countdownUsageCount: 0,
        statusUsageCount: 0,
        childCount: 0,
        createdAt: null,
        updatedAt: null,
        children: [],
      },
      images: [],
      summary: {
        countdown: 0,
        jobdesc: 0,
        pr: 0,
        wo: 0,
        wov: 0,
        totalHours: 0,
        remainingHours: 0,
        progressPercent: 0,
      },
      activities: [],
      countdownReferences: {
        divisions: [{ label: "BODY", value: "4" }],
        units: [{ label: "MB 220S", value: "220S" }],
        panels: [{ label: "Lock Bracket", value: "123", carId: "220S", section: "91 DRIVER SEAT 2", category: "INTERIOR" }],
        sections: [{ label: "91 DRIVER SEAT 2", value: "91 DRIVER SEAT 2" }],
        jobTypes: [{ label: "Repair", value: "10", divisionId: 4 }],
        taskCategories: [{ label: "Additional", value: "ADDITIONAL" }],
      },
    });

    expect(detail.countdownReferences.panels[0]?.value).toBe("123");
  });
});
