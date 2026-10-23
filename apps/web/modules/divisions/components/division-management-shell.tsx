"use client";

import type { ColDef } from "ag-grid-community";
import type { DivisionManagementRecord, MasterJobTypeRecord } from "@/shared/api/divisions/divisions";
import {
  createDivision,
  createDivisionMasterJobdesc,
  deleteDivision,
  deleteDivisionMasterJobdesc,
  updateDivision,
  updateDivisionMasterJobdesc,
} from "@/shared/api/divisions/divisions";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SmsAgGrid } from "@/shared/datagrid/sms-ag-grid";

interface DivisionManagementShellProps {
  divisions: DivisionManagementRecord[];
  generalJobTypes: MasterJobTypeRecord[];
}

export function DivisionManagementShell({ divisions, generalJobTypes }: DivisionManagementShellProps) {
  const [rows, setRows] = useState(divisions);
  const [generalRows, setGeneralRows] = useState(generalJobTypes);
  const [isGeneralSelected, setIsGeneralSelected] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState(divisions[0]?.id ?? 0);
  const [memberDivisionId, setMemberDivisionId] = useState<number | null>(null);
  const memberDialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobName, setJobName] = useState("");
  const [isTeknis, setIsTeknis] = useState(true);
  const [editingJobTypeId, setEditingJobTypeId] = useState<string | null>(null);
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [divisionFormMode, setDivisionFormMode] = useState<"create" | "edit" | null>(null);
  const [divisionForm, setDivisionForm] = useState({
    id: 0,
    name: "",
    code: "",
    isTeknis: true,
    parentId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((division) =>
      [
        division.name,
        division.code,
        ...division.jobTypes.map((jobType) => jobType.jobName),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  const selectedDivision = isGeneralSelected
    ? null
    : rows.find((division) => division.id === selectedDivisionId) ?? rows[0] ?? null;
  const visibleJobTypes = isGeneralSelected ? generalRows : selectedDivision?.jobTypes ?? [];
  const filteredJobTypes = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return visibleJobTypes;

    return visibleJobTypes.filter((jobType) =>
      [
        jobType.jobName,
        jobType.isTeknis ? "teknis" : "non teknis",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [jobSearch, visibleJobTypes]);
  const isEditing = editingJobTypeId !== null;
  const memberDivision = rows.find((division) => division.id === memberDivisionId);
  const activeMembers = memberDivision?.members.filter((member) => member.isActive) ?? [];

  useEffect(() => {
    const dialog = memberDialogRef.current;
    if (memberDivisionId !== null && dialog && !dialog.open) dialog.showModal();
    if (memberDivisionId === null && dialog?.open) dialog.close();
  }, [memberDivisionId]);

  function resetJobForm() {
    setEditingJobTypeId(null);
    setJobName("");
    setIsTeknis(true);
    setIsJobFormOpen(false);
  }

  function replaceJobType(jobType: MasterJobTypeRecord) {
    if (jobType.divisionId === null) {
      setGeneralRows((currentRows) =>
        currentRows.map((row) => (row.id === jobType.id ? jobType : row)),
      );
      return;
    }

    setRows((currentRows) =>
      currentRows.map((division) =>
        division.id === jobType.divisionId
          ? {
              ...division,
              jobTypes: division.jobTypes.map((row) => (row.id === jobType.id ? jobType : row)),
            }
          : division,
      ),
    );
  }

  function removeJobType(jobType: MasterJobTypeRecord) {
    if (jobType.divisionId === null) {
      setGeneralRows((currentRows) => currentRows.filter((row) => row.id !== jobType.id));
      return;
    }

    setRows((currentRows) =>
      currentRows.map((division) =>
        division.id === jobType.divisionId
          ? {
              ...division,
              jobTypes: division.jobTypes.filter((row) => row.id !== jobType.id),
            }
          : division,
      ),
    );
  }

  function openEditJobType(jobType: MasterJobTypeRecord) {
    setEditingJobTypeId(jobType.id);
    setJobName(jobType.jobName);
    setIsTeknis(jobType.isTeknis);
    setIsJobFormOpen(true);
    setError(null);
    setMessage(null);
  }

  function openCreateDivision() {
    setDivisionFormMode("create");
    setDivisionForm({
      id: 0,
      name: "",
      code: "",
      isTeknis: true,
      parentId: "",
    });
    setError(null);
    setMessage(null);
  }

  function openEditDivision(division: DivisionManagementRecord) {
    setDivisionFormMode("edit");
    setDivisionForm({
      id: division.id,
      name: division.name,
      code: division.code,
      isTeknis: division.isTeknis,
      parentId: division.parentId === null ? "" : String(division.parentId),
    });
    setError(null);
    setMessage(null);
  }

  function closeDivisionForm() {
    setDivisionFormMode(null);
  }

  async function handleDivisionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!divisionForm.name.trim() || !divisionForm.code.trim()) {
      setError("Nama dan kode divisi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const payload = {
      name: divisionForm.name.trim(),
      code: divisionForm.code.trim(),
      isTeknis: divisionForm.isTeknis,
      parentId: divisionForm.parentId ? Number.parseInt(divisionForm.parentId, 10) : null,
    };

    const result =
      divisionFormMode === "edit"
        ? await updateDivision(divisionForm.id, payload)
        : await createDivision(payload);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setRows((currentRows) => {
      const nextRows =
        divisionFormMode === "edit"
          ? currentRows.map((division) =>
              division.id === result.division.id
                ? { ...result.division, jobTypes: division.jobTypes, members: division.members }
                : division,
            )
          : [...currentRows, result.division];

      return nextRows.sort((left, right) => left.name.localeCompare(right.name));
    });
    setSelectedDivisionId(result.division.id);
    setIsGeneralSelected(false);
    setMessage(divisionFormMode === "edit" ? "Divisi berhasil diperbarui." : "Divisi berhasil ditambahkan.");
    closeDivisionForm();
    setIsSubmitting(false);
  }

  async function handleDeleteDivision(division: DivisionManagementRecord) {
    const confirmed = window.confirm(`Hapus divisi "${division.name}"?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await deleteDivision(division.id);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setRows((currentRows) => currentRows.filter((row) => row.id !== division.id));
    if (selectedDivisionId === division.id) {
      const nextDivision = rows.find((row) => row.id !== division.id);
      setSelectedDivisionId(nextDivision?.id ?? 0);
      setIsGeneralSelected(!nextDivision);
    }
    setMessage("Divisi berhasil dihapus.");
    setIsSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobName.trim()) {
      setError("Isi nama master jobdesc.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const result = isEditing
      ? await updateDivisionMasterJobdesc(editingJobTypeId, {
          jobName: jobName.trim(),
          isTeknis,
        })
      : await createDivisionMasterJobdesc(isGeneralSelected ? null : selectedDivision?.id ?? null, {
          jobName: jobName.trim(),
          isTeknis,
        });

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    if (isEditing) {
      replaceJobType(result.jobType);
    } else if (isGeneralSelected) {
      setGeneralRows((currentRows) =>
        [...currentRows, result.jobType].sort((left, right) => left.jobName.localeCompare(right.jobName)),
      );
    } else if (selectedDivision) {
      setRows((currentRows) =>
        currentRows.map((division) =>
          division.id === selectedDivision.id
            ? {
                ...division,
                jobTypes: [...division.jobTypes, result.jobType].sort((left, right) =>
                  left.jobName.localeCompare(right.jobName),
                ),
              }
            : division,
        ),
      );
    }
    resetJobForm();
    setMessage(isEditing ? "Master jobdesc berhasil diperbarui." : "Master jobdesc berhasil ditambahkan.");
    setIsSubmitting(false);
  }

  async function handleDeleteJobType(jobType: MasterJobTypeRecord) {
    const confirmed = window.confirm(`Hapus master jobdesc "${jobType.jobName}"?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await deleteDivisionMasterJobdesc(jobType.id);
    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    removeJobType(jobType);
    if (editingJobTypeId === jobType.id) {
      resetJobForm();
    }
    setMessage("Master jobdesc berhasil dihapus.");
    setIsSubmitting(false);
  }

  const divisionColumnDefs = useMemo<ColDef<DivisionManagementRecord>[]>(
    () => [
      {
        headerName: "Divisi / Team",
        minWidth: 240,
        flex: 1,
        valueGetter: ({ data }) => {
          if (!data) return "";
          const parent = rows.find((division) => division.id === data.parentId);
          return parent ? `${parent.name} / ${data.name}` : data.name;
        },
      },
      { field: "code", headerName: "Kode", width: 92 },
      { field: "userCount", headerName: "Pegawai", width: 96 },
      { field: "activeUserCount", headerName: "Aktif", width: 82 },
      { headerName: "Jobdesc", width: 100, valueGetter: ({ data }) => data?.jobTypes.length ?? 0 },
      {
        field: "isTeknis",
        headerName: "Teknis",
        width: 82,
        cellRenderer: ({ value }: { value?: boolean }) => (
          <input type="checkbox" checked={Boolean(value)} readOnly tabIndex={-1} aria-label={value ? "Divisi teknis" : "Divisi nonteknis"} className="h-4 w-4 accent-primary" />
        ),
      },
      {
        headerName: "Aksi",
        sortable: false,
        filter: false,
        width: 142,
        cellRenderer: ({ data }: { data?: DivisionManagementRecord }) => {
          if (!data) return null;
          return (
            <div className="flex h-full items-center justify-center gap-1">
              <button type="button" onClick={(event) => { event.stopPropagation(); openEditDivision(data); }} className="inline-flex h-8 items-center gap-1 border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" /> Ubah
              </button>
              <button type="button" onClick={(event) => { event.stopPropagation(); void handleDeleteDivision(data); }} className="inline-flex h-8 items-center gap-1 border border-destructive/35 px-2 text-xs text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            </div>
          );
        },
      },
    ],
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      {(message || error) && (
        <div aria-live="polite" className={message ? "border border-success/30 bg-success/[0.06] px-3 py-2 text-sm text-success" : "border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive"}>
          {message ?? error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="flex min-w-0 flex-col border border-border bg-background" aria-label="Daftar divisi dan tim">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Struktur kerja</p>
                <h2 className="mt-0.5 text-lg font-semibold text-foreground">Divisi dan tim</h2>
              </div>
              <button type="button" onClick={openCreateDivision} className="inline-flex h-10 items-center gap-2 border border-primary/40 bg-primary/[0.06] px-3 text-sm text-app-accent-ink transition-colors hover:bg-primary/10">
                <Plus className="h-4 w-4" />
                Tambah divisi
              </button>
            </div>
            <div className="flex items-center gap-2 border border-border bg-card px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input aria-label="Cari divisi atau jobdesc" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari divisi, kode, atau jobdesc..." className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" />
            </div>
          </div>

          {divisionFormMode && (
            <form className="space-y-3 border-b border-border bg-card p-4" onSubmit={(event) => void handleDivisionSubmit(event)}>
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{divisionFormMode === "edit" ? "Ubah divisi atau tim" : "Divisi atau tim baru"}</h3><button type="button" onClick={closeDivisionForm} aria-label="Tutup form divisi" className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Nama</span><input value={divisionForm.name} onChange={(event) => setDivisionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Body work" className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" /></label>
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Kode</span><input value={divisionForm.code} onChange={(event) => setDivisionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="BODY" className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Divisi induk</span><select value={divisionForm.parentId} onChange={(event) => setDivisionForm((current) => ({ ...current, parentId: event.target.value }))} className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary"><option value="">Tidak ada, divisi utama</option>{rows.filter((division) => division.id !== divisionForm.id).map((division) => <option key={division.id} value={division.id}>{division.name} ({division.code})</option>)}</select></label>
                <label className="flex h-10 items-center gap-2 border border-border bg-background px-3 text-sm text-foreground"><input type="checkbox" checked={divisionForm.isTeknis} onChange={(event) => setDivisionForm((current) => ({ ...current, isTeknis: event.target.checked }))} className="h-4 w-4 accent-primary" /> Divisi teknis</label>
              </div>
              <div className="flex justify-end"><button type="submit" disabled={isSubmitting} className="h-10 border border-primary/40 bg-primary/[0.06] px-4 text-sm text-app-accent-ink hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Menyimpan..." : "Simpan divisi"}</button></div>
            </form>
          )}

          <button type="button" onClick={() => { resetJobForm(); setIsGeneralSelected(true); }} className={["flex items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors", isGeneralSelected ? "bg-primary/[0.08] text-app-accent-ink" : "text-muted-foreground hover:bg-muted hover:text-foreground"].join(" ")}>
            <span><span className="block text-sm font-medium">Pekerjaan umum</span><span className="mt-0.5 block text-xs">Dipakai oleh semua divisi</span></span><span className="font-mono text-xs">{generalRows.length}</span>
          </button>
          <div className="min-h-[22rem] flex-1">
            <SmsAgGrid<DivisionManagementRecord> rowData={filteredRows} columnDefs={divisionColumnDefs} getRowId={({ data }) => String(data.id)} onRowClicked={({ data }) => { if (!data) return; resetJobForm(); setIsGeneralSelected(false); setSelectedDivisionId(data.id); }} onRowDoubleClicked={({ data }) => { if (data) setMemberDivisionId(data.id); }} rowClassRules={{ "ag-row-selected": ({ data }) => data?.id === selectedDivision?.id && !isGeneralSelected }} heightClassName="h-[calc(100dvh-22rem)] min-h-[22rem]" defaultColDef={{ filter: true, floatingFilter: true }} emptyMessage="Belum ada divisi atau tim." />
          </div>
        </section>

        <aside className="flex min-h-[42rem] min-w-0 flex-col border border-border bg-background xl:h-[calc(100dvh-10rem)]" aria-label="Master jobdesc">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Daftar pekerjaan</p>
                <h2 className="mt-0.5 break-words text-lg font-semibold text-foreground">{isGeneralSelected ? "Pekerjaan umum" : selectedDivision?.name ?? "Pilih divisi di sebelah kiri"}</h2>
                {selectedDivision && !isGeneralSelected && <p className="mt-1 text-xs text-muted-foreground">{selectedDivision.code} · {selectedDivision.activeUserCount} pegawai aktif · {visibleJobTypes.length} jobdesc</p>}
              </div>
              <button type="button" onClick={() => { resetJobForm(); setIsJobFormOpen(true); }} disabled={!isGeneralSelected && !selectedDivision} className="inline-flex h-10 shrink-0 items-center gap-2 border border-primary/40 bg-primary/[0.06] px-3 text-sm text-app-accent-ink hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" /> Tambah jobdesc</button>
            </div>
            <div className="flex items-center gap-2 border border-border bg-card px-3"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input aria-label="Cari master jobdesc" value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Cari pekerjaan..." className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" /></div>
          </div>

          {isJobFormOpen && (
            <form className="space-y-3 border-b border-border bg-card p-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{isEditing ? "Ubah jobdesc" : "Jobdesc baru"}</h3><button type="button" onClick={resetJobForm} aria-label="Tutup form jobdesc" className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
              <label className="block space-y-1"><span className="text-xs text-muted-foreground">Nama pekerjaan</span><input autoFocus value={jobName} onChange={(event) => setJobName(event.target.value)} placeholder="Contoh: Pemasangan panel" className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" /></label>
              <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={isTeknis} onChange={(event) => setIsTeknis(event.target.checked)} className="h-4 w-4 accent-primary" /> Pekerjaan teknis</label><button type="submit" disabled={isSubmitting} className="h-10 border border-primary/40 bg-primary/[0.06] px-4 text-sm text-app-accent-ink hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Menyimpan..." : isEditing ? "Simpan perubahan" : "Simpan jobdesc"}</button></div>
            </form>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Daftar jobdesc">
            {filteredJobTypes.length ? <ul className="divide-y divide-border">{filteredJobTypes.map((jobType) => <li key={jobType.id} className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60"><div className="min-w-0"><p className="break-words text-sm font-medium text-foreground">{jobType.jobName}</p><p className="mt-0.5 text-xs text-muted-foreground">{jobType.isTeknis ? "Pekerjaan teknis" : "Pekerjaan nonteknis"}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => openEditJobType(jobType)} className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Ubah ${jobType.jobName}`} title="Ubah jobdesc"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void handleDeleteJobType(jobType)} className="inline-flex h-9 w-9 items-center justify-center border border-destructive/30 text-destructive hover:bg-destructive/10" aria-label={`Hapus ${jobType.jobName}`} title="Hapus jobdesc"><Trash2 className="h-3.5 w-3.5" /></button></div></li>)}</ul> : <div className="px-6 py-12 text-center"><p className="text-sm text-foreground">{jobSearch ? "Jobdesc tidak ditemukan." : "Belum ada jobdesc."}</p><p className="mt-1 text-sm text-muted-foreground">{jobSearch ? "Ubah kata kunci pencarian atau tambahkan jobdesc baru." : "Tambahkan pekerjaan yang biasa dikerjakan oleh divisi ini."}</p></div>}
          </div>
        </aside>
      </div>
      <dialog ref={memberDialogRef} onClose={() => setMemberDivisionId(null)} aria-labelledby="division-members-title" className="m-auto w-[min(32rem,calc(100%-2rem))] max-h-[80vh] border border-border bg-card p-0 text-foreground backdrop:bg-black/60">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div><h2 id="division-members-title" className="text-base font-semibold">Anggota {memberDivision?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{activeMembers.length} pegawai aktif</p></div>
          <button type="button" onClick={() => setMemberDivisionId(null)} aria-label="Tutup daftar anggota" className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {activeMembers.length ? <ul className="divide-y divide-border">{activeMembers.map((member) => <li key={member.employeeId} className="px-4 py-3"><p className="text-sm font-medium">{member.fullName}</p><p className="mt-1 text-xs text-muted-foreground">{member.employeeId}</p></li>)}</ul> : <p className="p-6 text-sm text-muted-foreground">Belum ada pegawai aktif di divisi ini.</p>}
        </div>
      </dialog>
    </div>
  );
}
