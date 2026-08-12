import { redirect } from "next/navigation";

export default async function NewSpfPeriodPage() {
  redirect("/spf/periods?create=1");
}
