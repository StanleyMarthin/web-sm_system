import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { canReadUnitClients, mapUnitsError } from "./units.routes";

describe("Unit client source RBAC", () => {
  it("allows Unit readers and SPF client operators only", () => {
    expect(canReadUnitClients([permissionCodes.viewUnits])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfAdmin])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfPublish])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfApprove])).toBe(false);
    expect(canReadUnitClients([])).toBe(false);
  });

  it("returns a usable validation error when a database field is too long", async () => {
    const error = Object.assign(new Error("Data too long"), { code: "ER_DATA_TOO_LONG" });
    const response = mapUnitsError(new Request("http://localhost/api/units"), error);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      errorCode: "UNIT_FIELD_TOO_LONG",
      message: "Nilai isian terlalu panjang untuk disimpan.",
    });
  });
});
