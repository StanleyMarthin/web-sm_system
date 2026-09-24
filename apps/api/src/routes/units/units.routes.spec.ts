import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { canReadUnitClients } from "./units.routes";

describe("Unit client source RBAC", () => {
  it("allows Unit readers and SPF client operators only", () => {
    expect(canReadUnitClients([permissionCodes.viewUnits])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfAdmin])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfPublish])).toBe(true);
    expect(canReadUnitClients([permissionCodes.spfApprove])).toBe(false);
    expect(canReadUnitClients([])).toBe(false);
  });
});
