/*
IMPORT YANG DIGUNAKAN
import { getApiBaseUrl } from "@/shared/api/config";
import { requestSchemas, responseSchemas, type ... } from "@/shared/api/spf-contracts";

KENAPA IMPORT INI DIPERLUKAN
- `getApiBaseUrl`: mengikuti environment resolution existing; tidak hardcode host/port.
- schemas: request divalidasi sebelum kirim dan response divalidasi sebelum masuk UI.
- imported types: page/component mendapat readonly contract yang sama tanpa type bayangan.

PUBLIC FUNCTIONS
- fetchSpfPeriods(cookieHeader, query), fetchSpfPeriodDetail(cookieHeader, id)
- fetchSpfItems(cookieHeader, query), fetchSpfItemDetail(cookieHeader, id)
- fetchSpfSources(cookieHeader, query)
- mutateSpf(resource, input, signal?) untuk Client Component via same-origin BFF

KENAPA FUNGSI DIPISAH
Read server memerlukan cookie forwarding dan status untuk redirect; mutation client memerlukan
same-origin credentials serta hasil discriminated agar form dapat menampilkan expected error.
Keduanya tetap memakai private `post` yang sama supaya parsing/error mapping tidak bercabang.

SERVER FETCH TEMPLATE
async function serverPost(resource, input, cookieHeader) {
  const request = requestSchemas[resource].parse(input);
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/spf/${resource}`, {
      method:"POST", headers:{"content-type":"application/json", cookie:cookieHeader},
      body:JSON.stringify(request), cache:"no-store" });
    if (!response.ok) return { payload:null, status:response.status };
    return { payload:responseSchemas[resource].parse(await response.json()), status:response.status };
  } catch { return { payload:null, status:503 }; }
}

CLIENT MUTATION TEMPLATE: fetch `/api/spf/${resource}` with credentials same-origin,
parse safe envelope, return discriminated `{success:true,data}|{success:false,status,message,errorCode}`.
Do not throw expected 4xx into React; throw only programming/invariant errors.
LOGIC — one SPF API client
- Browser calls same-origin /api/spf/{resource}, credentials same-origin.
- Server calls shared server-only BFF function; do not duplicate secret/header logic.
- Parse every response envelope before data access.
- 400 validation, 401 login, 403 forbidden, 404 missing, 409 stale workflow,
  429 retry guidance, 5xx unavailable. Do not expose internal messages.
- Abort reads on unmount. Never auto-retry mutations; list may retry one network error.

PSEUDOCODE
response = fetch('/api/spf/' + resource, POST validated JSON, no-store)
envelope = responseSchema.safeParse(await response.json())
if !envelope.success -> throw INVALID_RESPONSE
if !response.ok -> throw ApiError(response.status, safeCode, safeMessage)
return envelope.data

SELESAI JIKA: pages tidak mengenal URL/header backend dan components tidak parse raw JSON.
*/
