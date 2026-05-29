import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { GalleryShell } from "@/modules/gallery/components/gallery-shell";
import { fetchGalleryGrid } from "@/shared/api/gallery";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface GalleryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getTodayJakarta(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

async function GalleryPageContent({ searchParams }: GalleryPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  const effectiveSearchParams: Record<string, string | string[] | undefined> = {
    ...resolvedSearchParams,
    date:
      (Array.isArray(resolvedSearchParams.date)
        ? resolvedSearchParams.date[0]
        : resolvedSearchParams.date) ?? getTodayJakarta(),
  };

  const [{ user, status: userStatus }, { payload, status }] = await Promise.all([
    fetchCurrentUser(cookieHeader),
    fetchGalleryGrid(cookieHeader, effectiveSearchParams),
  ]);

  if (status === 401 || userStatus === 401) {
    redirect("/login");
  }

  if (status === 403 || userStatus === 403) {
    redirect("/forbidden");
  }

  if (!user || !payload) {
    return (
      <ModuleUnavailableState
        module="Gallery"
        title="Galeri foto belum bisa dimuat"
        message="Data foto pekerjaan atau sesi aktif belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }



  return (
    <div className="space-y-3">
      <div className="sr-only">
        <h1>Galeri Pekerjaan</h1>
        <p>
          Cari jobdesc per hari, lihat foto kerja, lalu rapikan upload atau keterangan
          fotonya dari satu halaman.
        </p>
      </div>

      <GalleryShell
        rows={payload.data}
        meta={payload.meta}
        state={payload.query}
        references={payload.references}
        canManagePhotos={user.permissions.includes(permissionCodes.galleryPhotoManage)}
        canDownloadPhotos={user.permissions.includes(permissionCodes.galleryDownload)}
      />
    </div>
  );
}


export default function GalleryPage(props: GalleryPageProps) {
  return <GalleryPageContent {...props} />;
}
