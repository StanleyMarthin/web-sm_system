import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { permissionCodes } from "@smsystem/permissions";
import { fetchCurrentUser } from "@/shared/auth/server";
import { fetchUnitBom } from "@/shared/api/units";
import type { UnitBomNode } from "@smsystem/contracts/unit-bom";
import { PanelDetailPage } from "@/modules/units/components/panel-detail-page";

interface PanelDetailPageRouteProps {
  params: Promise<{ unitId: string; actualId: string }>;
}

function findNode(nodes: UnitBomNode[], id: string): UnitBomNode | null {
  const panelIdMatch = id.match(/^panel-(\d+)$/u);
  const panelId = panelIdMatch ? Number(panelIdMatch[1]) : null;

  for (const node of nodes) {
    if (node.actualId === id) return node;
    if (panelId !== null && node.panelId === panelId) return node;
    if (node.children.length) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default async function Page({ params }: PanelDetailPageRouteProps) {
  const { unitId, actualId } = await params;
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";

  const [{ payload, status }, { user }] = await Promise.all([
    fetchUnitBom(cookie, unitId),
    fetchCurrentUser(cookie),
  ]);

  if (status === 401) redirect("/login");
  if (status === 403) redirect("/forbidden");
  if (!payload || !user) notFound();

  const node = findNode(payload.data.tree, actualId);
  if (!node) notFound();

  const canManagePhotos = Boolean(user.permissions.includes(permissionCodes.galleryPhotoManage));
  const canDownloadPhotos = Boolean(user.permissions.includes(permissionCodes.galleryDownload));
  const canSaveWorkflowCanvas = Boolean(user.permissions.includes(permissionCodes.unitPanelManage));
  const allowedWorkflowCreateTypes = [
    user.permissions.includes(permissionCodes.updatePlan) ? "COUNTDOWN" as const : null,
    user.permissions.includes(permissionCodes.woCreate) ? "WO" as const : null,
    user.permissions.includes(permissionCodes.prCreate) ? "PR" as const : null,
    user.permissions.includes(permissionCodes.vendorCreate) ? "WOV" as const : null,
  ].filter((type): type is "COUNTDOWN" | "WO" | "PR" | "WOV" => type !== null);

  return (
    <PanelDetailPage
      carId={unitId}
      node={node}
      canManagePhotos={canManagePhotos}
      canDownloadPhotos={canDownloadPhotos}
      allowedWorkflowCreateTypes={allowedWorkflowCreateTypes}
      canSaveWorkflowCanvas={canSaveWorkflowCanvas}
    />
  );
}
