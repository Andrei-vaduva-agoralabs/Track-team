import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Agora Team Analytics",
  description: "Jira-backed sprint delivery dashboard for team and member performance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="shell-bg" />
        {children}
      </body>
    </html>
  );
}
