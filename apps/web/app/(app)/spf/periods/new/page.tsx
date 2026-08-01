import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/shared/auth/admin-session";
import { PeriodWizard } from "@/modules/spf/components/forms/period-form";

export default async function NewSpfPeriodPage() {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  const session = await requireAdminSession(cookieHeader);
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/forbidden");

  return <PeriodWizard />;
}
