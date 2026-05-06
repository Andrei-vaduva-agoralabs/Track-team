import type { Metadata } from "next";
import "@/app/globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ShellChrome } from "@/components/shell-chrome";

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
        <ShellChrome header={<Header />} footer={<Footer />}>
          {children}
        </ShellChrome>
      </body>
    </html>
  );
}
