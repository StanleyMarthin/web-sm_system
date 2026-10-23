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
import { useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobName, setJobName] = useState("");
  const [isTeknis, setIsTeknis] = useState(true);
  const [editingJobTypeId, setEditingJobTypeId] = useState<string | null>(null);
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

  function resetJobForm() {
    setEditingJobTypeId(null);
    setJobName("");
    setIsTeknis(true);
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
                ? { ...result.division, jobTypes: division.jobTypes }
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
        headerName: "Jenis",
        width: 105,
        valueFormatter: ({ value }) => (value ? "Teknis" : "Nonteknis"),
      },
      {
        headerName: "Aksi",
        sortable: false,
        filter: false,
        width: 82,
        cellRenderer: ({ data }: { data?: DivisionManagementRecord }) => {
          if (!data) return null;
          return (
            <div className="flex h-full items-center justify-center gap-1">
              <button type="button" title="Ubah divisi atau team" aria-label={`Ubah ${data.name}`} onClick={(event) => { event.stopPropagation(); openEditDivision(data); }} className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Hapus divisi atau team" aria-label={`Hapus ${data.name}`} onClick={(event) => { event.stopPropagation(); void handleDeleteDivision(data); }} className="inline-flex h-7 w-7 items-center justify-center border border-destructive/35 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
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

      <div className="grid gap-4 xl:grid-cols-[minmax(580px,1fr)_minmax(360px,0.8fr)]">
        <div className="flex min-w-0 flex-col space-y-3">
        {message ? (
          <div className="border border-success/20 bg-success/[0.04] px-3 py-2 text-[11px] font-mono text-success">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-[11px] font-mono text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 border border-border bg-card px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Cari divisi atau jobdesc"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari divisi atau master jobdesc..."
              className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
          <button
            type="button"
            onClick={openCreateDivision}
            className="inline-flex h-10 shrink-0 items-center gap-2 border border-primary/40 bg-primary/[0.06] px-3 text-sm text-app-accent-ink transition-colors hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" />
            Tambah Divisi
          </button>
        </div>

        {divisionFormMode ? (
          <form className="space-y-2 border border-white/5 bg-background p-3" onSubmit={(event) => void handleDivisionSubmit(event)}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">
                {divisionFormMode === "edit" ? "Edit Divisi" : "Tambah Divisi"}
              </p>
              <button
                type="button"
                onClick={closeDivisionForm}
                className="text-foreground/30 transition-colors hover:text-foreground/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <input
                value={divisionForm.name}
                onChange={(event) => setDivisionForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nama divisi"
                className="h-8 border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none transition-colors placeholder:text-foreground/20 focus:border-primary/40"
              />
              <input
                value={divisionForm.code}
                onChange={(event) => setDivisionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="Kode"
                className="h-8 border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none transition-colors placeholder:text-foreground/20 focus:border-primary/40"
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/30">Divisi Induk</span>
              <select
                value={divisionForm.parentId}
                onChange={(event) => setDivisionForm((current) => ({ ...current, parentId: event.target.value }))}
                className="h-8 w-full border border-white/10 bg-card px-3 text-[11px] font-mono text-foreground/70 outline-none focus:border-primary/40"
              >
                <option value="">Tidak ada (divisi utama)</option>
                {rows
                  .filter((division) => division.id !== divisionForm.id)
                  .map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name} ({division.code})
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[10px] font-mono text-foreground/45">
                <input
                  type="checkbox"
                  checked={divisionForm.isTeknis}
                  onChange={(event) => setDivisionForm((current) => ({ ...current, isTeknis: event.target.checked }))}
                  className="h-4 w-4 border-white/20 bg-transparent"
                />
                Teknis
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="border border-primary/40 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-app-accent-ink transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        ) : null}

        <button
          type="button"
          onClick={() => { resetJobForm(); setIsGeneralSelected(true); }}
          className={[
            "flex items-center justify-between border px-3 py-2 text-left text-sm transition-colors",
            isGeneralSelected
              ? "border-primary/40 bg-primary/[0.06] text-app-accent-ink"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          ].join(" ")}
        >
          <span>Master jobdesc umum</span>
          <span>{generalRows.length}</span>
        </button>
        <SmsAgGrid<DivisionManagementRecord>
          rowData={filteredRows}
          columnDefs={divisionColumnDefs}
          getRowId={({ data }) => String(data.id)}
          onRowClicked={({ data }) => {
            if (!data) return;
            resetJobForm();
            setIsGeneralSelected(false);
            setSelectedDivisionId(data.id);
          }}
          rowClassRules={{ "ag-row-selected": ({ data }) => data?.id === selectedDivision?.id && !isGeneralSelected }}
          heightClassName="h-[560px]"
          defaultColDef={{ filter: true, floatingFilter: true }}
          emptyMessage="Belum ada divisi atau team."
        />
      </div>

      <aside className="flex min-w-0 flex-col border border-border bg-background">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-sm text-muted-foreground">Master jobdesc</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {isGeneralSelected ? "Jobdesc Umum" : selectedDivision?.name ?? "Pilih divisi"}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground">
              {filteredJobTypes.length} / {visibleJobTypes.length}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 border border-border bg-card px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Cari master jobdesc"
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
              placeholder="Cari master jobdesc..."
              className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>
        </div>

        <div className="p-4">
          {filteredJobTypes.length ? (
            <div className="space-y-1.5">
              {filteredJobTypes.map((jobType) => (
                <div key={jobType.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                  <div className="min-w-0">
                    <span className="block break-words text-sm text-foreground">{jobType.jobName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {jobType.isTeknis ? "TEKNIS" : "NON TEKNIS"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditJobType(jobType)}
                      className="inline-flex h-9 w-9 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Ubah ${jobType.jobName}`}
                      title="Edit jobdesc"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteJobType(jobType)}
                      className="inline-flex h-9 w-9 items-center justify-center border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10"
                      aria-label={`Hapus ${jobType.jobName}`}
                      title="Hapus jobdesc"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-white/10 px-4 py-8 text-center text-[11px] font-mono text-foreground/25">
              {jobSearch ? `Tidak ada jobdesc untuk "${jobSearch}"` : "Belum ada master jobdesc untuk pilihan ini."}
            </p>
          )}
        </div>

        <form className="mt-auto space-y-3 border-t border-white/10 bg-card p-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {isEditing ? "Edit Jobdesc" : "Nama Jobdesc"}
              </span>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetJobForm}
                  className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.1em] text-foreground/30 transition-colors hover:text-foreground/60"
                >
                  <X className="h-3 w-3" />
                  Batal Edit
                </button>
              ) : null}
            </div>
            <input
              value={jobName}
              onChange={(event) => setJobName(event.target.value)}
              className="h-10 w-full border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            />
          </label>

          <label className="flex items-center gap-3 border border-white/5 bg-card px-3 py-2">
            <input
              type="checkbox"
              checked={isTeknis}
              onChange={(event) => setIsTeknis(event.target.checked)}
              className="h-4 w-4 border-white/20 bg-transparent"
            />
            <span className="text-sm text-foreground">Jobdesc teknis</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting || (!isGeneralSelected && !selectedDivision)}
            className="inline-flex h-10 items-center justify-center gap-2 border border-primary/40 bg-primary/[0.06] px-3 text-sm text-app-accent-ink transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Tambah Jobdesc"}
          </button>
        </form>
      </aside>
      </div>
    </div>
  );
}
