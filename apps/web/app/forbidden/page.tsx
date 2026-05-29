export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-500/70">
          Access Denied
        </p>
        <h1 className="mt-4 text-2xl font-light">Izin akses tidak mencukupi</h1>
        <p className="mt-3 text-sm text-white/45">
          Endpoint dashboard bootstrap ditolak oleh permission guard backend.
        </p>
      </div>
    </div>
  );
}
