import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/shared/auth/server";
import { ProfileShell } from "@/modules/profile/components/profile-shell";

export const metadata: Metadata = {
  title: "Profile | SM System",
};

async function ProfilePageContent() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const { user } = await fetchCurrentUser(cookieHeader);

  if (!user) {
    redirect("/login");
  }

  return <ProfileShell user={user} />;
}


export default function ProfilePage() {
  return <ProfilePageContent />;
}
