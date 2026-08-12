import { describe, expect, it } from "bun:test";
import { getPermissionMeta, permissionCodes } from "./index";

describe("countdown permission metadata", () => {
  it("exposes approval and revision actions to web and mobile sessions", () => {
    expect(getPermissionMeta(permissionCodes.countdownSubmitApproval)).toEqual({
      platforms: ["WEB", "MOBILE"],
      audience: "SHARED",
    });
    expect(getPermissionMeta(permissionCodes.countdownRequestRevision)).toEqual({
      platforms: ["WEB", "MOBILE"],
      audience: "SHARED",
    });
  });
});
