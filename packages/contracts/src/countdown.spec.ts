import { describe, expect, it } from "bun:test";
import {
  countdownDetailEntrySchema,
  countdownRevisionDecisionSchema,
  countdownRevisionRequestSchema,
} from "./countdown";

describe("countdown detail entry schema", () => {
  const entry = {
    detailId: "detail-1",
    entryType: "ACTUAL",
    employeeId: "employee-1",
    employeeName: "Budi",
    employeeRole: "PIC",
    workDate: "2026-08-10",
    startTime: "08:00:00",
    finishTime: "10:00:00",
    billedHours: 2,
    progressPercent: 50,
    taskStatus: "PROSES",
    dailyNotes: "Melepas kondensor dan membersihkan dudukan.",
  };

  it("accepts the linked actual and its work documentation", () => {
    expect(countdownDetailEntrySchema.parse({
      ...entry,
      actualId: "actual-1",
      photos: [{
        photoId: "photo-1",
        type: "PROCESS",
        url: "https://example.com/process.jpg",
        caption: "Pengerjaan panel kiri",
        uploader: "Budi",
        time: "2026-08-10 09:00:00",
      }],
    })).toMatchObject({
      actualId: "actual-1",
      dailyNotes: "Melepas kondensor dan membersihkan dudukan.",
      photos: [{ type: "PROCESS", uploader: "Budi" }],
    });
  });

  it("accepts entries without an actual or documentation", () => {
    expect(countdownDetailEntrySchema.parse({
      ...entry,
      actualId: null,
      dailyNotes: null,
      photos: [],
    })).toMatchObject({ actualId: null, photos: [] });
  });
});

describe("countdown revision schemas", () => {
  it("accepts a valid revision request and trims its reason", () => {
    expect(countdownRevisionRequestSchema.parse({
      requestedHours: 4.5,
      requestedDeadline: "2026-08-20",
      reason: "  Perbaikan membutuhkan waktu tambahan  ",
    })).toEqual({
      requestedHours: 4.5,
      requestedDeadline: "2026-08-20",
      reason: "Perbaikan membutuhkan waktu tambahan",
    });
  });

  it("rejects non-positive hours, malformed dates, and blank reasons", () => {
    expect(countdownRevisionRequestSchema.safeParse({
      requestedHours: 0,
      requestedDeadline: "20-08-2026",
      reason: " ",
    }).success).toBe(false);
  });

  it("requires a complete approval decision", () => {
    expect(countdownRevisionDecisionSchema.safeParse({
      isApproved: false,
      approvedHours: 0,
      approvedDeadline: "2026-08-20",
    }).success).toBe(true);
    expect(countdownRevisionDecisionSchema.safeParse({
      isApproved: true,
      approvedHours: -1,
    }).success).toBe(false);
  });
});
