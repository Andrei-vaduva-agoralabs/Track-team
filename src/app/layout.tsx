import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getEmailSession } from "@/lib/email-code-auth";

export const metadata: Metadata = {
  title: "Agora Team Analytics",
  description: "Jira-backed sprint delivery dashboard for team and member performance."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-current-pathname") ?? "/";
  const currentPath = headerStore.get("x-current-path") ?? pathname;
  const isPublicRoute = pathname.startsWith("/signin");

  if (!isPublicRoute) {
    const session = await getEmailSession();

    if (!session?.user) {
      redirect(`/signin?callbackUrl=${encodeURIComponent(currentPath)}`);
    }
  }

  return (
    <html lang="en">
      <body>
        <div className="shell-bg" />
        <main className="shell">
          <Header />
          {children}
          <Footer />
        </main>
      </body>
    </html>
  );
}
