import { expect, test } from "bun:test";
import type { QaGridQuery } from "@smsystem/contracts/qa";
import { DefaultQaService } from "./qa.service";

test("QC history retains combined unit, division, date, and result filters", async () => {
  const query: QaGridQuery = {
    page: 1, limit: 100, search: "", sortBy: "inspectionDate",
    sortDirection: "desc", view: null,
    filters: [
      { field: "unitId", operator: "eq", value: "123-car" },
      { field: "divisionId", operator: "eq", value: "12" },
      { field: "dateFrom", operator: "eq", value: "2026-10-01" },
      { field: "dateTo", operator: "eq", value: "2026-10-02" },
      { field: "resultStatus", operator: "eq", value: "LOLOS" },
    ],
  };
  const service = new DefaultQaService({
    listInspections: async ({ query: received }: { query: QaGridQuery }) => {
      expect(received.filters).toEqual(query.filters);
      return { rows: [], total: 0, references: {}, dashboard: {} };
    },
  } as never, { log: async () => undefined } as never);
  await service.listPortal({
    user: { divisionId: null, scope: { canViewAllUnits: true } },
  } as never, query);
});
