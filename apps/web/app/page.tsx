import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";

async function HomePageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user } = await fetchCurrentUser(cookieHeader);

  return redirect(user ? "/dashboard" : "/login");
}


export default function HomePage() {
  return <HomePageContent />;
}
