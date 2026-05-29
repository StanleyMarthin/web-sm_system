import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildSpkGridQueryString,
  fetchSpkGrid,
} from "@/shared/api/spk";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("spk api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string with default date", () => {
    const query = buildSpkGridQueryString({
      page: "2",
      filter: ["status:eq:SUBMITTED"],
    });

    expect(query).toContain("page=2");
    expect(query).toContain("filter=status%3Aeq%3ASUBMITTED");
    expect(query).toContain("date=");
  });

  it("parses spk list payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              spkId: "SPK-1",
              spkNumber: "SPK-20260515-001",
              spkDate: "2026-05-15",
              status: "SUBMITTED",
              totalUnits: 1,
              totalHours: 4,
              createdBy: "Sahrul Riswanto",
              approvedBy: null,
              rejectReason: null,
              notes: null,
              createdAt: "2026-05-14 10:00:00",
              submittedAt: "2026-05-14 11:00:00",
              approvedAt: null,
              activatedAt: null,
            },
          ],
          meta: {
            page: 1,
            limit: 25,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
          storageReady: false,
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "spkDate",
            sortDirection: "desc",
            view: null,
            filters: [],
            date: "2026-05-15",
          },
          summary: {
            pendingApproval: 1,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchSpkGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.spkId).toBe("SPK-1");
    expect(result.payload?.storageReady).toBe(false);
    expect(result.payload?.summary.pendingApproval).toBe(1);
  });
});
