"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PackagePlus, Trash2 } from "lucide-react";
import type { CreateWarehouseRequest } from "@smsystem/contracts/warehouse";
import { useEffect, useState } from "react";

export const requestItemSchema = z.object({
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  qty: z.string().min(1, "Qty wajib diisi"),
  uom: z.string().min(1, "Satuan wajib diisi"),
  stockCardId: z.string().optional(),
  itemMasterId: z.string().optional(),
});

export const requestSchema = z.object({
  divisionId: z.string().min(1, "Divisi wajib diisi"),
  requesterEmployeeId: z.string().min(1, "PIC wajib diisi"),
  itemCategory: z.enum(["SPARE_PART", "BAHAN", "TOOLS"]),
  transactionType: z.enum(["PEMINJAMAN", "PENGAMBILAN", "TRANSFER_PART"]),
  coreId: z.string().min(1, "Jobdesc wajib diisi"),
  installToUnit: z.boolean(),
  notes: z.string().optional(),
  items: z.array(requestItemSchema),
  
  // temporary item input fields
  tempItemName: z.string().optional(),
  tempQty: z.string().optional(),
  tempUom: z.string().optional(),
  tempStockCardId: z.string().optional(),
});

export type RequestFormValues = z.infer<typeof requestSchema>;

interface WarehouseRequestFormProps {
  divisions: Array<{ value: string; label: string }>;
  employees: Array<{ value: string; label: string }>;
  jobs: Array<{
    coreId: string;
    unitName: string;
    panelName: string | null;
    jobName: string | null;
    taskDate: string;
    isOvertime: boolean;
  }>;
  stockCards: Array<{
    stockCardId: string;
    partName: string;
    partCode: string;
    qty: number;
    uom: string;
    unitName: string;
  }>;
  isLoading: boolean;
  isPending: boolean;
  canChooseRequestDivision: boolean;
  currentUserDivisionName: string | null;
  onFetchReferences: (input: {
    divisionId?: string;
    coreId?: string;
    date?: string;
    isOvertime?: boolean;
    transactionType?: RequestFormValues["transactionType"];
  }) => void;
  onSubmit: (data: RequestFormValues) => void;
  transactionDate: string;
}

