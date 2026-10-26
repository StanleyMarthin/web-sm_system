import { describe, expect, it } from "bun:test";
import { createUnitMediaRequestSchema, createUnitRequestSchema, updateUnitMediaFolderRequestSchema, updateUnitMediaRequestSchema } from "./unit";

describe("unit intake contract", () => {
  const validUnit = {
    unitId: "MB-E320_MASTERPIECE_MR-DIKO",
    unitName: "MB E320 MASTERPIECE",
    customerName: "Mr. Diko",
    kpId: "SM-08.008",
  };

  it("accepts a long chassis number and rejects values beyond the vehicle profile limit", () => {
    expect(createUnitRequestSchema.safeParse({
      ...validUnit,
      plateNumber: "11406060116829/11099022005960",
    }).success).toBe(true);

    const result = createUnitRequestSchema.safeParse({
      ...validUnit,
      plateNumber: "1".repeat(101),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Nomor rangka / VIN maksimal 100 karakter");
    }
  });

  it("accepts reference-link and category updates", () => {
    expect(updateUnitMediaFolderRequestSchema.parse({ name: "Electrical" })).toEqual({ name: "Electrical" });
    expect(updateUnitMediaRequestSchema.parse({
      mediaUrl: "https://drive.google.com/file/d/reference/view",
      caption: "Skema kelistrikan",
    })).toMatchObject({ mediaUrl: "https://drive.google.com/file/d/reference/view", caption: "Skema kelistrikan" });
    expect(createUnitMediaRequestSchema.parse({
      folderId: "folder-1",
      mediaType: "REFERENCE",
      source: "LINK",
      mediaUrl: "https://catalog.example.com/mb-190-sl",
      caption: "Katalog electrical",
    }).source).toBe("LINK");
  });

  it("accepts structured vehicle details and rejects an impossible vehicle year", () => {
    expect(createUnitRequestSchema.safeParse({
      ...validUnit,
      vehicleYear: 1961,
      policeNumber: "D 1366 VCN",
      engineNumber: "E-123456",
      vehicleColor: "British Racing Green",
      hasBpkb: true,
      hasStnk: false,
      stnkTaxDueDate: "2026-04-03",
      bpkbTaxDueDate: "2026-04-03",
    }).success).toBe(true);
    expect(createUnitRequestSchema.safeParse({ ...validUnit, vehicleYear: 1700 }).success).toBe(false);
  });
});
