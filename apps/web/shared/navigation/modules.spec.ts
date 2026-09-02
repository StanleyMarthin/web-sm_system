import { describe, expect, it } from "bun:test";
import { permissionCodes } from "@smsystem/permissions";
import { buildNavigation } from "./modules";

const spfItems = (permissions: string[]) =>
  buildNavigation(permissions)
    .find((item) => item.id === "spf")
    ?.subItems?.map((item) => item.id);

describe("SPF navigation permissions", () => {
  it("hides SPF without permission", () => {
    expect(spfItems([])).toBeUndefined();
  });

  it("shows only the workflows allowed by each SPF permission", () => {
    expect(spfItems([permissionCodes.spfApprove])).toEqual(["spf-periods"]);
    expect(spfItems([permissionCodes.spfPublish])).toEqual(["spf-periods", "spf-clients"]);
    expect(spfItems([permissionCodes.spfAdmin])).toEqual(["spf-periods", "spf-clients"]);
  });

  it("treats MIS as superadmin even before its permission rows are synchronized", () => {
    expect(
      buildNavigation([], "mis")
        .find((item) => item.id === "spf")
        ?.subItems?.map((item) => item.id),
    ).toEqual(["spf-periods", "spf-clients"]);
  });
});

describe("Unit catalog navigation permissions", () => {
  it("shows Units when the user only has catalog access", () => {
    expect(
      buildNavigation([permissionCodes.unitCatalogView])
        .find((item) => item.id === "units")
        ?.label,
    ).toBe("Units");
  });
});
