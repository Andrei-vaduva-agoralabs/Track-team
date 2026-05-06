import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/access";

export async function Footer() {
  const isAdmin = await isCurrentUserAdmin();

  if (!isAdmin) {
    return null;
  }

  return (
    <footer className="shell-footer">
      <span>Agora Team Analytics</span>
      <Link href="/backoffice">Backoffice</Link>
    </footer>
  );
}
