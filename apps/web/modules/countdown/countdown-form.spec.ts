import { describe, expect, it } from "bun:test";
import {
  collectMissingCountdownFields,
  resolveCountdownFormSummary,
  resolveSectionFromPanel,
} from "./countdown-form";

const references = {
  units: [{ label: "MB 500 SEL", value: "CAR-1" }],
  panels: [{ label: "Dashboard", value: "457", section: "KARPET COVER BAWAH DASHBOARD" }],
  divisions: [{ label: "BODY WORK", value: "10" }],
  employees: [{ label: "RUHIAT SAEPULOH", value: "SM-11.002" }],
  jobTypes: [{ label: "Fitting dashboard", value: "JT-1" }],
};

describe("countdown form summary", () => {
  it("resolves master labels instead of technical ids", () => {
    expect(resolveCountdownFormSummary({
      carId: "CAR-1",
      panelId: "457",
      divisionId: "10",
      picPlan: "SM-11.002",
      jobTypeId: "JT-1",
      taskCategory: "MAIN",
    }, references)).toEqual({
      unit: "MB 500 SEL",
      panel: "Dashboard",
      division: "BODY WORK",
      employee: "RUHIAT SAEPULOH",
      jobType: "Fitting dashboard",
      taskCategory: "Utama",
    });
  });

  it("keeps empty selections empty", () => {
    expect(resolveCountdownFormSummary({
      carId: "",
      panelId: "",
      divisionId: "",
      picPlan: "",
      jobTypeId: "",
      taskCategory: "",
    }, references)).toEqual({
      unit: "",
      panel: "",
      division: "",
      employee: "",
      jobType: "",
      taskCategory: "",
    });
  });

  it("falls back to the humanized code for unknown categories", () => {
    expect(resolveCountdownFormSummary({
      carId: "CAR-1",
      panelId: "",
      divisionId: "",
      picPlan: "",
      jobTypeId: "",
      taskCategory: "WOV",
    }, references).taskCategory).toBe("Vendor");
  });
});

describe("countdown form helpers", () => {
  it("takes the section from the selected panel", () => {
    expect(resolveSectionFromPanel(references.panels, "457")).toBe("KARPET COVER BAWAH DASHBOARD");
    expect(resolveSectionFromPanel(references.panels, "")).toBe("");
    expect(resolveSectionFromPanel(references.panels, "999")).toBe("");
  });

  it("lists only the required fields that currently fail validation", () => {
    expect(collectMissingCountdownFields(
      { carId: { message: "Unit wajib dipilih" }, deadlineDate: { message: "Deadline wajib diisi" } },
      { carId: "Unit", divisionId: "Divisi", sectionName: "Bagian", deadlineDate: "Deadline" },
    )).toEqual(["Unit", "Deadline"]);
    expect(collectMissingCountdownFields({}, { carId: "Unit" })).toEqual([]);
  });
});
