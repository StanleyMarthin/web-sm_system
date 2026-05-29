import { redirect } from "next/navigation";

interface UnitWorkspaceAliasPageProps {
  params: Promise<{ unitId: string }>;
}

async function UnitWorkspaceAliasPageContent({ params }: UnitWorkspaceAliasPageProps) {
  const { unitId } = await params;
  return redirect(`/units/${unitId}`);
}


export default function UnitWorkspaceAliasPage(props: UnitWorkspaceAliasPageProps) {
  return <UnitWorkspaceAliasPageContent {...props} />;
}
