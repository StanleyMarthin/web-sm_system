import { redirect } from "next/navigation";

export default function PasswordSettingsPage() {
  redirect("/profile#password");
}
