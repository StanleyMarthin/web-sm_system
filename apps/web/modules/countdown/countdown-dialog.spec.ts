import { describe, expect, it } from "bun:test";
import {
  buildCountdownExportParams,
  resolveCountdownPhotoUrl,
  resolveCountdownEntryMode,
  resolveCountdownRevisionActions,
} from "./countdown-dialog";

describe("countdown dialog selection", () => {
  it("keeps editing in manual mode", () => {
    expect(resolveCountdownEntryMode("edit", "upload")).toBe("manual");
    expect(resolveCountdownEntryMode("create", "upload")).toBe("upload");
  });

  it("requires a unit and keeps optional export filters", () => {
    expect(buildCountdownExportParams("", "12", "DONE")).toBeNull();
    expect(buildCountdownExportParams("CAR-1", "", "")).toEqual({ unitId: "CAR-1" });
    expect(buildCountdownExportParams("CAR-1", "12", "DONE")).toEqual({
      unitId: "CAR-1",
      divisionId: "12",
      status: "DONE",
    });
  });
});

describe("countdown revision actions", () => {
  it("offers a revision only for active work without a pending request", () => {
    expect(resolveCountdownRevisionActions({
      status: "PROSES",
      extensionRequestStatus: null,
      canRequestRevision: true,
      canApproveRevision: false,
      canApproveMoRevision: false,
    })).toEqual({ canRequest: true, canApprove: false, canApproveMo: false });

    expect(resolveCountdownRevisionActions({
      status: "DONE",
      extensionRequestStatus: null,
      canRequestRevision: true,
      canApproveRevision: false,
      canApproveMoRevision: false,
    }).canRequest).toBe(false);
  });

  it("routes requested and MO review decisions to the matching approver", () => {
    expect(resolveCountdownRevisionActions({
      status: "PROSES",
      extensionRequestStatus: "REQUESTED",
      canRequestRevision: true,
      canApproveRevision: true,
      canApproveMoRevision: false,
    })).toEqual({ canRequest: false, canApprove: true, canApproveMo: false });

    expect(resolveCountdownRevisionActions({
      status: "PROSES",
      extensionRequestStatus: "MO_REVIEW",
      canRequestRevision: true,
      canApproveRevision: true,
      canApproveMoRevision: true,
    })).toEqual({ canRequest: false, canApprove: false, canApproveMo: true });
  });
});

describe("countdown documentation URL", () => {
  it("allows HTTP and root-relative photos but rejects protocol-relative URLs", () => {
    expect(resolveCountdownPhotoUrl("https://cdn.example.com/work.jpg")).toBe("https://cdn.example.com/work.jpg");
    expect(resolveCountdownPhotoUrl("/uploads/work.jpg")).toBe("/uploads/work.jpg");
    expect(resolveCountdownPhotoUrl("//evil.example/work.jpg")).toBeNull();
    expect(resolveCountdownPhotoUrl("javascript:alert(1)")).toBeNull();
  });
});
