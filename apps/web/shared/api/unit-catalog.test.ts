import { afterEach, describe, expect, it, mock } from "bun:test";
import { fetchUnitCatalog } from "@/shared/api/unit-catalog";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("unit catalog api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("parses empty overview payload without treating it as an error", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => new Response(JSON.stringify({
      success: true,
      message: "ok",
      data: {
        overview: {
          components: [
            { id: 1, code: "ENGINE", componentName: "ENGINE" },
            { id: 2, code: "UNDERCARRIAGE", componentName: "UNDERCARRIAGE" },
            { id: 3, code: "ELECTRICAL", componentName: "ELECTRICAL" },
            { id: 4, code: "BODY", componentName: "BODY" },
            { id: 5, code: "INTERIOR", componentName: "INTERIOR" },
          ],
          panels: [],
        },
      },
    }), { status: 200 })) as typeof fetch;

    const result = await fetchUnitCatalog("CHEVROLET_MRNYOMAN");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");
    expect(result.payload.data.overview.components).toHaveLength(5);
    expect(result.payload.data.overview.panels).toEqual([]);
  });

  it("returns failure envelope on 401 so the UI can show the session message", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async () => new Response(JSON.stringify({
      success: false,
      message: "Sesi tidak valid atau sudah berakhir.",
      errorCode: "INVALID_SESSION",
      data: {},
    }), { status: 401 })) as typeof fetch;

    const result = await fetchUnitCatalog("CHEVROLET_MRNYOMAN");

    expect(result).toEqual({
      success: false,
      message: "Sesi tidak valid atau sudah berakhir.",
      errorCode: "INVALID_SESSION",
    });
  });
});
