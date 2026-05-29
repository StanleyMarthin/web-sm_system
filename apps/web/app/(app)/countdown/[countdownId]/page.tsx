import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CountdownDetailShell } from "@/modules/countdown/components/countdown-detail-shell";
import { fetchCountdownDetail } from "@/shared/api/countdown";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface CountdownDetailPageProps {
  params: Promise<{ countdownId: string }>;
}

async function CountdownDetailPageContent({ params }: CountdownDetailPageProps) {
  const { countdownId } = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchCountdownDetail(cookieHeader, countdownId);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Countdown"
        title="Detail countdown belum bisa dimuat"
        message={`Data countdown ${countdownId} belum terbaca saat ini. Coba muat ulang beberapa saat lagi.`}
        backHref="/countdown"
        backLabel="Kembali ke Daftar"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  return <CountdownDetailShell countdown={payload.data.countdown} />;
}


export default function CountdownDetailPage(props: CountdownDetailPageProps) {
  return <CountdownDetailPageContent {...props} />;
}
