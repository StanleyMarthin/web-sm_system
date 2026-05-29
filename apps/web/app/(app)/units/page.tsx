import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UnitBoardShell } from "@/modules/units/components/unit-board-shell";
import { fetchUnitBoard } from "@/shared/api/units";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface UnitsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function UnitsPageContent({ searchParams }: UnitsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { payload, status } = await fetchUnitBoard(cookieHeader, resolvedSearchParams);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload) {
    return (
      <ModuleUnavailableState
        module="Modul Unit Board"
        title="Unit board belum bisa dimuat"
        message="Data unit belum terbaca saat ini. Coba muat ulang beberapa saat lagi."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="sr-only">
        <h1>Unit Board</h1>
        <p>
          Main operational workspace dengan summary progress, countdown, WO, issue,
          dan delivery risk.
        </p>
      </div>

      <UnitBoardShell
        rows={payload.data}
        meta={payload.meta}
        state={payload.query}
      />
    </div>
  );
}


export default function UnitsPage(props: UnitsPageProps) {
  return <UnitsPageContent {...props} />;
}
