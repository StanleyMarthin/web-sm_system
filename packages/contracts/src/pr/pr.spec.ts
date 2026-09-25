import { describe, expect, it } from "bun:test";
import { createPrRequestSchema } from "./pr";

describe("create PR request", () => {
  it("accepts an optional master panel reference for unit-preparation PRs", () => {
    const result = createPrRequestSchema.parse({
      carId: "UNIT-1",
      panelId: 123,
      targetDate: "2026-09-01",
      items: [
        {
          itemName: "Oil Dipstick",
          qty: 1,
          uom: "pcs",
        },
      ],
    });

    expect(result.panelId).toBe(123);
  });
});
