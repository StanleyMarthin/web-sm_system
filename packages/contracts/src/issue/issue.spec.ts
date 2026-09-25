import { describe, expect, it } from "bun:test";
import { issueReferencesSchema } from "./issue";

describe("issue references", () => {
  it("accepts structured job descriptions that can be attached to an issue", () => {
    const references = issueReferencesSchema.parse({
      units: [],
      divisions: [],
      statuses: [],
      severities: [],
      employees: [],
      jobdescs: [
        {
          value: "PLAN-1",
          label: "Interior · Pasang dashboard",
          carId: "CAR-1",
          divisionId: 12,
          countdownId: "COUNTDOWN-1",
          panelValue: "55",
          panelLabel: "Dashboard · Trim bawah",
          title: "Pasang dashboard",
          description: "Pasang dashboard sesuai instruksi kerja.",
        },
      ],
    });

    expect(references.jobdescs[0]).toEqual({
      value: "PLAN-1",
      label: "Interior · Pasang dashboard",
      carId: "CAR-1",
      divisionId: 12,
      countdownId: "COUNTDOWN-1",
      panelValue: "55",
      panelLabel: "Dashboard · Trim bawah",
      title: "Pasang dashboard",
      description: "Pasang dashboard sesuai instruksi kerja.",
    });
  });
});
