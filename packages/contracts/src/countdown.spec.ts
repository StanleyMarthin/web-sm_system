import { describe, expect, it } from "bun:test";
import {
  countdownBoardEnvelopeSchema,
  countdownCreateRequestSchema,
  countdownDetailEntrySchema,
  countdownRevisionDecisionSchema,
  countdownRevisionRequestSchema,
  countdownUpdateRequestSchema,
} from "./countdown";

describe("countdown manual entry schema", () => {
  it("accepts PIC and grade from the existing references", () => {
    const parsed = countdownCreateRequestSchema.parse({
      carId: "CAR-1",
      divisionId: 10,
      sectionName: "BODY WORK",
      targetHoursInitial: 8,
      deadlineDate: "2026-09-30",
      picPlan: "SM-09.002",
      requiredGrade: "TK. II",
    });

    expect(parsed.picPlan).toBe("SM-09.002");
    expect(parsed.requiredGrade).toBe("TK. II");
    expect(countdownCreateRequestSchema.parse({
      carId: "CAR-1",
      divisionId: 10,
      sectionName: "BODY WORK",
      targetHoursInitial: 8,
      deadlineDate: "2026-09-30",
      picPlan: null,
      requiredGrade: null,
    })).toMatchObject({ picPlan: null, requiredGrade: null });
  });

  it("carries employee and grade references for the manual form", () => {
    const parsed = countdownBoardEnvelopeSchema.parse({
      success: true,
      message: "ok",
      data: [],
      meta: { page: 1, limit: 25, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
      query: {
        page: 1,
        limit: 25,
        search: "",
        sortBy: "updatedAt",
        sortDirection: "desc",
        view: null,
        filters: [],
      },
      references: {
        divisions: [],
        units: [],
        panels: [],
        jobTypes: [],
        employees: [{ label: "NANA HERMAWAN", value: "SM-09.002", divisionId: 10, grade: "BODY WORK" }],
        grades: [{ label: "TK. II", value: "TK. II" }],
      },
    });

    expect(parsed.references?.employees).toEqual([
      { label: "NANA HERMAWAN", value: "SM-09.002", divisionId: 10, grade: "BODY WORK" },
    ]);
    expect(parsed.references?.grades).toEqual([{ label: "TK. II", value: "TK. II" }]);
  });
});

describe("countdown update schema", () => {
  it("accepts null to clear every clearable field", () => {
    const cleared = countdownUpdateRequestSchema.parse({
      panelId: null,
      jobTypeId: null,
      startDate: null,
      prerequisiteCoreId: null,
      refWoId: null,
      picPlan: null,
      requiredGrade: null,
      note: null,
      temuanAwal: null,
      keterangan: null,
    });

    expect(Object.values(cleared).every((value) => value === null)).toBe(true);
  });

  it("rejects null for required identity fields", () => {
    for (const field of [
      "carId",
      "divisionId",
      "sectionName",
      "targetHoursInitial",
      "deadlineDate",
      "taskCategory",
      "status",
    ] as const) {
      expect(countdownUpdateRequestSchema.safeParse({ [field]: null }).success).toBe(false);
    }
  });

  it("keeps an empty payload invalid", () => {
    expect(countdownUpdateRequestSchema.safeParse({}).success).toBe(false);
  });
});

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
