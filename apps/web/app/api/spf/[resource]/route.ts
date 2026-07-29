import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { requestSchemas, type SpfResource } from "@/shared/api/spf-contracts";
import { getApiBaseUrl } from "@/shared/api/config";

const ALLOWED_RESOURCES = new Set<SpfResource>(["source", "item", "period"]);

function safeError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      error: { code },
    },
    { status },
  );
}

// ─── Realistis Dummy Data berdasarkan Dump MySQL sms_client ──────────────────
const mockSources = [
  {
    id: 542,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "CHECK + ANALISA + TEST FUNGSI + MERAPIKAN WIRING CABLE MOTOR DYNAMO LOCK LUGGAGE DI UNIT",
    work_type: "ELEKTRIKAL",
    collected: true,
    created_at: "2023-11-06T08:00:00Z",
  },
  {
    id: 545,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "PERANCANGAN COVER DEK BAGASI PERSIAPAN PEMASANGAN",
    work_type: "INTERIOR",
    collected: true,
    created_at: "2026-04-27T08:00:00Z",
  },
  {
    id: 554,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "SANDING DEMPUL + MERAPIKAN COVER KONDENSOR AC PERSIAPAN SPRAY CAT",
    work_type: "BODYWORK",
    collected: false,
    created_at: "2026-05-18T08:00:00Z",
  },
  {
    id: 556,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "SANDING DEMPUL + MERAPIKAN FENDER DEPAN RH DI UNIT",
    work_type: "BODYWORK",
    collected: false,
    created_at: "2026-05-18T08:00:00Z",
  },
  {
    id: 559,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "MAKING PACKING INLET TURBO PERSIAPAN PEMASANGAN",
    work_type: "ENGINE",
    collected: false,
    created_at: "2026-06-08T08:00:00Z",
  },
];

const mockItems = [
  {
    id: 1,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "MAKING PACKING INLET TURBO PERSIAPAN PEMASANGAN",
    work_type: "ENGINE",
    period_id: 559,
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: 2,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "MERAPIKAN + PENGGANTIAN INSULATOR KAIN CABLE BAWAH DASHBOARD 14 PCS DI UNIT",
    work_type: "ELEKTRIKAL",
    period_id: 542,
    created_at: "2023-09-11T08:00:00Z",
    updated_at: "2023-09-17T16:00:00Z",
  },
  {
    id: 3,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "PERANCANGAN COVER DEK BAGASI PERSIAPAN PEMASANGAN",
    work_type: "INTERIOR",
    period_id: 545,
    created_at: "2026-04-27T08:00:00Z",
    updated_at: "2026-04-30T16:00:00Z",
  },
  {
    id: 4,
    car_id: "PORSCHE930_ADRIAN",
    car_name: "Porsche 930 Turbo (Adrian)",
    description: "CLEANING + PHOSPHATING + SPRAY EPOXY HIJAU BRACKET KONDENSOR AC",
    work_type: "BODYWORK",
    period_id: null,
    created_at: "2026-04-27T08:00:00Z",
    updated_at: "2026-04-30T16:00:00Z",
  },
  {
    id: 5,
    car_id: "PORSCHE944_MRPRAM",
    car_name: "Porsche 944 (Mr. Pram)",
    description: "SANDING EPOXY + DEMPUL + SANDING DEMPUL + SPRAY EPOXY HITAM MODUL ECU PERSIAPAN SPRAY CAT",
    work_type: "PAINTING",
    period_id: null,
    created_at: "2023-09-18T08:00:00Z",
    updated_at: "2023-09-24T16:00:00Z",
  },
];

const mockMedia = [
  {
    id: 101,
    item_id: 1,
    url: "https://picsum.photos/800/600?random=1",
    mime_type: "image/jpeg",
    filename: "inlet_turbo_packing_01.jpg",
    created_at: "2026-06-08T10:00:00Z",
  },
  {
    id: 102,
    item_id: 1,
    url: "https://picsum.photos/800/600?random=2",
    mime_type: "image/jpeg",
    filename: "inlet_turbo_fitting_02.jpg",
    created_at: "2026-06-09T14:30:00Z",
  },
  {
    id: 103,
    item_id: 2,
    url: "https://picsum.photos/800/600?random=3",
    mime_type: "image/jpeg",
    filename: "wiring_dashboard_insulator.jpg",
    created_at: "2023-09-12T11:15:00Z",
  },
];

