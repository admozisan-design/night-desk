import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "NIGHT DESK",
  description: "フロント業務をひとつにまとめる店舗向け業務支援ツール",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
