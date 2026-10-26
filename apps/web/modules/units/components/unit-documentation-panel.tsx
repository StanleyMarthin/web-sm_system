"use client";

import type { UnitMedia, UnitMediaFolder } from "@smsystem/contracts/unit";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createUnitMedia, createUnitMediaFolder, deleteUnitMedia, deleteUnitMediaFolder, fetchUnitMedia, updateUnitMedia, updateUnitMediaFolder } from "@/shared/api/units/units";
import { useSweetAlert } from "@/shared/ui/sweet-alert";

type FormMode = "reference" | "category" | null;

const inputClass = "h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
const buttonClass = "inline-flex h-9 items-center justify-center border px-3 text-sm font-medium outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";
const LIST_PAGE_SIZE = 20;

export function UnitDocumentationPanel({ unitId, canManage }: { unitId: string; canManage: boolean }) {
  const sweetAlert = useSweetAlert();
  const [folders, setFolders] = useState<UnitMediaFolder[]>([]);
  const [media, setMedia] = useState<UnitMedia[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [referenceFolderId, setReferenceFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(preferredFolderId?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUnitMedia(unitId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setFolders(result.result.folders);
      setMedia(result.result.media);
      setSelectedFolderId((current) => {
        if (preferredFolderId && result.result.folders.some((folder) => folder.id === preferredFolderId)) return preferredFolderId;
        return current && result.result.folders.some((folder) => folder.id === current) ? current : "";
      });
    } catch {
      setError("Referensi belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [unitId]);
  useEffect(() => { setVisibleCount(LIST_PAGE_SIZE); }, [search, selectedFolderId]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const editingFolder = folders.find((folder) => folder.id === editingFolderId) ?? null;
  const editingFolderReferenceCount = editingFolder
    ? media.filter((item) => item.folderId === editingFolder.id).length
    : 0;
  const filteredReferences = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return media.filter((item) => (!selectedFolderId || item.folderId === selectedFolderId)
      && (!term || `${item.caption ?? ""} ${item.folderName}`.toLocaleLowerCase().includes(term)));
  }, [media, search, selectedFolderId]);
  const visibleReferences = filteredReferences.slice(0, visibleCount);

  function closeForm() {
    setFormMode(null);
    setEditingMediaId(null);
    setEditingFolderId(null);
    setFolderName("");
    setReferenceName("");
    setDriveUrl("");
    setReferenceFolderId("");
  }

  function openReference(item?: UnitMedia) {
    setError(null);
    setFormMode("reference");
    setEditingMediaId(item?.id ?? null);
    setReferenceFolderId(item?.folderId || selectedFolderId || folders[0]?.id || "");
    setReferenceName(item?.caption ?? "");
    setDriveUrl(item?.mediaUrl ?? "");
  }

  function openCategory() {
    if (!selectedFolder) return;
    setError(null);
    setFormMode("category");
    setEditingFolderId(selectedFolder.id);
    setFolderName(selectedFolder.name);
  }

  function openNewCategory() {
    setError(null);
    setFormMode("category");
    setEditingFolderId(null);
    setFolderName("");
  }

  async function saveCategory() {
    const name = folderName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const result = editingFolderId
      ? await updateUnitMediaFolder(unitId, editingFolderId, name)
      : await createUnitMediaFolder(unitId, name);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    const preferredFolderId = editingFolderId ?? result.result.id;
    closeForm();
    await load(preferredFolderId);
    sweetAlert.notifySuccess(editingFolderId ? "Kategori diperbarui" : "Kategori ditambahkan");
  }

  async function saveReference() {
    if (!referenceFolderId || !driveUrl.trim()) return;
    setBusy(true);
    setError(null);
    const result = editingMediaId
      ? await updateUnitMedia(unitId, editingMediaId, { folderId: referenceFolderId, mediaUrl: driveUrl.trim(), caption: referenceName.trim() || null })
      : await createUnitMedia({ unitId, folderId: referenceFolderId, mediaType: "REFERENCE", source: "LINK", mediaUrl: driveUrl.trim(), caption: referenceName.trim() || null });
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    closeForm();
    await load();
    sweetAlert.notifySuccess(editingMediaId ? "Referensi diperbarui" : "Referensi ditambahkan");
  }

  async function removeReference(item: UnitMedia) {
    const confirmed = await sweetAlert.confirm({
      title: "Hapus referensi?",
      description: `Referensi ${item.caption || "ini"} akan dihapus dari unit ini. Tautan sumber tidak ikut dihapus.`,
      tone: "error",
      confirmLabel: "Hapus",
    });
    if (!confirmed) return;
    setBusy(true);
    const result = await deleteUnitMedia(unitId, item.id);
    setBusy(false);
    if (!result.success) {
      sweetAlert.notifyError("Referensi belum dihapus", result.message);
      return;
    }
    closeForm();
    await load();
    sweetAlert.notifySuccess("Referensi dihapus");
  }

  async function removeCategory() {
    if (!editingFolderId || !editingFolder) return;
    if (editingFolderReferenceCount > 0) {
      sweetAlert.notifyWarning("Kategori masih berisi referensi", `Pindahkan atau hapus ${editingFolderReferenceCount} referensi terlebih dahulu.`);
      return;
    }
    const confirmed = await sweetAlert.confirm({
      title: "Hapus kategori?",
      description: `Kategori ${editingFolder.name} akan dihapus.`,
      tone: "error",
      confirmLabel: "Hapus",
    });
    if (!confirmed) return;
    setBusy(true);
    const result = await deleteUnitMediaFolder(unitId, editingFolderId);
    setBusy(false);
    if (!result.success) {
      sweetAlert.notifyError("Kategori belum dihapus", result.message);
      return;
    }
    closeForm();
    await load();
    sweetAlert.notifySuccess("Kategori dihapus");
  }

  return <>
    <section className="border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-foreground">Referensi <span className="text-muted-foreground">({media.length})</span></h2>
      {canManage ? <div className="flex items-center gap-2">
        <button type="button" disabled={busy || folders.length === 0} title={folders.length === 0 ? "Buat kategori terlebih dahulu" : undefined} onClick={() => openReference()} className={`${buttonClass} border-primary/50 bg-primary/10 text-app-accent-ink hover:bg-primary/20`}><Plus className="mr-1 h-3.5 w-3.5" />Tambah referensi</button>
        <button type="button" disabled={busy} onClick={openNewCategory} className={`${buttonClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground`}>Kategori baru</button>
      </div> : null}
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      <label className="min-w-48 flex-1"><span className="sr-only">Cari referensi</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari referensi" className={inputClass} /></label>
      <select aria-label="Filter kategori referensi" value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)} className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 dark:[color-scheme:dark]">
        <option value="">Semua kategori</option>
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select>
      {canManage && selectedFolder ? <button type="button" disabled={busy} onClick={openCategory} className={`${buttonClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground`}><Pencil className="mr-1 h-3.5 w-3.5" />Kelola kategori</button> : null}
    </div>

    {canManage && formMode ? <div className="mt-3 border border-border bg-background p-3">
      {formMode === "category" ? <div><p className="text-sm font-medium text-foreground">{editingFolderId ? "Ubah kategori" : "Kategori baru"}</p><div className="mt-3 flex flex-wrap gap-2"><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Nama kategori" className="h-9 min-w-52 flex-1 border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /><button type="button" disabled={busy || !folderName.trim()} onClick={() => void saveCategory()} className={`${buttonClass} border-primary/50 bg-primary/10 text-app-accent-ink hover:bg-primary/20`}>Simpan</button><button type="button" disabled={busy} onClick={closeForm} className={`${buttonClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground`}>Batal</button>{editingFolderId ? <button type="button" disabled={busy} onClick={() => void removeCategory()} className={`${buttonClass} border-destructive/40 text-destructive hover:bg-destructive/10`}><Trash2 className="mr-1 h-3.5 w-3.5" />Hapus</button> : null}</div>{editingFolderId && editingFolderReferenceCount > 0 ? <p className="mt-2 text-xs text-muted-foreground">Kategori ini berisi {editingFolderReferenceCount} referensi. Pindahkan atau hapus referensinya sebelum menghapus kategori.</p> : null}</div> : null}
      {formMode === "reference" ? <div><p className="text-sm font-medium text-foreground">{editingMediaId ? "Ubah referensi" : "Referensi baru"}</p><div className="mt-3 grid gap-2 md:grid-cols-[11rem_minmax(0,1fr)]"><select aria-label="Kategori referensi" value={referenceFolderId} onChange={(event) => setReferenceFolderId(event.target.value)} className="h-9 border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 dark:[color-scheme:dark]">{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><input value={referenceName} onChange={(event) => setReferenceName(event.target.value)} placeholder="Nama referensi (opsional)" className="h-9 w-full border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /><input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} placeholder="Tautan katalog, wiring, atau dokumen" className="md:col-span-2 h-9 w-full border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !referenceFolderId || !driveUrl.trim()} onClick={() => void saveReference()} className={`${buttonClass} border-primary/50 bg-primary/10 text-app-accent-ink hover:bg-primary/20`}>Simpan</button><button type="button" disabled={busy} onClick={closeForm} className={`${buttonClass} border-border text-muted-foreground hover:bg-muted hover:text-foreground`}>Batal</button>{editingMediaId ? <button type="button" disabled={busy} onClick={() => { const item = media.find((entry) => entry.id === editingMediaId); if (item) void removeReference(item); }} className={`${buttonClass} border-destructive/40 text-destructive hover:bg-destructive/10`}><Trash2 className="mr-1 h-3.5 w-3.5" />Hapus referensi</button> : null}</div></div> : null}
    </div> : null}

    {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    {loading ? <p className="mt-3 text-sm text-muted-foreground">Memuat referensi...</p> : null}
    {!loading && filteredReferences.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Belum ada referensi yang cocok.</p> : null}
    {visibleReferences.length > 0 ? <div className="mt-3 divide-y border border-border">{visibleReferences.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.caption || "Tautan referensi"}</p><p className="truncate text-xs text-muted-foreground">{item.folderName}</p></div><div className="flex shrink-0 items-center gap-3"><a href={item.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-app-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30"><ExternalLink className="h-3.5 w-3.5" />Buka</a>{canManage ? <button type="button" onClick={() => openReference(item)} className="text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30">Kelola</button> : null}</div></div>)}</div> : null}
    {visibleCount < filteredReferences.length ? <button type="button" onClick={() => setVisibleCount((count) => count + LIST_PAGE_SIZE)} className="mt-3 text-sm text-app-accent-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30">Tampilkan 20 lagi</button> : null}
    </section>
    {sweetAlert.alertElement}
  </>;
}