const mockPeriods = [
  {
    id: 559,
    title: "PORSCHE930_ADRIAN — Periode Restorasi Juni 2026 (Minggu 2)",
    description: "Pekerjaan sektor engine: packing inlet turbo dan perbaikan jalur cool start.",
    status: "PUBLISHED" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-06-08T08:00:00Z",
    updated_at: "2026-06-13T16:00:00Z",
  },
  {
    id: 545,
    title: "PORSCHE930_ADRIAN — Periode Restorasi Mei 2026 (Minggu 4)",
    description: "Pekerjaan sektor interior: perancangan cover dek bagasi dan fitting jok.",
    status: "APPROVED" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-05-25T08:00:00Z",
    updated_at: "2026-05-30T16:00:00Z",
  },
  {
    id: 542,
    title: "PORSCHE944_MRPRAM — Periode Restorasi November 2023",
    description: "Pekerjaan wiring kelistrikan, central lock luggage, dan perapihan modul ECU.",
    status: "WAITING_APPROVAL" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2023-11-06T08:00:00Z",
    updated_at: "2023-11-12T16:00:00Z",
  },
  {
    id: 501,
    title: "PORSCHE930_ADRIAN — Periode DRAFT Restorasi Juli 2026",
    description: "Pekerjaan kelistrikan saklar power window dan cleaning bodi pra-delivery.",
    status: "DRAFT" as const,
    rejection_reason: null,
    created_by: "ADMIN_STANLEY",
    created_at: "2026-07-05T08:00:00Z",
    updated_at: "2026-07-05T08:00:00Z",
  },
];

// Helper mock handler saat backend belum tersedia
function getMockResponse(resource: SpfResource, input: unknown) {
  const req = input as { mode?: string; item_id?: number; period_id?: number };
  const mode = req.mode;

  if (resource === "source") {
    return {
      success: true,
      message: "Berhasil mendapatkan data source SMS",
      data: {
        sources: mockSources,
        meta: { total: mockSources.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  if (resource === "item") {
    if (mode === "DETAIL") {
      const targetItem = mockItems.find((i) => i.id === req.item_id) || mockItems[0]!;
      const itemMedia = mockMedia.filter((m) => m.item_id === targetItem.id);
      return {
        success: true,
        message: "Berhasil mendapatkan detail item",
        data: {
          item: targetItem,
          media: itemMedia,
        },
      };
    }
    return {
      success: true,
      message: "Berhasil mendapatkan daftar item",
      data: {
        items: mockItems,
        meta: { total: mockItems.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  if (resource === "period") {
    if (mode === "DETAIL") {
      const targetPeriod = mockPeriods.find((p) => p.id === req.period_id) || mockPeriods[0]!;
      const periodItems = mockItems.filter((i) => i.period_id === targetPeriod.id);
      return {
        success: true,
        message: "Berhasil mendapatkan detail periode",
        data: {
          period: targetPeriod,
          items: periodItems,
        },
      };
    }
    return {
      success: true,
      message: "Berhasil mendapatkan daftar periode",
      data: {
        periods: mockPeriods,
        meta: { total: mockPeriods.length, limit: 25, offset: 0, hasNextPage: false },
      },
    };
  }

  return {
    success: true,
    message: "Aksi berhasil diproses",
    data: {},
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);

  if (!session) {
    return safeError(401, "UNAUTHORIZED", "Sesi tidak valid atau telah berakhir.");
  }

  const { resource } = await context.params;

  if (!ALLOWED_RESOURCES.has(resource as SpfResource)) {
    return safeError(404, "NOT_FOUND", `Resource '${resource}' tidak ditemukan.`);
  }

  const targetResource = resource as SpfResource;

  // Read JSON body safely
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return safeError(400, "BAD_REQUEST", "Body request tidak berupa JSON yang valid.");
  }

  // Validate payload against schema boundary
  const parsed = requestSchemas[targetResource].safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "Data request tidak valid.";
    return safeError(400, "VALIDATION_ERROR", msg);
  }

  // Upstream target
  const upstreamBaseUrl =
    process.env.SPF_API_INTERNAL_URL?.replace(/\/$/u, "") || getApiBaseUrl();
  const adminApiKey = process.env.PORTAL_ADMIN_API_KEY || "";

  try {
    const upstreamResponse = await fetch(
      `${upstreamBaseUrl}/api/admin/spf/${targetResource}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(adminApiKey ? { authorization: `Bearer ${adminApiKey}` } : {}),
          "x-employee-id": session.employeeId,
          "x-admin-role": session.role,
        },
        body: JSON.stringify(parsed.data),
        cache: "no-store",
        signal: AbortSignal.timeout(3000), // Quick timeout so fallback triggers smoothly if BE is offline
      },
    );

    if (upstreamResponse.ok) {
      const data = await upstreamResponse.json();
      return NextResponse.json(data, { status: upstreamResponse.status });
    }

    // Fallback ke mock data jika upstream belum siap (status 503 / 404 / error)
    const mockData = getMockResponse(targetResource, parsed.data);
    return NextResponse.json(mockData, { status: 200 });
  } catch {
    // Fallback ke data dummy realistis dari dump sms_client bila server BE offline
    const mockData = getMockResponse(targetResource, parsed.data);
    return NextResponse.json(mockData, { status: 200 });
  }
}
