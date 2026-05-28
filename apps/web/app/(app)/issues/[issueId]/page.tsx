import { headers } from "next/headers";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import {
  fetchIssueDetail,
  fetchIssueGrid,
  fetchIssuesByUnit,
} from "@/shared/api/issues";
import { fetchUnitEta } from "@/shared/api/calendar";
import { ModuleUnavailableState } from "@/shared/ui/module-unavailable-state";
import { PageDataSkeleton } from "@/shared/ui/page-data-skeleton";

const IssueDetailShell = dynamic(
  () =>
    import("@/modules/issues/components/issue-detail-shell").then(
      (mod) => mod.IssueDetailShell,
    ),
  {
    loading: () => <PageDataSkeleton title="Memuat detail issue" rows={8} />,
  },
);

interface IssueDetailPageProps {
  params: Promise<{ issueId: string }>;
}

async function IssueDetailPageContent({ params }: IssueDetailPageProps) {
  const resolvedParams = await params;
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const [{ payload, status }, { user }, referenceResponse] = await Promise.all([
    fetchIssueDetail(cookieHeader, resolvedParams.issueId),
    fetchCurrentUser(cookieHeader),
    fetchIssueGrid(cookieHeader, {
      page: "1",
      limit: "1",
    }),
  ]);

  if (status === 401) {
    redirect("/login");
  }

  if (status === 403) {
    redirect("/forbidden");
  }

  if (!payload || !user) {
    return (
      <ModuleUnavailableState
        module="Issue"
        title="Detail issue belum bisa dimuat"
        message={`Data issue ${resolvedParams.issueId} atau sesi aktif belum terbaca saat ini.`}
        backHref="/issues"
        backLabel="Kembali ke Daftar Issue"
        secondaryHref="/dashboard"
        secondaryLabel="Ke Dashboard"
      />
    );
  }

  const [relatedResponse, etaResponse] = await Promise.all([
    fetchIssuesByUnit(cookieHeader, payload.data.issue.carId),
    fetchUnitEta(cookieHeader, payload.data.issue.carId),
  ]);

  return (
    <IssueDetailShell
      issue={payload.data.issue}
      relatedIssues={relatedResponse.payload ?? [payload.data.issue]}
      eta={etaResponse.payload?.data ?? null}
      employeeOptions={referenceResponse.payload?.references.employees ?? []}
      canSubmit={user.permissions.includes(permissionCodes.qcSubmit)}
      canValidate={user.permissions.includes(permissionCodes.qcValidate)}
    />
  );
}


export default function IssueDetailPage(props: IssueDetailPageProps) {
  return <IssueDetailPageContent {...props} />;
}
