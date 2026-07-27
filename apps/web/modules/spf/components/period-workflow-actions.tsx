/*
IMPORT: "use client"; useTransition/useState; useRouter; mutateSpf; SpfRole/Period types;
existing confirmation/alert component.
KENAPA IMPORT INI DIPERLUKAN: state memilih action/dialog; transition memberi pending;
router refresh status terbaru; mutateSpf menjaga BFF; types membuat matrix exhaustive;
confirmation existing menghindari modal baru.
PROPS: readonly periodId/status/role.
KODE: pure `allowedAction(role,status)` returns readonly actions; render map; confirmation
stores selected action; execute builds discriminated request. REJECT alone shows textarea.
On failure keep dialog open; 409 calls router.refresh; success closes and refreshes.
KENAPA KODE INI: pure matrix mudah diuji; refresh menghindari optimistic state yang dapat
bertentangan dengan workflow backend.
LOGIC: Derive buttons from verified role + current status matrix.
ADMIN/DRAFT=SUBMIT; APPROVER/WAITING_APPROVAL=APPROVE|REJECT;
PUBLISHER/APPROVED=PUBLISH; PUBLISHER/PUBLISHED=UNPUBLISH.
Confirm every transition, prevent double submit, refresh on success or 409.
Reject reason is optional and <=2000. Backend remains authorization authority.
SELESAI JIKA: matriks role/status exhaustive, aksi dikonfirmasi, 409 refresh, focus pulih.
*/
