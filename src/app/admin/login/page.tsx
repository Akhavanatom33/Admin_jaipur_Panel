import { redirect } from "next/navigation";
import { anyAdminExists, getCurrentAdmin } from "@/lib/auth";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  const hasAdmin = await anyAdminExists();
  return <LoginForm setupMode={!hasAdmin} />;
}
