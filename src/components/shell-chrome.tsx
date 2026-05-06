"use client";

import { usePathname } from "next/navigation";

type ShellChromeProps = {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export function ShellChrome({ header, footer, children }: ShellChromeProps) {
  const pathname = usePathname();
  const hideChrome = pathname === "/signin";

  return (
    <main className="shell">
      {hideChrome ? null : header}
      {children}
      {hideChrome ? null : footer}
    </main>
  );
}
