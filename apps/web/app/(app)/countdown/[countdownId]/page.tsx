import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CountdownDetailShell } from "@/modules/countdown/components/countdown-detail-shell";
import { fetchCountdownDetail } from "@/shared/api/countdown";
import { fetchJobPlanGrid } from "@/shared/api/job-plan";
import { fetchJobPlanV2History } from "@/shared/api/job-plan-v2";
import { fetchQcDetail } from "@/shared/api/qc";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";

interface CountdownDetailPageProps {
  params: Promise<{ countdownId: string }>;
}

async function CountdownDetailPageContent({ params }: CountdownDetailPageProps) {
  const { countdownId } = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, historyResult, jobPlanGrid, qcDetail] = await Promise.all([
    fetchCountdownDetail(cookieHeader, countdownId),
    fetchJobPlanV2History(cookieHeader, countdownId),
    fetchJobPlanGrid(cookieHeader, {}, "normal"),
    fetchQcDetail(cookieHeader, countdownId),
  ]);

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

  const employeeNames: Record<string, string> = {};
  for (const employee of jobPlanGrid.payload?.references.employees ?? []) {
    employeeNames[employee.value] = employee.label;
  }

  return (
    <CountdownDetailShell
      countdown={payload.data.countdown}
      canRequestRevision={payload.canRequestRevision}
      canApproveRevision={payload.canApproveRevision}
      canApproveMoRevision={payload.canApproveMoRevision}
      canManage={payload.canManage}
      jobHistory={{
        items: historyResult.success ? historyResult.result.items : [],
        employeeNames,
        error: historyResult.success ? null : historyResult.message,
      }}
      qcSummary={qcDetail.payload?.data.item ? {
        resultStatus: qcDetail.payload.data.item.qcLastStatus,
        level: qcDetail.payload.data.item.qcLevel,
        inspectedAt: qcDetail.payload.data.item.latestInspectionDate,
      } : null}
    />
  );
}


export default function CountdownDetailPage(props: CountdownDetailPageProps) {
  return <CountdownDetailPageContent {...props} />;
}
