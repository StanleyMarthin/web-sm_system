"use client";

import { useRef, useState } from "react";
import NextImage from "next/image";
import {
  Camera,
  CheckCircle2,
  Mail,
  User,
  Loader2,
  AlertCircle,
  Lock,
  Building2,
  BadgeCheck,
  Pencil,
  Eye,
  X,
} from "lucide-react";
import type { AuthUser } from "@smsystem/contracts/auth";
import { getApiBaseUrl } from "@/shared/api/config";
import { ProfileEmailForm } from "./forms/profile-email-form";
import { ProfilePasswordForm } from "./forms/profile-password-form";

// ──────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────
function Toast({ type, message }: { type: "success" | "error"; message: string }) {
  const color = type === "success" ? "emerald" : "red";
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-${color}-500/10 border border-${color}-500/20 rounded-lg text-${color}-400 text-sm animate-pulse`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

// ──────────────────────────────────────────────
// Field display
// ──────────────────────────────────────────────
function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="px-4 py-2.5 bg-black/40 border border-white/[0.06] rounded-lg text-white/80 text-sm">
        {value || <span className="text-white/25 italic">—</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export function ProfileShell({ user }: { user: AuthUser }) {
  const apiBase = getApiBaseUrl();

  // ── Avatar state ──
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Toast state ──
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Compress image ──
  async function compressImage(file: File, maxPx = 512, quality = 0.82): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Gagal mengkompresi gambar")); return; }
            resolve(blob);
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Gambar tidak valid")); };
      img.src = objectUrl;
    });
  }

  // ── Avatar upload ──
  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setIsUploading(true);
    try {
      const blob = await compressImage(file);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const res = await fetch(`${apiBase}/api/profile/avatar/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Gagal upload foto");
      setPhotoUrl(`${data.data.photoUrl}?t=${Date.now()}`);
      showToast("success", "Foto profil berhasil diperbarui!");
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Terjadi kesalahan saat upload");
    } finally {
      setIsUploading(false);
    }
  }



  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-light text-white tracking-wide">My Profile</h1>
          <p className="text-sm text-white/40 mt-1">Kelola informasi profil dan akun Anda</p>
        </div>

        {/* Toast */}
        {toast && <Toast type={toast.type} message={toast.message} />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── Left: Avatar Card ── */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6 flex flex-col items-center text-center">

              {/* Avatar */}
              <div
                className="relative group cursor-pointer mb-5"
                onClick={() => !isUploading && fileInputRef.current?.click()}
                title="Klik untuk ganti foto"
              >
                <div className="w-28 h-28 rounded-full overflow-hidden bg-white/5 border-2 border-white/10 flex items-center justify-center transition-all group-hover:border-amber-500/50 relative">
                  {photoUrl ? (
                    <NextImage
                      key={photoUrl}
                      src={photoUrl}
                      alt={user.fullName}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white/20" />
                  )}
                  {isUploading ? (
                    <div className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center gap-1">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                      <span className="text-[9px] text-white/60">Uploading…</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                      <span className="text-[9px] text-white/80">Ganti foto</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg ring-2 ring-black">
                  <Camera className="w-3 h-3" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
              </div>

              <h2 className="text-lg font-semibold text-white mb-0.5">{user.fullName}</h2>
              <p className="text-xs text-amber-500/80 font-medium mb-0.5">{user.divisionName}</p>
              <p className="text-[10px] text-white/30 mb-4">Klik foto untuk mengganti</p>

              <div className="w-full h-px bg-white/[0.06] mb-4" />

              {/* Quick info */}
              <div className="w-full space-y-2.5 text-left">
                <div className="flex items-center gap-2.5 text-xs text-white/50">
                  <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-amber-500/70" />
                  <span className="font-mono">{user.employeeId}</span>
                </div>
                {user.email && (
                  <div className="flex items-center gap-2.5 text-xs text-white/50">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                )}
                {user.grade && (
                  <div className="flex items-center gap-2.5 text-xs text-white/50">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{user.grade}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Info + Forms ── */}
          <div className="md:col-span-2 space-y-4">

            {/* Info karyawan */}
            <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-base font-medium text-white mb-5">Informasi Karyawan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Nama Lengkap" value={user.fullName} />
                <InfoField label="ID Karyawan" value={user.employeeId} />
                <InfoField label="Divisi" value={user.divisionName} />
                <InfoField label="Grade / Jabatan" value={user.grade} />
              </div>
            </div>

            {/* Edit Email */}
            <ProfileEmailForm
              user={user}
              onSuccess={(msg) => showToast("success", msg)}
              onError={(msg) => showToast("error", msg)}
            />

            {/* Change Password */}
            <ProfilePasswordForm
              onSuccess={(msg) => showToast("success", msg)}
              onError={(msg) => showToast("error", msg)}
            />

          </div>
        </div>
      </div>
    </div>
  );
}
