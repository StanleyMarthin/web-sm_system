import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getApiBaseUrl } from "@/shared/api/config";

const MAX_IMAGE_BYTES = Number(process.env.NEXT_PUBLIC_CATALOG_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

function normalizeContentType(file: File) {
  const type = file.type.split(";")[0]?.trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  return type || "";
}

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin) {
    try {
      if (new URL(requestOrigin).host !== (request.headers.get("host") ?? request.nextUrl.host)) {
        return errorResponse(403, "Origin request tidak diizinkan.");
      }
    } catch {
      return errorResponse(403, "Origin request tidak valid.");
    }
  }

  const form = await request.formData().catch(() => null);
  const unitId = String(form?.get("unitId") ?? "").trim();
  const file = form?.get("file");

  if (!unitId || !(file instanceof File)) {
    return errorResponse(400, "Unit dan gambar wajib diisi.");
  }

  const contentType = normalizeContentType(file);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return errorResponse(400, "Gunakan gambar jpg, jpeg, png, atau webp.");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return errorResponse(413, "Ukuran gambar melebihi batas upload.");
  }

  const params = new URLSearchParams({
    filename: file.name || "catalog-panel-image",
    contentType,
    size: String(file.size),
  });

  const cookie = request.headers.get("cookie") ?? "";
  let ticketResponse: Response;
  try {
    ticketResponse = await fetch(
      `${getApiBaseUrl()}/api/units/${encodeURIComponent(unitId)}/catalog/upload-ticket?${params}`,
      {
        headers: cookie ? { cookie } : undefined,
        cache: "no-store",
      },
    );
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "Upload ticket gagal dibuat.");
  }

  const ticketPayload = await ticketResponse.json().catch(() => null);
  if (!ticketResponse.ok || !ticketPayload?.success || !ticketPayload?.data?.uploadUrl) {
    return errorResponse(ticketResponse.status || 502, ticketPayload?.message ?? "Upload ticket gagal dibuat.");
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(ticketPayload.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: await file.arrayBuffer(),
    });
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "Gambar belum berhasil dikirim ke storage.");
  }
  if (!uploadResponse.ok) {
    return errorResponse(uploadResponse.status, "Gambar belum berhasil dikirim ke storage.");
  }

  return NextResponse.json({
    success: true,
    message: "Gambar siap disimpan.",
    data: { publicUrl: ticketPayload.data.publicUrl },
  });
}
