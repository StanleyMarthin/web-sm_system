/*
IMPORT YANG DIGUNAKAN
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { requestSchemas, type SpfResource } from "@/shared/api/spf-contracts";

KENAPA IMPORT INI DIPERLUKAN
- `server-only`: build gagal bila modul bersecret tidak sengaja diimport Client Component.
- `NextRequest`/`NextResponse`: akses cookie/header dan response Route Handler yang typed.
- `z`: memvalidasi data tak tepercaya sebelum menyentuh upstream.
- `requireAdminSession`: actor berasal dari session signed, bukan body/header browser.
- `requestSchemas`: FE dan BFF memakai batas mode/field yang sama; `SpfResource` menjaga allowlist.

KONSTANTA
const resources = new Set<SpfResource>(["source", "item", "period"]);
const upstreamBaseUrl = process.env.SPF_API_INTERNAL_URL?.replace(/\/$/u, "");
const adminApiKey = process.env.PORTAL_ADMIN_API_KEY;
Validasi kedua env saat server bootstrap; key minimum 32 chars. Jangan fallback.

STRUKTUR IMPLEMENTASI
export async function POST(request: NextRequest, context: { params: Promise<{resource:string}> }) {
  const session = await requireAdminSession(request.headers.get("cookie") ?? "");
  if (!session) return safeError(401, "UNAUTHORIZED", "Sesi berakhir.");
  if (!isSameOriginAndValidCsrf(request)) return safeError(403, "CSRF_INVALID", ...);
  const resource = (await context.params).resource;
  if (!resources.has(resource as SpfResource)) return safeError(404, "NOT_FOUND", ...);
  const raw = await readJsonWithLimit(request); // catch malformed/oversize -> 400/413
  const parsed = requestSchemas[resource].safeParse(raw);
  if (!parsed.success) return safeValidationError(parsed.error); // no stack
  const upstream = await fetch(`${upstreamBaseUrl}/api/spf/${resource}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "content-type":"application/json", authorization:`Bearer ${adminApiKey}`,
      "x-employee-id":session.employeeId, "x-admin-role":session.role },
    body: JSON.stringify(parsed.data),
  });
  return normalizeUpstream(upstream); // allowlist status/body fields only
}

KENAPA KODE INI DITULIS
BFF diperlukan karena backend memakai secret server. Browser hanya berbicara same-origin;
BFF memverifikasi session+CSRF, menambahkan actor terverifikasi, membatasi resource/body/time,
dan menyaring response. Tanpanya API key atau identity header dapat dipalsukan dari browser.

ERROR: timeout/network -> 503; invalid upstream JSON -> 502; 429 keeps Retry-After.
LOG: request ID, resource, mode, status, duration; never key, cookie, or file_data.
LOGIC — same-origin BFF; browser must never receive PORTAL_ADMIN_API_KEY.
1. requireAdminSession(request.cookies); absent -> 401.
2. Allow only resource source | item | period; otherwise 404.
3. Enforce CSRF using existing smsystem mechanism and validate JSON/body size.
4. Validate request with resource discriminated union.
5. POST to `${API_INTERNAL_URL}/api/spf/${resource}` with server-only Bearer key,
   verified session employee ID and verified role; cache no-store + timeout.
6. Preserve useful HTTP status, normalize safe envelope, strip upstream cookies,
   stack traces and hop-by-hop headers. Never log credentials or full file_data.

ENV: API_INTERNAL_URL and PORTAL_ADMIN_API_KEY are server-only; no NEXT_PUBLIC_ prefix.
PRODUCTION BLOCKER: backend currently trusts identity headers. Restrict endpoint to this
BFF/private network or replace them with a signed smsystem identity token.

SELESAI JIKA: browser bundle/search tidak mengandung secret dan forged identity test gagal.
*/
