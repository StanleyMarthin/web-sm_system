import { afterEach, describe, expect, it, mock } from "bun:test";
import { buildIssueGridQueryString, createIssue, fetchIssueGrid, resolveIssue } from "@/shared/api/issues/issues";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("issues api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string for issue filters", () => {
    const query = buildIssueGridQueryString({
      filter: ["status:eq:OPEN"],
    });

    expect(query).toContain("filter=status%3Aeq%3AOPEN");
  });

  it("parses issue payload on success", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          storageReady: true,
          data: [
            {
              issueId: "ISSUE-1",
              issueNumber: "ISS-20260514-001",
              sourceType: "MANUAL",
              sourceRefId: null,
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              countdownId: null,
              planId: null,
              qcId: null,
              ledgerId: null,
              issueType: "HAMBATAN",
              severity: "HIGH",
              title: "Parts belum datang",
              description: "Perlu follow-up vendor.",
              status: "OPEN",
              isUrgent: true,
              assignedTo: null,
              assignedToName: null,
              reportedBy: "SM-08.005",
              reportedByName: "Yudha Agustiana",
              createdAt: "2026-05-14 09:00:00",
              updatedAt: "2026-05-14 09:00:00",
              resolutionNotes: null,
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
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "createdAt",
            sortDirection: "desc",
            view: null,
            filters: [],
          },
          references: {
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
          },
          summary: {
            openCount: 1,
            urgentCount: 1,
            escalatedCount: 0,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchIssueGrid("session=abc", {});
    expect(result.status).toBe(200);
    expect(result.payload?.data[0]?.issueId).toBe("ISSUE-1");
    expect(result.payload?.summary.urgentCount).toBe(1);
    expect(result.payload?.references.jobdescs[0]).toEqual({
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

  it("forwards the attached job description identifiers when creating an issue", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    let request: RequestInit | undefined;

    global.fetch = mock(async (_input, init) => {
      request = init;
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: { issueId: "ISSUE-2", status: "OPEN" },
        }),
        { status: 201 },
      );
    }) as typeof fetch;

    await createIssue({
      carId: "CAR-1",
      divisionId: 12,
      countdownId: "COUNTDOWN-1",
      planId: "PLAN-1",
      issueType: "HAMBATAN",
      severity: "MEDIUM",
      title: "Pasang dashboard",
      description: "Ada bracket yang belum sesuai.",
    });

    expect(JSON.parse(String(request?.body))).toEqual({
      carId: "CAR-1",
      divisionId: 12,
      countdownId: "COUNTDOWN-1",
      planId: "PLAN-1",
      issueType: "HAMBATAN",
      severity: "MEDIUM",
      title: "Pasang dashboard",
      description: "Ada bracket yang belum sesuai.",
    });
  });

  it("submits solving notes to the resolve transition", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    let url = "";
    let request: RequestInit | undefined;

    global.fetch = mock(async (input, init) => {
      url = String(input);
      request = init;
      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: { issueId: "ISSUE-2", status: "RESOLVED" },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await resolveIssue("ISSUE-2", {
      resolutionNotes: "Bracket diganti dan pemasangan sudah dicek ulang.",
    });

    expect(url).toBe("http://127.0.0.1:3203/api/issues/ISSUE-2/resolve");
    expect(request?.method).toBe("PATCH");
    expect(JSON.parse(String(request?.body))).toEqual({
      resolutionNotes: "Bracket diganti dan pemasangan sudah dicek ulang.",
    });
    expect(result).toEqual({
      success: true,
      result: { issueId: "ISSUE-2", status: "RESOLVED" },
    });
  });
});
