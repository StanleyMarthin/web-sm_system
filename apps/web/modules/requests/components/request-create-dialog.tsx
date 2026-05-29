"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";
import { PrCreateForm } from "./forms/pr-create-form";
import { WoCreateForm } from "./forms/wo-create-form";
import { WovCreateForm } from "./forms/wov-create-form";

interface RequestCreateDialogProps {
  type: "WO" | "PR" | "WOV";
  onClose: () => void;
  units: any[];
  divisions: any[];
  vendors: any[];
}

export function RequestCreateDialog({
  type,
  onClose,
  units = [],
  divisions = [],
  vendors = []
}: RequestCreateDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // All form states and submit handlers have been delegated to their respective form components
  // to ensure better performance (preventing massive re-renders) and separation of concerns.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-[32px] border border-white/[0.08] bg-[#0c0c0c] shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6">
          <div>
            <h2 className="text-xl font-light text-white flex items-center gap-2">
              <span>Buat Permintaan Baru:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                type === "WO" ? "bg-amber-500/10 text-amber-500" :
                type === "PR" ? "bg-purple-500/10 text-purple-400" : "bg-sky-500/10 text-sky-400"
              }`}>
                {type === "WO" ? "Work Order" : type === "PR" ? "Purchase Request" : "Vendor WO"}
              </span>
            </h2>
            <p className="text-xs text-white/40 mt-1">Formulir lengkap input ke sistem SM Stanley Marthin</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-white/[0.06] bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Message Notifications */}
        {success && (
          <div className="p-3.5 mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3.5 mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Dynamic Form Rendering */}
        {type === "WO" && <WoCreateForm units={units} divisions={divisions} onSuccess={setSuccess} onError={setError} onClose={onClose} />}
        {type === "PR" && <PrCreateForm units={units} onSuccess={setSuccess} onError={setError} onClose={onClose} />}
        {type === "WOV" && <WovCreateForm units={units} vendors={vendors} onSuccess={setSuccess} onError={setError} onClose={onClose} />}
      </div>
    </div>
  );
}
