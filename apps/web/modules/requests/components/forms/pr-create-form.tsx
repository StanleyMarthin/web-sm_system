"use client";

import Image from "next/image";
import { useState } from "react";
import { Loader2, UploadCloud, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createPr, requestPrUploadTicket } from "@/shared/api/pr";
import { useRouter } from "next/navigation";

const prSchema = z.object({
  carId: z.string().min(1, "Pilih unit kendaraan"),
  targetDate: z.string().optional(),
  priority: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemName: z.string().min(1, "Nama item wajib diisi"),
    description: z.string().optional(),
    originType: z.enum(["LOKAL", "LN"]),
    qty: z.number().min(1, "Minimal 1"),
    uom: z.string(),
    estimatedPrice: z.number().optional(),
    photoUrl: z.string().optional(),
    uploading: z.boolean().optional(),
  })).min(1, "Minimal 1 barang")
});

type PrFormValues = z.infer<typeof prSchema>;

interface PrCreateFormProps {
  units: any[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function PrCreateForm({ units, onSuccess, onError, onClose }: PrCreateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<PrFormValues>({
    resolver: zodResolver(prSchema),
    defaultValues: {
      carId: "",
      targetDate: "",
      priority: "NORMAL",
      notes: "",
      items: [
        {
          itemName: "",
          description: "",
          originType: "LOKAL",
          qty: 1,
          uom: "pcs",
          estimatedPrice: 0,
          photoUrl: "",
          uploading: false
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const itemsWatch = watch("items");

  async function handleFileUpload(index: number, file: File) {
    if (!file) return;

    setValue(`items.${index}.uploading`, true);

    try {
      const ticketRes = await requestPrUploadTicket({
        filename: file.name,
        contentType: file.type,
      });

      if (!ticketRes.success) {
        throw new Error(ticketRes.message || "Gagal mendapatkan upload ticket.");
      }

      const { uploadUrl, publicUrl } = ticketRes.result;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Gagal mengunggah file ke storage.");
      }

      setValue(`items.${index}.photoUrl`, publicUrl);
    } catch (err: any) {
      alert(err.message || "Gagal mengupload file.");
    } finally {
      setValue(`items.${index}.uploading`, false);
    }
  }

  const onSubmit = async (data: PrFormValues) => {
    setLoading(true);
    onError(""); // Clear previous errors via parent
    try {
      const res = await createPr({
        carId: data.carId,
        divisionName: null,
        targetDate: data.targetDate || null,
        priority: data.priority,
        notes: data.notes || null,
        items: data.items.map((it) => ({
          itemName: it.itemName,
          description: it.description || null,
          originType: it.originType,
          qty: Number(it.qty),
          uom: it.uom,
          estimatedPrice: it.estimatedPrice ? Number(it.estimatedPrice) : null,
          photoUrl: it.photoUrl || null
        }))
      });

      if (!res.success) throw new Error(res.message);
      
      onSuccess("Purchase Request berhasil dibuat.");
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      onError(err?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Pilih Unit Kendaraan</label>
          <select
            {...register("carId")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-purple-500/30"
          >
            <option value="" className="bg-black">Pilih Unit</option>
            {units.map((u) => (
              <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
            ))}
          </select>
          {errors.carId && <p className="text-[10px] text-red-400 pl-1">{errors.carId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Target Tanggal Tiba (Optional)</label>
          <input
            type="date"
            {...register("targetDate")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-purple-500/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Prioritas</label>
          <select
            {...register("priority")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-purple-500/30"
          >
            <option value="NORMAL" className="bg-black">NORMAL</option>
            <option value="HIGH" className="bg-black">TINGGI (URGENT)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Catatan PR Header</label>
          <input
            type="text"
            {...register("notes")}
            placeholder="Contoh: Kebutuhan part restorasi eksterior"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-white outline-none focus:border-purple-500/30"
          />
        </div>
      </div>

      {/* Items Section */}
      <div className="border-t border-white/[0.06] pt-4 mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Daftar Barang Permintaan ({fields.length})</span>
          <button
            type="button"
            onClick={() => append({ itemName: "", description: "", originType: "LOKAL", qty: 1, uom: "pcs", estimatedPrice: 0, photoUrl: "", uploading: false })}
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Baris Barang
          </button>
        </div>

        {errors.items?.root && <p className="text-[10px] text-red-400">{errors.items.root.message}</p>}

        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
          {fields.map((item, idx) => {
            const currentItem = itemsWatch[idx];
            return (
              <div key={item.id} className="relative p-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/30">Item #{idx + 1}</span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      {...register(`items.${idx}.itemName`)}
                      placeholder="Nama Barang *"
                      className="h-10 w-full rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-purple-500/30 text-white"
                    />
                    {errors.items?.[idx]?.itemName && <p className="text-[10px] text-red-400 mt-1 pl-1">{errors.items[idx]?.itemName?.message}</p>}
                  </div>
                  <input
                    type="text"
                    {...register(`items.${idx}.description`)}
                    placeholder="Keterangan / Merek / Spesifikasi"
                    className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-purple-500/30 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input
                      type="number"
                      {...register(`items.${idx}.qty`, { valueAsNumber: true })}
                      placeholder="Quantity"
                      className="h-10 w-full rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-purple-500/30 text-white"
                    />
                    {errors.items?.[idx]?.qty && <p className="text-[10px] text-red-400 mt-1 pl-1">{errors.items[idx]?.qty?.message}</p>}
                  </div>
                  <input
                    type="text"
                    {...register(`items.${idx}.uom`)}
                    placeholder="UOM (pcs/set)"
                    className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-purple-500/30 text-white"
                  />
                  <input
                    type="number"
                    {...register(`items.${idx}.estimatedPrice`, { valueAsNumber: true })}
                    placeholder="Est. Harga"
                    className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-purple-500/30 text-white"
                  />
                </div>

                {/* Photo Attachment upload */}
                <div className="border border-white/[0.06] bg-black/40 rounded-xl p-3 flex items-center justify-between gap-3">
                  {currentItem?.photoUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
                        <Image src={currentItem.photoUrl} alt="thumb" fill sizes="40px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/50 truncate max-w-[200px]">Attachment Berhasil</p>
                        <button
                          type="button"
                          onClick={() => setValue(`items.${idx}.photoUrl`, "")}
                          className="text-[9px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 mt-0.5"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 text-[10px] text-purple-400/80 hover:text-purple-300 cursor-pointer font-medium w-full">
                      <UploadCloud className="h-4 w-4" />
                      <span>{currentItem?.uploading ? "Mengupload ke R2..." : "Lampirkan Foto (Optional)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={currentItem?.uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(idx, file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-5 border-t border-white/[0.06] flex items-center justify-between">
        <p className="text-[10px] text-white/30">Pastikan unit dan barang sudah benar</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-white/60 hover:text-white transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-purple-500 text-xs font-semibold text-white hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Memproses..." : "Submit Purchase Request"}
          </button>
        </div>
      </div>
    </form>
  );
}
