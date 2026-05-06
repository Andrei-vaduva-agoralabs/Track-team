import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="shell">
      <Header />
      {children}
      <Footer />
    </main>
  );
}
