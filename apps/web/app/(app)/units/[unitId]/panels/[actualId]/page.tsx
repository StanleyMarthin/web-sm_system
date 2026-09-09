import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { MasterPanelDetailHub } from "@/modules/units/components/master-panel-detail-hub";
import { fetchUnitPanelDetail } from "@/shared/api/units";

interface PanelDetailPageRouteProps {
  params: Promise<{ unitId: string; actualId: string }>;
}

export default async function Page({ params }: PanelDetailPageRouteProps) {
  const { unitId, actualId } = await params;
  const panelIdMatch = actualId.match(/^panel-(\d+)$/u);
  const masterPanelId = panelIdMatch ? Number(panelIdMatch[1]) : null;
  if (!masterPanelId) notFound();

  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";

  const { payload, status } = await fetchUnitPanelDetail(cookie, unitId, masterPanelId);

  if (status === 401) redirect("/login");
  if (status === 403) redirect("/forbidden");
  if (!payload) notFound();

  return <MasterPanelDetailHub detail={payload.data} />;
}