export function WarehouseRequestForm({
  divisions,
  employees,
  jobs,
  stockCards,
  isLoading,
  isPending,
  canChooseRequestDivision,
  currentUserDivisionName,
  onFetchReferences,
  onSubmit,
  transactionDate,
}: WarehouseRequestFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      divisionId: "",
      requesterEmployeeId: "",
      itemCategory: "SPARE_PART",
      transactionType: "PEMINJAMAN",
      coreId: "",
      installToUnit: false,
      notes: "",
      items: [],
      tempItemName: "",
      tempQty: "1",
      tempUom: "PCS",
      tempStockCardId: "",
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const divisionId = watch("divisionId");
  const requesterEmployeeId = watch("requesterEmployeeId");
  const coreId = watch("coreId");
  const itemCategory = watch("itemCategory");
  const transactionType = watch("transactionType");
  const tempStockCardId = watch("tempStockCardId");
  
  const selectedJob = jobs.find((j) => j.coreId === coreId) ?? null;
  const selectedStockCard = stockCards.find((s) => s.stockCardId === tempStockCardId) ?? null;

  const inputCls =
    "h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary/30 [color-scheme:dark]";

  const darkSelectStyle = {
    backgroundColor: "var(--card)",
    color: "var(--card-foreground)",
  } as const;

  const handleAddDraft = () => {
    const itemName = watch("tempItemName") ?? "";
    const qty = watch("tempQty") ?? "1";
    const uom = watch("tempUom") ?? "PCS";
    
    if (itemName.trim().length > 0) {
      append({
        itemName,
        qty,
        uom,
        stockCardId: tempStockCardId || undefined,
        itemMasterId: undefined,
      });
      setValue("tempItemName", "");
      setValue("tempStockCardId", "");
      setValue("tempQty", "1");
    }
  };

  const handleFormSubmit = (data: RequestFormValues) => {
    if (data.items.length === 0 && data.tempItemName?.trim()) {
      data.items.push({
        itemName: data.tempItemName,
        qty: data.tempQty ?? "1",
        uom: data.tempUom ?? "PCS",
        stockCardId: data.tempStockCardId || undefined,
        itemMasterId: undefined,
      });
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Divisi pengaju</span>
          <select
            {...register("divisionId")}
            onChange={(e) => {
              setValue("divisionId", e.target.value);
              setValue("requesterEmployeeId", "");
              setValue("coreId", "");
              setValue("tempStockCardId", "");
              setValue("tempItemName", "");
              onFetchReferences({ divisionId: e.target.value, coreId: "", date: transactionDate, isOvertime: false });
            }}
            className={inputCls}
            style={darkSelectStyle}
            disabled={!canChooseRequestDivision}
          >
            <option value="">{canChooseRequestDivision ? "Pilih divisi" : currentUserDivisionName ?? "Divisi aktif"}</option>
            {divisions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {errors.divisionId && <span className="text-xs text-destructive">{errors.divisionId.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Nama PIC / pengaju</span>
          <select {...register("requesterEmployeeId")} className={inputCls} style={darkSelectStyle} disabled={!divisionId}>
            <option value="">{!divisionId ? "Pilih divisi dulu" : isLoading ? "Memuat anggota divisi..." : "Pilih anggota divisi"}</option>
            {employees.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          {errors.requesterEmployeeId && <span className="text-xs text-destructive">{errors.requesterEmployeeId.message}</span>}
        </label>

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Jobdesc aktif</span>
          <select
            {...register("coreId")}
            onChange={(e) => {
              if (fields.length > 0) return; // Must empty draft
              const val = e.target.value;
              setValue("coreId", val);
              setValue("tempStockCardId", "");
              setValue("tempItemName", "");
              const job = jobs.find(j => j.coreId === val);
              if (job) onFetchReferences({ divisionId, coreId: val, date: job.taskDate, isOvertime: job.isOvertime, transactionType });
            }}
            className={inputCls}
            style={darkSelectStyle}
            disabled={!requesterEmployeeId}
          >
            <option value="">{!requesterEmployeeId ? "Pilih PIC dulu" : isLoading ? "Memuat pekerjaan..." : "Pilih jobdesc aktif"}</option>
            {jobs.map((j) => (
              <option key={j.coreId} value={j.coreId}>{[j.unitName, j.panelName, j.jobName].filter(Boolean).join(" · ")}</option>
            ))}
          </select>
          {errors.coreId && <span className="text-xs text-destructive">{errors.coreId.message}</span>}
        </label>

        {selectedJob && (
          <div className="rounded-[14px] border border-primary/20 bg-primary/[0.06] p-3">
            <div className="grid gap-3 text-sm text-foreground/78 md:grid-cols-3">
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">Unit</p><p className="mt-1 font-medium text-foreground">{selectedJob.unitName}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">Panel</p><p className="mt-1 font-medium text-foreground">{selectedJob.panelName ?? "-"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-foreground/35">Pekerjaan</p><p className="mt-1 font-medium text-foreground">{selectedJob.jobName ?? "-"}</p></div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-foreground/75">
            <span>Kategori barang</span>
            <select
              {...register("itemCategory")}
              onChange={(e) => {
                const val = e.target.value as "SPARE_PART" | "BAHAN" | "TOOLS";
                setValue("itemCategory", val);
                setValue("transactionType", val === "BAHAN" ? "PENGAMBILAN" : val === "TOOLS" ? "PEMINJAMAN" : transactionType);
                setValue("installToUnit", false);
                setValue("tempStockCardId", "");
                setValue("tempItemName", "");
              }}
              className={inputCls}
              style={darkSelectStyle}
            >
              <option value="SPARE_PART">Sparepart</option>
              <option value="BAHAN">Bahan</option>
              <option value="TOOLS">Tools</option>
            </select>
          </label>

          {itemCategory === "SPARE_PART" ? (
            <label className="grid gap-2 text-sm text-foreground/75">
              <span>Tipe transaksi</span>
              <select
                {...register("transactionType")}
                onChange={(e) => {
                  const val = e.target.value as "PEMINJAMAN" | "PENGAMBILAN" | "TRANSFER_PART";
                  setValue("transactionType", val);
                  setValue("installToUnit", val === "PENGAMBILAN" ? watch("installToUnit") : false);
                  setValue("tempStockCardId", "");
                  setValue("tempItemName", "");
                  if (coreId) onFetchReferences({ divisionId, coreId, date: selectedJob?.taskDate ?? transactionDate, isOvertime: selectedJob?.isOvertime ?? false, transactionType: val });
                }}
                className={inputCls}
                style={darkSelectStyle}
              >
                <option value="PEMINJAMAN">Peminjaman</option>
                <option value="PENGAMBILAN">Pengambilan</option>
                <option value="TRANSFER_PART">Transfer donor</option>
              </select>
            </label>
          ) : (
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-foreground/65">
              {itemCategory === "BAHAN" ? "Alur bahan: Ketua Divisi → Kepala Gudang → PPIC." : "Tools langsung masuk antrean gudang tanpa approval tambahan."}
            </div>
          )}
        </div>

        {itemCategory === "SPARE_PART" && transactionType === "PENGAMBILAN" && (
          <label className="flex items-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-sm text-foreground/75">
            <input type="checkbox" {...register("installToUnit")} className="mt-0.5 h-4 w-4 rounded border-white/15 bg-black accent-primary" />
            <span>
              <span className="block font-medium text-foreground">Langsung dipasang ke unit</span>
              <span className="mt-1 block text-[12px] text-foreground/45">Gunakan bila barang begitu keluar langsung dipasang.</span>
            </span>
          </label>
        )}

        <div className={itemCategory === "TOOLS" ? "grid gap-4" : "grid gap-4 md:grid-cols-[1.4fr,1fr]"}>
          <label className="grid gap-2 text-sm text-foreground/75">
            <span>Nama barang</span>
            <input
              {...register("tempItemName")}
              onChange={(e) => {
                setValue("tempItemName", e.target.value);
                if (selectedStockCard && e.target.value.trim() !== selectedStockCard.partName) {
                  setValue("tempStockCardId", "");
                }
              }}
              placeholder={itemCategory === "SPARE_PART" ? "cth: Kampas rem depan" : itemCategory === "BAHAN" ? "cth: Cat primer 2K" : "cth: Kunci torsi"}
              className={inputCls}
            />
          </label>

          {itemCategory !== "TOOLS" && (
            <label className="grid gap-2 text-sm text-foreground/75">
              <span>{transactionType === "TRANSFER_PART" ? "Part donor (wajib)" : "Pilih dari stok terkait (opsional)"}</span>
              <select
                {...register("tempStockCardId")}
                onChange={(e) => {
                  const val = e.target.value;
                  const sc = stockCards.find(item => item.stockCardId === val) ?? null;
                  setValue("tempStockCardId", val);
                  setValue("tempItemName", sc?.partName ?? watch("tempItemName"));
                  setValue("tempUom", sc?.uom ?? watch("tempUom"));
                }}
                className={inputCls}
                style={darkSelectStyle}
                disabled={!coreId || stockCards.length === 0}
              >
                <option value="">
                  {!coreId ? "Pilih pekerjaan dulu" : stockCards.length === 0 ? (transactionType === "TRANSFER_PART" ? "Belum ada part donor siap pakai" : "Belum ada stok terkait") : (transactionType === "TRANSFER_PART" ? "Pilih part donor" : "Pilih dari stok terkait")}
                </option>
                {stockCards.map((item) => (
                  <option key={item.stockCardId} value={item.stockCardId}>
                    {[item.partName, item.partCode, `${item.qty} ${item.uom}`].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-foreground/75">
            <span>Jumlah</span>
            <input {...register("tempQty")} className={inputCls} inputMode="decimal" />
          </label>
          <label className="grid gap-2 text-sm text-foreground/75">
            <span>Satuan</span>
            <input {...register("tempUom")} className={inputCls} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-foreground/45">Tambahkan beberapa barang dulu bila mau diajukan sekaligus.</div>
          <button
            type="button"
            onClick={handleAddDraft}
            className="inline-flex items-center gap-2 rounded-full border border-primary/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-app-accent-ink"
          >
            <PackagePlus className="h-3.5 w-3.5" /> Tambah ke daftar
          </button>
        </div>

        {fields.length > 0 && (
          <div className="rounded-[14px] border border-white/[0.06] bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div><p className="text-sm font-medium text-foreground">Daftar item</p><p className="text-[12px] text-foreground/45">{fields.length} item siap diajukan</p></div>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {fields.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.itemName}</p>
                    <p className="text-[12px] text-foreground/45">{item.qty} {item.uom}{item.stockCardId ? " · tersambung ke stok gudang" : ""}</p>
                  </div>
                  <button type="button" onClick={() => remove(index)} className="rounded-full border border-white/[0.08] p-2 text-foreground/45 transition-colors hover:border-destructive/30 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="grid gap-2 text-sm text-foreground/75">
          <span>Catatan (opsional)</span>
          <textarea {...register("notes")} className="min-h-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30" placeholder="Catatan tambahan bila diperlukan" />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
          Kirim permintaan
        </button>
      </div>
    </form>
  );
}
