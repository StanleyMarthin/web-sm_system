/*
IMPORT YANG DIGUNAKAN
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchSpfPeriodDetail } from "@/shared/api/spf";
import { PeriodDetailShell } from "@/modules/spf/components/period-detail-shell";

KENAPA IMPORT INI DIPERLUKAN
- `headers`: membawa session pada server fetch.
- `notFound`: ID invalid/missing memakai semantics 404 Next, bukan halaman error buatan.
- `redirect`: 401/403 keluar sebelum detail sensitif dirender.
- `fetchSpfPeriodDetail`: kontrak request/response terpusat dan tervalidasi.
- `PeriodDetailShell`: satu pemilik orchestration UI; page tetap tipis.

STRUKTUR KODE
interface Props { params: Promise<{ periodId: string }> }
export default async function PeriodDetailPage({ params }: Props) {
  const id = Number((await params).periodId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const cookie = (await headers()).get("cookie") ?? "";
  const result = await fetchSpfPeriodDetail(cookie, id);
  if (result.status === 401) redirect("/login");
  if (result.status === 403) redirect("/forbidden");
  if (result.status === 404) notFound();
  if (!result.payload) return <ModuleUnavailableState ... />;
  return <PeriodDetailShell period={...} items={...} role={...} editable={...} />;
}

PENJELASAN: jangan fetch detail di setiap child; satu snapshot server dibagi lewat readonly props.
KENAPA: satu fetch menghindari data berbeda antar summary, items, dan tombol workflow.
LOGIC — period detail/workflow
- Reject non-positive integer periodId before request; 404 uses notFound().
- Fetch detail server-side. Render actions only for valid role + current status.
- ADMIN: DRAFT -> SUBMIT -> WAITING_APPROVAL.
- APPROVER: WAITING_APPROVAL -> APPROVE -> APPROVED, or REJECT -> REJECTED.
- PUBLISHER: APPROVED -> PUBLISH -> PUBLISHED; PUBLISHED -> UNPUBLISH -> DRAFT.
- Mutation: disable double-submit, confirm, show safe result, router.refresh().
- On 409 refresh because another actor changed state.

SELESAI JIKA: semua status punya badge, aksi ilegal tidak muncul, backend denial tetap ditangani.
*/
