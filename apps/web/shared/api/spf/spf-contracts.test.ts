import { describe, expect, test } from "bun:test";
import { requestSchemas, spfPeriodSchema } from "./spf-contracts";

describe("SPF frontend contract", () => {
  test("accepts string IDs and the backend period create payload", () => {
    expect(requestSchemas.period.parse({
      mode: "CREATE",
      car_id: "PORSCHE930_ADRIAN",
      title: "Juli 2026",
      description: "Progress",
      date_start: "2026-07-01",
      date_end: "2026-07-31",
      item_ids: ["item-1"],
    }).mode).toBe("CREATE");
  });

  test("uses workflow_status in period responses", () => {
    expect(spfPeriodSchema.parse({
      id: "period-1",
      title: "Juli 2026",
      description: null,
      workflow_status: "DRAFT",
      rejection_reason: null,
      created_by: "SM-01",
      created_at: "2026-07-01",
      updated_at: "2026-07-01",
    }).workflow_status).toBe("DRAFT");
  });

  test("accepts only supported R2 media payload fields", () => {
    expect(requestSchemas.item.parse({
      mode: "UPLOAD_MEDIA",
      item_id: "item-1",
      file_name: "progress.mp4",
      mime_type: "video/mp4",
      file_data: "AAAA",
    }).mode).toBe("UPLOAD_MEDIA");
  });
});
