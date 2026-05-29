"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createVendor } from "@/shared/api/vendor";
import { useRouter } from "next/navigation";

const wovSchema = z.object({
  carId: z.string().min(1, "Pilih unit kendaraan"),
  vendorName: z.string().min(1, "Pilih vendor"),
  targetDateReturn: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    itemName: z.string().min(1, "Nama jasa/barang wajib diisi"),
    quantity: z.number().min(1, "Minimal 1"),
    uom: z.string(),
    goodsConditionOut: z.string().optional(),
    estimatedCost: z.number().optional()
  })).min(1, "Minimal 1 pekerjaan")
});

type WovFormValues = z.infer<typeof wovSchema>;

interface WovCreateFormProps {
  units: any[];
  vendors: any[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export function WovCreateForm({ units, vendors, onSuccess, onError, onClose }: WovCreateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<WovFormValues>({
    resolver: zodResolver(wovSchema),
    defaultValues: {
      carId: "",
      vendorName: "",
      targetDateReturn: "",
      remarks: "",
      items: [
        {
          itemName: "",
          quantity: 1,
          uom: "pcs",
          goodsConditionOut: "",
          estimatedCost: 0
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const onSubmit = async (data: WovFormValues) => {
    setLoading(true);
    onError("");
    try {
      const selectedVendor = vendors.find((v) => v.value === data.vendorName);
      const res = await createVendor({
        carId: data.carId,
        coreId: null,
        prId: null,
        vendorId: selectedVendor?.value ?? null,
        vendorName: selectedVendor?.label ?? data.vendorName,
        picVendor: null,
        itemName: data.items[0]?.itemName || null,
        quantity: data.items[0]?.quantity ? Number(data.items[0].quantity) : null,
        uom: data.items[0]?.uom || null,
        goodsConditionOut: data.items[0]?.goodsConditionOut || null,
        targetDateReturn: data.targetDateReturn || null,
        estimatedCost: data.items[0]?.estimatedCost ? Number(data.items[0].estimatedCost) : null,
        remarks: data.remarks || null,
        items: data.items.map((it) => ({
          itemName: it.itemName,
          quantity: Number(it.quantity),
          uom: it.uom,
          goodsConditionOut: it.goodsConditionOut || null,
          estimatedCost: it.estimatedCost ? Number(it.estimatedCost) : null
        }))
      });

      if (!res.success) throw new Error(res.message);
      
      onSuccess("Vendor Work Order berhasil dibuat.");
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
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-sky-500/30"
          >
            <option value="" className="bg-black">Pilih Unit</option>
            {units.map((u) => (
              <option key={u.value} value={u.value} className="bg-black">{u.label}</option>
            ))}
          </select>
          {errors.carId && <p className="text-[10px] text-red-400 pl-1">{errors.carId.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Nama Vendor / Toko Rekanan</label>
          <select
            {...register("vendorName")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-sky-500/30"
          >
            <option value="" className="bg-black">Pilih Vendor</option>
            {vendors.map((v) => (
              <option key={v.value} value={v.value} className="bg-black">{v.label}</option>
            ))}
          </select>
          {errors.vendorName && <p className="text-[10px] text-red-400 pl-1">{errors.vendorName.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Target Tanggal Kembali</label>
          <input
            type="date"
            {...register("targetDateReturn")}
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 text-white outline-none focus:border-sky-500/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-white/40 pl-1">Remarks (Catatan Header)</label>
          <input
            type="text"
            {...register("remarks")}
            placeholder="Contoh: Pengelasan plat lantai / Cat oven"
            className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 text-white outline-none focus:border-sky-500/30"
          />
        </div>
      </div>

      {/* Items Section for Vendor WO */}
      <div className="border-t border-white/[0.06] pt-4 mt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Pekerjaan Vendor ({fields.length})</span>
          <button
            type="button"
            onClick={() => append({ itemName: "", quantity: 1, uom: "pcs", goodsConditionOut: "", estimatedCost: 0 })}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Pekerjaan
          </button>
        </div>

        {errors.items?.root && <p className="text-[10px] text-red-400">{errors.items.root.message}</p>}

        <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
          {fields.map((item, idx) => (
            <div key={item.id} className="relative p-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/30">Pekerjaan #{idx + 1}</span>
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
                    placeholder="Nama Item / Jasa Vendor *"
                    className="h-10 w-full rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-sky-500/30 text-white"
                  />
                  {errors.items?.[idx]?.itemName && <p className="text-[10px] text-red-400 mt-1 pl-1">{errors.items[idx]?.itemName?.message}</p>}
                </div>
                <input
                  type="text"
                  {...register(`items.${idx}.goodsConditionOut`)}
                  placeholder="Kondisi Fisik Saat Keluar"
                  className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-sky-500/30 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <input
                    type="number"
                    {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                    placeholder="Quantity"
                    className="h-10 w-full rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-sky-500/30 text-white"
                  />
                  {errors.items?.[idx]?.quantity && <p className="text-[10px] text-red-400 mt-1 pl-1">{errors.items[idx]?.quantity?.message}</p>}
                </div>
                <input
                  type="text"
                  {...register(`items.${idx}.uom`)}
                  placeholder="UOM"
                  className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-sky-500/30 text-white"
                />
                <input
                  type="number"
                  {...register(`items.${idx}.estimatedCost`, { valueAsNumber: true })}
                  placeholder="Est. Biaya"
                  className="h-10 rounded-xl border border-white/[0.06] bg-black px-3 outline-none focus:border-sky-500/30 text-white"
                />
              </div>
            </div>
          ))}
        </div>
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
          className="px-6 py-2 rounded-full bg-sky-500 text-xs font-bold uppercase tracking-wider text-black hover:bg-sky-400 transition-all flex items-center gap-2"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          <span>{loading ? "Menyimpan..." : "Submit Vendor WO"}</span>
        </button>
      </div>
    </form>
  );
}
