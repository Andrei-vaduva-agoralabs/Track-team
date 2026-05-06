import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/access";

export async function Footer() {
  const isAdmin = await isCurrentUserAdmin();

  return (
    <footer className="shell-footer">
      <span>Agora Team Analytics</span>
      {isAdmin ? <Link href="/backoffice">Backoffice</Link> : null}
    </footer>
  );
}
