"use client";

import type { DivisionManagementRecord, MasterJobTypeRecord } from "@/shared/api/divisions";
import {
  createDivision,
  createDivisionMasterJobdesc,
  deleteDivision,
  deleteDivisionMasterJobdesc,
  updateDivision,
  updateDivisionMasterJobdesc,
} from "@/shared/api/divisions";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

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

  const globalActiveUserCount = useMemo(() => rows.reduce((sum, div) => sum + div.activeUserCount, 0), [rows]);
  const globalJobdescCount = useMemo(() => rows.reduce((sum, div) => sum + div.jobTypes.length, 0) + generalRows.length, [rows, generalRows]);

  return (
    <div className="flex flex-col gap-4">
      {/* 4 Summary Cards */}
      <div className="grid shrink-0 gap-3 md:grid-cols-4">
        {isGeneralSelected ? (
          <>
            <div className="border border-white/5 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Total Divisi</p>
              <p className="mt-1 text-[18px] font-mono text-white">{rows.length}</p>
            </div>
            <div className="border border-white/5 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Global User Aktif</p>
              <p className="mt-1 text-[18px] font-mono text-white">{globalActiveUserCount}</p>
            </div>
            <div className="border border-white/5 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Global Jobdesc</p>
              <p className="mt-1 text-[18px] font-mono text-white">{globalJobdescCount}</p>
            </div>
            <div className="border border-white/5 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Jobdesc Umum</p>
              <p className="mt-1 text-[18px] font-mono text-white">{generalRows.length}</p>
            </div>
          </>
        ) : (
          <>
            <div className="border border-amber-500/30 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500/60">Divisi Terpilih</p>
              <p className="mt-1 text-[16px] font-mono text-amber-500 truncate">{selectedDivision?.name}</p>
            </div>
            <div className="border border-amber-500/30 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500/60">Total User</p>
              <p className="mt-1 text-[18px] font-mono text-amber-500">{selectedDivision?.userCount}</p>
            </div>
            <div className="border border-amber-500/30 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500/60">User Aktif</p>
              <p className="mt-1 text-[18px] font-mono text-amber-500">{selectedDivision?.activeUserCount}</p>
            </div>
            <div className="border border-amber-500/30 bg-[#111114] px-4 py-3 transition-colors">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500/60">Total Jobdesc</p>
              <p className="mt-1 text-[18px] font-mono text-amber-500">{selectedDivision?.jobTypes.length}</p>
            </div>
          </>
        )}
      </div>

      <div className="grid h-[calc(100vh-180px)] min-h-[500px] gap-4 overflow-hidden xl:grid-cols-[450px_minmax(0,1fr)]">
        <div className="flex h-full flex-col space-y-3 overflow-hidden">
        {message ? (
          <div className="border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2 text-[11px] font-mono text-emerald-400">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[11px] font-mono text-red-400">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 border border-white/10 bg-[#111114] px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari divisi atau master jobdesc..."
              className="h-8 w-full bg-transparent text-[11px] font-mono text-white/70 outline-none placeholder:text-white/20"
            />
          </div>
          <button
            type="button"
            onClick={openCreateDivision}
            className="shrink-0 inline-flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10"
          >
            <Plus className="h-3 w-3" />
            Tambah Divisi
          </button>
        </div>

        {divisionFormMode ? (
          <form className="space-y-2 border border-white/5 bg-[#0a0a0c] p-3" onSubmit={(event) => void handleDivisionSubmit(event)}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                {divisionFormMode === "edit" ? "Edit Divisi" : "Tambah Divisi"}
              </p>
              <button
                type="button"
                onClick={closeDivisionForm}
                className="text-white/30 transition-colors hover:text-white/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <input
                value={divisionForm.name}
                onChange={(event) => setDivisionForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nama divisi"
                className="h-8 border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/40"
              />
              <input
                value={divisionForm.code}
                onChange={(event) => setDivisionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="Kode"
                className="h-8 border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors placeholder:text-white/20 focus:border-amber-500/40"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-[10px] font-mono text-white/45">
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
                className="border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto border border-white/5 bg-[#0a0a0c] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:hover:bg-white/30">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-[#111114]">
                <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Divisi</th>
                <th className="px-4 py-2 text-center text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Total User</th>
                <th className="px-4 py-2 text-center text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">User Aktif</th>
                <th className="px-4 py-2 text-center text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Jobdesc</th>
                <th className="px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Status</th>
                <th className="px-4 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                onClick={() => setIsGeneralSelected(true)}
                className={`cursor-pointer border-b-2 border-white/10 transition-colors ${
                  isGeneralSelected ? "bg-amber-500/[0.04] border-l-2 border-l-amber-500" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                }`}
              >
                <td className="px-4 py-2">
                  <p className="text-[12px] font-mono text-white/80">JOBDESC UMUM</p>
                  <p className="mt-0.5 text-[10px] font-mono text-white/25">GLOBAL · division_id NULL</p>
                </td>
                <td className="px-4 py-2 text-center text-[11px] font-mono text-white/20">-</td>
                <td className="px-4 py-2 text-center text-[11px] font-mono text-white/20">-</td>
                <td className="px-4 py-2 text-center text-[11px] font-mono text-white/55">{generalRows.length}</td>
                <td className="px-4 py-2">
                  <span className="border border-amber-500/20 bg-amber-500/[0.04] px-2 py-0.5 text-[9px] font-mono text-amber-400">
                    UMUM
                  </span>
                </td>
                <td className="px-4 py-2 text-right"></td>
              </tr>
              {filteredRows.map((division) => (
                <tr
                  key={division.id}
                  onClick={() => {
                    setIsGeneralSelected(false);
                    setSelectedDivisionId(division.id);
                  }}
                  className={`cursor-pointer border-b border-white/[0.04] transition-colors ${
                    selectedDivision?.id === division.id ? "bg-amber-500/[0.04] border-l-2 border-l-amber-500" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                  }`}
                >
                  <td className="px-4 py-2">
                    <p className="text-[12px] font-mono text-white/80">{division.name}</p>
                    <p className="mt-0.5 text-[10px] font-mono text-white/25">
                      {division.code} · ID {division.id}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-center text-[11px] font-mono text-white/55">{division.userCount}</td>
                  <td className="px-4 py-2 text-center text-[11px] font-mono text-white/55">{division.activeUserCount}</td>
                  <td className="px-4 py-2 text-center text-[11px] font-mono text-white/55">{division.jobTypes.length}</td>
                  <td className="px-4 py-2">
                    {division.isTeknis ? (
                      <span className="border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-0.5 text-[9px] font-mono text-emerald-400">
                        TEKNIS
                      </span>
                    ) : (
                      <span className="border border-white/10 px-2 py-0.5 text-[9px] font-mono text-white/25">
                        NON TEKNIS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDivision(division);
                      }}
                      className="mr-1 inline-flex h-6 w-6 items-center justify-center border border-white/10 text-white/30 transition-colors hover:border-white/25 hover:text-white/70"
                      title="Edit divisi"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteDivision(division);
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center border border-red-500/20 text-red-400/45 transition-colors hover:border-red-500/40 hover:text-red-400"
                      title="Hapus divisi"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="flex h-full min-h-0 flex-col border border-white/5 bg-[#0a0a0c]">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">Master Jobdesc</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h2 className="text-[16px] font-mono text-white/85">
              {isGeneralSelected ? "Jobdesc Umum" : selectedDivision?.name ?? "Pilih divisi"}
            </h2>
            <span className="shrink-0 text-[10px] font-mono text-white/30">
              {filteredJobTypes.length} / {visibleJobTypes.length}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2 border border-white/10 bg-[#111114] px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <input
              value={jobSearch}
              onChange={(event) => setJobSearch(event.target.value)}
              placeholder="Cari master jobdesc..."
              className="h-8 w-full bg-transparent text-[11px] font-mono text-white/70 outline-none placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:hover:bg-white/30">
          {filteredJobTypes.length ? (
            <div className="space-y-1.5">
              {filteredJobTypes.map((jobType) => (
                <div key={jobType.id} className="flex items-center justify-between gap-3 border border-white/[0.05] bg-[#111114] px-3 py-2">
                  <div className="min-w-0">
                    <span className="block truncate text-[10px] font-mono text-white/60">{jobType.jobName}</span>
                    <span className="mt-0.5 block text-[9px] font-mono text-white/20">
                      {jobType.isTeknis ? "TEKNIS" : "NON TEKNIS"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditJobType(jobType)}
                      className="inline-flex h-6 w-6 items-center justify-center border border-white/10 text-white/30 transition-colors hover:border-white/25 hover:text-white/70"
                      title="Edit jobdesc"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteJobType(jobType)}
                      className="inline-flex h-6 w-6 items-center justify-center border border-red-500/20 text-red-400/45 transition-colors hover:border-red-500/40 hover:text-red-400"
                      title="Hapus jobdesc"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-white/10 px-4 py-8 text-center text-[11px] font-mono text-white/25">
              {jobSearch ? `Tidak ada jobdesc untuk "${jobSearch}"` : "Belum ada master jobdesc untuk pilihan ini."}
            </p>
          )}
        </div>

        <form className="mt-auto space-y-3 border-t border-white/10 bg-[#111114] p-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30">
                {isEditing ? "Edit Jobdesc" : "Nama Jobdesc"}
              </span>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetJobForm}
                  className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.1em] text-white/30 transition-colors hover:text-white/60"
                >
                  <X className="h-3 w-3" />
                  Batal Edit
                </button>
              ) : null}
            </div>
            <input
              value={jobName}
              onChange={(event) => setJobName(event.target.value)}
              className="h-8 w-full border border-white/10 bg-[#111114] px-3 text-[11px] font-mono text-white/70 outline-none transition-colors focus:border-amber-500/40"
            />
          </label>

          <label className="flex items-center gap-3 border border-white/5 bg-[#111114] px-3 py-2">
            <input
              type="checkbox"
              checked={isTeknis}
              onChange={(event) => setIsTeknis(event.target.checked)}
              className="h-4 w-4 border-white/20 bg-transparent"
            />
            <span className="text-[10px] font-mono text-white/50">Jobdesc teknis</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting || (!isGeneralSelected && !selectedDivision)}
            className="inline-flex w-full justify-center items-center gap-1.5 border border-amber-500/40 bg-amber-500/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-500 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-30"
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
