import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  buildGalleryGridQueryString,
  createGalleryPhoto,
  fetchGalleryGrid,
  fetchGalleryPhotos,
  requestGalleryUploadTicket,
} from "@/shared/api/gallery/gallery";

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe("gallery api client", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
    mock.restore();
  });

  it("builds query string with gallery filters", () => {
    const query = buildGalleryGridQueryString({
      date: "2026-05-19",
      unitId: "CAR-1",
      panelId: "55",
      status: "onprogress",
      part: "trim bawah",
      jobSearch: "pasang",
      filter: ["status:eq:onprogress"],
    });

    expect(query).toContain("date=2026-05-19");
    expect(query).toContain("unitId=CAR-1");
    expect(query).toContain("panelId=55");
    expect(query).toContain("part=trim+bawah");
    expect(query).toContain("jobSearch=pasang");
  });

  it("parses gallery grid and photo payloads", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";

    global.fetch = mock(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/api/gallery/ACT-1/photos")) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "ok",
            data: {
              actual: {
                actualId: "ACT-1",
                planId: "PLAN-1",
                countdownId: "COUNT-1",
                workDate: "2026-05-19",
                carId: "CAR-1",
                unitName: "MB 500 SEL",
                divisionName: "INTERIOR",
                panelName: "Dashboard",
                partName: "Trim bawah dashboard",
                jobName: "Pasang ke unit",
                jobDescription: "Pasang trim bawah dashboard",
                employeeName: "Asep",
                actualStatus: "onprogress",
                countdownStatus: "PROSES",
                submittedToLedger: false,
              },
              photos: [
                {
                  photoId: "PHOTO-1",
                  actualId: "ACT-1",
                  photoType: "PROCESS",
                  photoUrl: "https://pub.example/gallery/process-1.jpg",
                  caption: null,
                  source: "TEMP",
                  uploadedBy: "SM-11.003",
                  uploadedByName: "Asep",
                  uploadedAt: "2026-05-19 09:00:00",
                  canEdit: true,
                  canDelete: true,
                },
              ],
            },
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "ok",
          data: [
            {
              actualId: "ACT-1",
              planId: "PLAN-1",
              countdownId: "COUNT-1",
              workDate: "2026-05-19",
              latestPhotoAt: "2026-05-19 09:00:00",
              carId: "CAR-1",
              unitName: "MB 500 SEL",
              customerName: "Mr. Silmy",
              divisionId: 12,
              divisionName: "INTERIOR",
              panelId: 55,
              panelName: "Dashboard",
              partName: "Trim bawah dashboard",
              jobTypeId: "JOB-1",
              jobName: "Pasang ke unit",
              jobDescription: "Pasang trim bawah dashboard",
              employeeId: "SM-11.003",
              employeeName: "Asep",
              actualStatus: "onprogress",
              countdownStatus: "PROSES",
              progressPercent: 45,
              photoCount: 2,
              beforeCount: 1,
              processCount: 1,
              afterCount: 0,
              defectCount: 0,
              submittedToLedger: false,
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
          references: {
            units: [{ value: "CAR-1", label: "MB 500 SEL" }],
            divisions: [{ value: "12", label: "INTERIOR" }],
            panels: [{ value: "55", label: "Dashboard" }],
            statuses: [{ value: "onprogress", label: "Sedang dikerjakan" }],
          },
          query: {
            page: 1,
            limit: 25,
            search: "",
            sortBy: "latestPhotoAt",
            sortDirection: "desc",
            view: null,
            filters: [],
            date: "2026-05-19",
            unitId: null,
            divisionId: null,
            panelId: null,
            status: null,
            part: "",
            jobSearch: "",
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const gridResult = await fetchGalleryGrid("session=abc", {
      date: "2026-05-19",
    });
    expect(gridResult.status).toBe(200);
    expect(gridResult.payload?.data[0]?.actualId).toBe("ACT-1");

    const detailResult = await fetchGalleryPhotos("session=abc", "ACT-1");
    expect(detailResult.status).toBe(200);
    expect(detailResult.payload?.data.photos[0]?.photoId).toBe("PHOTO-1");
  });

  it("requests an R2 upload ticket with the original video metadata", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    let requestedUrl = "";

    global.fetch = mock(async (input: string | URL | Request) => {
      requestedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(JSON.stringify({
        success: true,
        message: "ok",
        data: {
          uploadUrl: "https://r2.example/upload/video",
          publicUrl: "https://pub.example/gallery/process.mp4",
          objectKey: "gallery/ACT-1/process.mp4",
        },
      }), { status: 200 });
    }) as typeof fetch;

    const result = await requestGalleryUploadTicket({
      actualId: "ACT-1",
      photoType: "PROCESS",
      filename: "proses kerja.mp4",
      contentType: "video/mp4",
      size: 12_345,
    });

    const params = new URL(requestedUrl).searchParams;
    expect(result.success).toBe(true);
    expect(params.get("filename")).toBe("proses kerja.mp4");
    expect(params.get("contentType")).toBe("video/mp4");
    expect(params.get("size")).toBe("12345");
  });

  it("attaches a Google Drive media URL without uploading a file", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3203";
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    global.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      requests.push({ url, init });
      return new Response(JSON.stringify({
        success: true,
        message: "ok",
        data: {
          photo: {
            photoId: "MEDIA-1",
            actualId: "ACT-1",
            photoType: "PROCESS",
            photoUrl: "https://drive.google.com/file/d/media-1/view",
            caption: "Video pengerjaan",
            source: "TEMP",
            uploadedBy: "SM-11.003",
            uploadedByName: "Asep",
            uploadedAt: "2026-08-12 09:00:00",
            canEdit: true,
            canDelete: true,
          },
        },
      }), { status: 201 });
    }) as typeof fetch;

    const mediaUrl = "https://drive.google.com/file/d/media-1/view";
    const result = await createGalleryPhoto({
      actualId: "ACT-1",
      photoType: "PROCESS",
      photoUrl: mediaUrl,
      caption: "Video pengerjaan",
    });

    expect(result.success).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("http://127.0.0.1:3203/api/gallery/photos");
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      actualId: "ACT-1",
      photoType: "PROCESS",
      photoUrl: mediaUrl,
      caption: "Video pengerjaan",
    });
  });
});
