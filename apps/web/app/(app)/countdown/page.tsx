import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { fetchCountdownBoard } from "@/shared/api/countdown";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const CountdownBoardShell = dynamic(
  () =>
    import("@/modules/countdown/components/countdown-board-shell").then(
      (mod) => mod.CountdownBoardShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat countdown" />,
  },
);

interface CountdownPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function CountdownPageContent({ searchParams }: CountdownPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchCountdownBoard(cookieHeader, resolvedSearchParams);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Phase 6"
        title="Countdown belum bisa dimuat"
        message="Data countdown belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <CountdownBoardShell
      rows={payload.data}
      references={
        payload.references ?? {
          divisions: [],
          units: [],
          panels: [],
          sections: [],
          jobTypes: [],
          taskCategories: [],
        }
      }
      canManage={payload.canManage ?? false}
      meta={payload.meta}
      state={payload.query}
    />
  );
}


export default function CountdownPage(props: CountdownPageProps) {
  return <CountdownPageContent {...props} />;
}
