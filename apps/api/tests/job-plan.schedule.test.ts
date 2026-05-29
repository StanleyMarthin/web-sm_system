import { describe, expect, test } from "bun:test";
import {
  buildJobPlanScheduleSegments,
  calculateNormalFinishTime,
  formatDurationHHMM,
  parseDurationHHMM,
} from "@smsystem/contracts/job-plan-schedule";

describe("job plan schedule helper", () => {
  test("menghitung finish normal dengan istirahat makan siang senin sampai kamis", () => {
    expect(calculateNormalFinishTime("2026-05-18", 5)).toBe("14:00");
  });

  test("menghitung finish normal jumat dengan istirahat satu setengah jam", () => {
    expect(calculateNormalFinishTime("2026-05-22", 6)).toBe("15:30");
  });

  test("memecah jam normal sabtu yang melewati batas menjadi normal dan lembur", () => {
    const segments = buildJobPlanScheduleSegments({
      taskDate: "2026-05-23",
      requestedMode: "normal",
      targetHours: 6,
    });

    expect(segments).toEqual([
      {
        mode: "normal",
        targetHours: 5,
        startTime: "08:00",
        finishTime: "14:00",
      },
      {
        mode: "overtime",
        targetHours: 1,
        startTime: "14:00",
        finishTime: "15:00",
      },
    ]);
  });

  test("pekerjaan minggu otomatis menjadi lembur", () => {
    const segments = buildJobPlanScheduleSegments({
      taskDate: "2026-05-24",
      requestedMode: "normal",
      targetHours: 3,
    });

    expect(segments).toEqual([
      {
        mode: "overtime",
        targetHours: 3,
        startTime: "08:00",
        finishTime: "11:00",
      },
    ]);
  });

  test("parse dan format durasi HH:MM tetap stabil", () => {
    expect(parseDurationHHMM("05:30")).toBe(5.5);
    expect(formatDurationHHMM(5.5)).toBe("05:30");
  });
});
