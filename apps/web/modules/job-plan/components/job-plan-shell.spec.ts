import { describe, expect, test } from "bun:test";
import { jobPlanDraftRecordSchema } from "@smsystem/contracts/job-plan";
import { buildJobPlanEditForm, resolveAdditionalPanelSelection } from "./job-plan-shell";

describe("buildJobPlanEditForm", () => {
  test("keeps HH:MM values used by the jobdesc form", () => {
    const form = buildJobPlanEditForm({
      assignedUserId: "EMP-1",
      taskDate: "2026-08-12",
      targetHours: 2.5,
      startTime: "08:00:00",
      finishTime: "10:30:00",
      jobDescription: "Pasang dan cek panel",
      note: "Prioritas pagi",
      isPriority: true,
    });

    expect(form).toEqual({
      assignedUserId: "EMP-1",
      taskDate: "2026-08-12",
      targetHours: "02:30",
      startTime: "08:00:00",
      finishTime: "10:30:00",
      jobDescription: "Pasang dan cek panel",
      note: "Prioritas pagi",
      isPriority: true,
    });
  });
});

describe("resolveAdditionalPanelSelection", () => {
  test("requires an existing master panel id", () => {
    const panel = resolveAdditionalPanelSelection({
      panelId: "",
      panelOptions: [],
    });

    expect(panel).toEqual({ panelId: null, panelName: null });
  });
});

describe("job plan non-technical draft", () => {
  test("keeps the explicit activity flag for a technical division", () => {
    const draft = jobPlanDraftRecordSchema.parse({
      draftItemId: "draft-meeting",
      sourceType: "ADDITIONAL",
      divisionId: 7,
      assignedUserId: "EMP-1",
      taskDate: "2026-08-12",
      targetHours: 1,
      jobDescription: "Meeting progres",
      isNonTechnicalJob: true,
    });

    expect(draft.isNonTechnicalJob).toBe(true);
  });
});
