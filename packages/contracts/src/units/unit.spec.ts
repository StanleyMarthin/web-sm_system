import { describe, expect, it } from "bun:test";
import { createUnitRequestSchema } from "./unit";

describe("unit intake contract", () => {
  const validUnit = {
    unitId: "MB-E320_MASTERPIECE_MR-DIKO",
    unitName: "MB E320 MASTERPIECE",
    customerName: "Mr. Diko",
    kpId: "SM-08.008",
  };

  it("accepts a standard 17-character VIN and rejects longer values", () => {
    expect(createUnitRequestSchema.safeParse({
      ...validUnit,
      plateNumber: "MHL124032OL027161",
    }).success).toBe(true);

    const result = createUnitRequestSchema.safeParse({
      ...validUnit,
      plateNumber: "MHL124032OL0271610",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("VIN Number maksimal 17 karakter");
    }
  });
});
