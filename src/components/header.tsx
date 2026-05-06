import Link from "next/link";
import { clearSession, getEmailSession } from "@/lib/email-code-auth";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/capacity", label: "Capacity" }
];

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.3.7.6 1 .3.3.65.5 1.1.6H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.4Z" />
    </svg>
  );
}

export async function Header() {
  const session = await getEmailSession();

  if (!session?.user) {
    return null;
  }

  const isAdmin = session.user.role === "admin";

  return (
    <header className="shell-header">
      <div className="shell-brand">
        <p className="eyebrow">Agora Team Analytics</p>
        <h1>Team delivery intelligence</h1>
        <p className="shell-subtitle">
          Jira-backed sprint diagnostics for commitments, handoffs, and execution time.
        </p>
      </div>
      <nav className="shell-nav" aria-label="Primary">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        {isAdmin ? (
          <Link className="icon-link" href="/setup" aria-label="Open setup">
            <GearIcon />
          </Link>
        ) : null}
        <form
          action={async () => {
            "use server";
            await clearSession();
          }}
        >
          <button className="nav-button" type="submit">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
