"use client";

import type { UnitMedia, UnitMediaFolder } from "@smsystem/contracts/unit";
import { ExternalLink, FolderPlus, ImagePlus, Link2, Star, Trash2, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createUnitMedia,
  createUnitMediaFolder,
  deleteUnitMedia,
  fetchUnitMedia,
  requestUnitMediaUploadTicket,
  updateUnitMedia,
} from "@/shared/api/units/units";

type QueueItem = { id: string; name: string; state: "Menunggu" | "Mengunggah" | "Menyimpan" | "Selesai" | "Gagal"; progress: number; error?: string };

function isSupportedFile(file: File) {
  return ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.type) && file.size > 0 && file.size <= (file.type === "video/mp4" ? 25 : 10) * 1024 * 1024;
}

function uploadWithWorker(file: File, uploadUrl: string, onProgress: (progress: number) => void): Promise<void> {
  const source = `self.onmessage = ({ data }) => { const xhr = new XMLHttpRequest(); xhr.open('PUT', data.uploadUrl); xhr.setRequestHeader('Content-Type', data.contentType); xhr.upload.onprogress = (event) => { if (event.lengthComputable) self.postMessage({ type: 'progress', progress: Math.round(event.loaded / event.total * 100) }); }; xhr.onload = () => self.postMessage({ type: xhr.status >= 200 && xhr.status < 300 ? 'done' : 'error', message: xhr.responseText || 'Upload gagal.' }); xhr.onerror = () => self.postMessage({ type: 'error', message: 'Koneksi unggahan terputus.' }); xhr.send(data.file); };`;
  const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ type: string; progress?: number; message?: string }>) => {
      if (event.data.type === "progress") onProgress(event.data.progress ?? 0);
      if (event.data.type === "done") { worker.terminate(); URL.revokeObjectURL(workerUrl); resolve(); }
      if (event.data.type === "error") { worker.terminate(); URL.revokeObjectURL(workerUrl); reject(new Error(event.data.message)); }
    };
    worker.onerror = () => { worker.terminate(); URL.revokeObjectURL(workerUrl); reject(new Error("Worker unggahan tidak dapat dijalankan.")); };
    worker.postMessage({ file, uploadUrl, contentType: file.type });
  });
}

