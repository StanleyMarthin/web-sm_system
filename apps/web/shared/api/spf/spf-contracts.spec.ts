import { expect, test } from "bun:test";
import { spfPeriodDetailEnvelopeSchema } from "./spf-contracts";

test("accepts SMS_DB media in a period detail response", () => {
  const result = spfPeriodDetailEnvelopeSchema.parse({
    data: {
      period: { id: "2026-07-090", workflow_status: "DRAFT" },
      media: [{ id: "media-1", item_id: "item-1", source_type: "SMS_DB", mime_type: "image/jpeg" }],
    },
  });

  expect(result.data.media[0]?.source_type).toBe("SYSTEM");
});
