"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createWo } from "@/shared/api/wo";
import { useRouter } from "next/navigation";

const woSchema = z.object({
  carId: z.string().min(1, "Pilih unit kendaraan"),
  toDivisionId: z.string().min(1, "Pilih divisi tujuan"),
  requestDate: z.string().min(1, "Tanggal wajib diisi"),
  isPriority: z.boolean(),
  jobDetail: z.string().min(1, "Rincian pekerjaan wajib diisi"),
  notes: z.string().optional(),
});

type WoFormValues = z.infer<typeof woSchema>;

interface WoCreateFormProps {
  units: any[];
  divisions: any[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function WoCreateForm({ units, divisions, onSuccess, onError, onClose }: WoCreateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<WoFormValues>({
    resolver: zodResolver(woSchema),
    defaultValues: {
      carId: "",
      toDivisionId: "",
      requestDate: new Date().toISOString().split("T")[0],
      isPriority: false,
      jobDetail: "",
      notes: ""
    }
  });

  const onSubmit = async (data: WoFormValues) => {
    setLoading(true);
    onError("");
    try {
      const res = await createWo({
        carId: data.carId,
        toDivisionId: Number(data.toDivisionId),
        requestDate: data.requestDate,
        isPriority: data.isPriority,
        panelName: null,
        jobDetail: data.jobDetail,
        estimatedHours: null,
        notes: data.notes || null,
        items: []
      });

      if (!res.success) throw new Error(res.message);
      
      onSuccess("Work Order berhasil dibuat.");
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
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-amber-500/30 transition-colors"
          >
            <option value="" className="bg-black">Pilih Unit</option>
            {units.map((u) => (
              <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
            ))}
          </select>
          {errors.carId && <p className="text-[10px] text-red-400 pl-1">{errors.carId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Tujuan Divisi Kerja</label>
          <select
            {...register("toDivisionId")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-amber-500/30 transition-colors"
          >
            <option value="" className="bg-black">Pilih Divisi</option>
            {divisions.map((d) => (
              <option key={d.value} value={d.value} className="bg-black">{d.label}</option>
            ))}
          </select>
          {errors.toDivisionId && <p className="text-[10px] text-red-400 pl-1">{errors.toDivisionId.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Tanggal Permintaan</label>
          <input
            type="date"
            {...register("requestDate")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-amber-500/30"
          />
          {errors.requestDate && <p className="text-[10px] text-red-400 pl-1">{errors.requestDate.message}</p>}
        </div>
        <div className="flex items-center gap-3.5 pl-2 pt-6">
          <input
            type="checkbox"
            id="wo-prio"
            {...register("isPriority")}
            className="h-4 w-4 text-amber-500 rounded bg-transparent border-white/20 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="wo-prio" className="text-white/60 font-semibold cursor-pointer">Prioritas Tinggi (Urgent)</label>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Rincian Pekerjaan (Job Detail)</label>
        <textarea
          {...register("jobDetail")}
          placeholder="Deskripsikan kerusakan / perbaikan secara lengkap..."
          className="w-full min-h-[90px] rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white outline-none focus:border-amber-500/30 placeholder:text-white/20"
        />
        {errors.jobDetail && <p className="text-[10px] text-red-400 pl-1">{errors.jobDetail.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Catatan Tambahan (Optional)</label>
        <input
          type="text"
          {...register("notes")}
          placeholder="Tambahkan info tambahan jika ada..."
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-white outline-none focus:border-amber-500/30"
        />
      </div>

      <div className="pt-5 border-t border-white/[0.06] flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-full border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/[0.03] text-white/60 hover:text-white transition-all"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-full bg-amber-500 text-xs font-bold uppercase tracking-wider text-black hover:bg-amber-400 transition-all flex items-center gap-2"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          <span>{loading ? "Menyimpan..." : "Submit Work Order"}</span>
        </button>
      </div>
    </form>
  );
}
