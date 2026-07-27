/*
IMPORT: "use client"; useRef/useState/useTransition; useRouter; mutateSpf; media types.
KENAPA IMPORT INI DIPERLUKAN: ref reset input file; state menyimpan validation/confirm;
transition memberi pending; router refresh media; mutateSpf menjaga secret di BFF; types menjaga response.
PROPS: readonly itemId/media/editable. KODE: input type=file with accept allowlist;
validate name/MIME/size, FileReader.readAsDataURL, remove prefix to file_data, upload once.
KENAPA KODE INI: backend menerima Base64, tetapi file divalidasi sebelum encoding karena Base64
membesar sekitar sepertiga. Reset memungkinkan file sama dipilih ulang.
Reset input after success. Abort FileReader on cleanup. Use native img only if existing image
policy permits remote host; otherwise render download link returned by API.
LOGIC: Validate agreed MIME types and effective Base64 payload below backend limit.
Read as Base64 only after validation, then send UPLOAD_MEDIA once.
Preview/link only URLs returned by backend; never infer bucket URLs.
DELETE_MEDIA requires confirmation. Abort file read/request on unmount.
SELESAI JIKA: invalid file ditolak sebelum request, pending tunggal, upload/delete refresh,
dan keyboard/screen reader menerima status hasil.
*/