export function UnitDocumentationPanel({ unitId, canManage }: { unitId: string; canManage: boolean }) {
  const [folders, setFolders] = useState<UnitMediaFolder[]>([]);
  const [media, setMedia] = useState<UnitMedia[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [driveType, setDriveType] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [caption, setCaption] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const result = await fetchUnitMedia(unitId);
    if (!result.success) { setError(result.message); return; }
    setFolders(result.result.folders);
    setMedia(result.result.media);
    setSelectedFolderId((current) => current && result.result.folders.some((folder) => folder.id === current) ? current : result.result.folders[0]?.id ?? "");
  }

  useEffect(() => { void load(); }, [unitId]);

  const selectedMedia = useMemo(() => media.filter((item) => !selectedFolderId || item.folderId === selectedFolderId), [media, selectedFolderId]);
  const updateQueue = (id: string, changes: Partial<QueueItem>) => setQueue((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));

  async function addFolder() {
    const name = folderName.trim();
    if (!name) return;
    setBusy(true); setError(null);
    const result = await createUnitMediaFolder(unitId, name);
    setBusy(false);
    if (!result.success) { setError(result.message); return; }
    setFolderName(""); setFolders((items) => [...items, result.result]); setSelectedFolderId(result.result.id);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !selectedFolderId) return;
    setError(null);
    setBusy(true);
    const pendingFiles = [...files];
    const items = pendingFiles.map((file) => ({ id: crypto.randomUUID(), name: file.name, state: "Menunggu" as const, progress: 0 }));
    setQueue((current) => [...items, ...current]);
    const folderId = selectedFolderId;
    const uploadCaption = caption.trim() || null;
    let nextIndex = 0;
    const runUpload = async (): Promise<void> => {
      const index = nextIndex++;
      if (index >= pendingFiles.length) return;
      const file = pendingFiles[index]!;
      const item = items[index]!;
      try {
        if (!isSupportedFile(file)) throw new Error("Gunakan JPG, PNG, WEBP maksimal 10 MB, atau MP4 maksimal 25 MB.");
        updateQueue(item.id, { state: "Mengunggah", progress: 0 });
        const ticket = await requestUnitMediaUploadTicket({ unitId, filename: file.name, contentType: file.type, size: file.size });
        if (!ticket.success) throw new Error(ticket.message);
        await uploadWithWorker(file, ticket.result.uploadUrl, (progress) => updateQueue(item.id, { progress }));
        updateQueue(item.id, { state: "Menyimpan", progress: 100 });
        const saved = await createUnitMedia({ unitId, folderId, mediaType: file.type === "video/mp4" ? "VIDEO" : "PHOTO", source: "UPLOAD", mediaUrl: ticket.result.publicUrl, caption: uploadCaption });
        if (!saved.success) throw new Error(saved.message);
        updateQueue(item.id, { state: "Selesai", progress: 100 });
      } catch (uploadError) {
        updateQueue(item.id, { state: "Gagal", error: uploadError instanceof Error ? uploadError.message : "Upload gagal." });
      }
      await runUpload();
    };
    await Promise.all(Array.from({ length: Math.min(3, pendingFiles.length) }, () => runUpload()));
    setBusy(false);
    await load();
  }

  async function addDriveLink() {
    if (!selectedFolderId || !driveUrl.trim()) return;
    setBusy(true); setError(null);
    const result = await createUnitMedia({ unitId, folderId: selectedFolderId, mediaType: driveType, source: "GOOGLE_DRIVE", mediaUrl: driveUrl.trim(), caption: caption.trim() || null });
    setBusy(false);
    if (!result.success) { setError(result.message); return; }
    setDriveUrl(""); setCaption(""); await load();
  }

  async function setCover(item: UnitMedia) {
    const result = await updateUnitMedia(unitId, item.id, { isCover: true });
    if (!result.success) { setError(result.message); return; }
    await load();
  }

  async function removeMedia(item: UnitMedia) {
    if (!window.confirm(`Hapus ${item.mediaType === "VIDEO" ? "video" : "foto"} ini?`)) return;
    const result = await deleteUnitMedia(unitId, item.id);
    if (!result.success) { setError(result.message); return; }
    await load();
  }

  return <section className="border border-border bg-card px-4 py-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Dokumentasi Unit</p><h2 className="mt-1 text-base font-semibold text-foreground">Penerimaan dan dokumen pendukung</h2><p className="mt-1 text-sm text-muted-foreground">Foto, video, atau tautan Google Drive yang bukan bagian dari progres pekerjaan.</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2">{folders.map((folder) => <button key={folder.id} type="button" onClick={() => setSelectedFolderId(folder.id)} className={`h-8 border px-3 text-xs font-medium ${selectedFolderId === folder.id ? "border-primary/50 bg-primary/10 text-app-accent-ink" : "border-border text-muted-foreground hover:text-foreground"}`}>{folder.name}</button>)}</div>
    {canManage ? <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="space-y-2"><p className="text-xs font-medium text-foreground">Tambah kategori</p><div className="flex gap-2"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Contoh: Kondisi awal" className="h-9 min-w-0 flex-1 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/55" /><button type="button" disabled={busy} onClick={() => void addFolder()} className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-xs text-foreground hover:bg-muted disabled:opacity-50"><FolderPlus className="h-3.5 w-3.5" />Kategori</button></div></div><div className="space-y-2"><p className="text-xs font-medium text-foreground">Keterangan</p><input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Opsional untuk unggahan atau tautan berikutnya" className="h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/55" /></div><div className="space-y-2"><p className="text-xs font-medium text-foreground">Unggah foto atau video</p><label className="flex h-10 cursor-pointer items-center justify-center gap-2 border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-app-accent-ink hover:bg-primary/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><Upload className="h-4 w-4" />Pilih file<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple disabled={busy} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} className="sr-only" /></label></div><div className="space-y-2"><p className="text-xs font-medium text-foreground">Tautan Google Drive</p><div className="flex gap-2"><select value={driveType} onChange={(event) => setDriveType(event.target.value === "VIDEO" ? "VIDEO" : "PHOTO")} className="h-10 border border-border bg-background px-2 text-xs text-foreground dark:[color-scheme:dark]"><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select><input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} placeholder="https://drive.google.com/..." className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/55" /><button type="button" disabled={busy || !driveUrl.trim()} onClick={() => void addDriveLink()} className="inline-flex h-10 items-center gap-1.5 border border-border px-3 text-xs text-foreground hover:bg-muted disabled:opacity-50"><Link2 className="h-3.5 w-3.5" />Simpan</button></div></div></div> : null}
    {queue.length > 0 ? <div className="mt-4 divide-y border border-border">{queue.map((item) => <div key={item.id} className="flex items-center gap-3 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span><span className={item.state === "Gagal" ? "text-destructive" : item.state === "Selesai" ? "text-success" : "text-muted-foreground"}>{item.state}{item.state === "Mengunggah" ? ` ${item.progress}%` : ""}</span>{item.error ? <span className="max-w-48 truncate text-destructive">{item.error}</span> : null}</div>)}</div> : null}
    {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{selectedMedia.map((item) => <article key={item.id} className="overflow-hidden border border-border bg-background"><div className="aspect-video bg-muted">{item.source === "UPLOAD" && item.mediaType === "PHOTO" ? <img src={item.mediaUrl} alt={item.caption ?? "Dokumentasi Unit"} className="h-full w-full object-cover" /> : item.source === "UPLOAD" ? <video src={item.mediaUrl} controls className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">{item.mediaType === "VIDEO" ? <Video className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}<span className="text-xs">Google Drive</span></div>}</div><div className="space-y-2 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-foreground">{item.mediaType === "VIDEO" ? "Video" : "Foto"}{item.isCover ? " · Sampul" : ""}</span><a href={item.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-foreground" title="Buka dokumentasi"><ExternalLink className="h-3.5 w-3.5" /></a></div>{item.caption ? <p className="line-clamp-2 text-xs text-muted-foreground">{item.caption}</p> : null}{canManage ? <div className="flex gap-2">{item.mediaType === "PHOTO" && !item.isCover ? <button type="button" onClick={() => void setCover(item)} className="inline-flex h-7 items-center gap-1 border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"><Star className="h-3 w-3" />Sampul</button> : null}<button type="button" onClick={() => void removeMedia(item)} className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive" title="Hapus"><Trash2 className="h-3 w-3" /></button></div> : null}</div></article>)}</div>
    {selectedMedia.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Belum ada dokumentasi pada kategori ini.</p> : null}
  </section>;
}
