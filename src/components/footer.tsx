import Link from "next/link";
import { isCurrentUserAdmin } from "@/lib/access";

export async function Footer() {
  const isAdmin = await isCurrentUserAdmin();

  return (
    <footer className="shell-footer">
      <span>Agora Team Analytics</span>
      <div className="shell-footer-links">
        <Link href="/wiki-tool">WikiTool</Link>
        {isAdmin ? <Link href="/backoffice">Backoffice</Link> : null}
      </div>
    </footer>
  );
}
