"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  ["/", "配車管理"],
  ["/casts", "キャスト出勤管理"],
  ["/settlement", "キャスト精算"],
  ["/orders", "予約一覧"],
  ["/settings", "設定"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="appFrame">
      <header className="topConsoleBar">
        <Link href="/" className="consoleBrand">
          <span className="brandMark">N</span>
          <div>
            <strong>NIGHT DESK</strong>
            <small>配車管理システム</small>
          </div>
        </Link>
        <nav className="topConsoleNav">
          {nav.map(([href,label])=>(
            <Link key={href} href={href} className={pathname===href?"active":""}>{label}</Link>
          ))}
        </nav>
        <div className="consoleShop">
          <span className="onlineDot"/>
          <div><small>サンプルデータ</small><strong>サンプル店舗A</strong></div>
        </div>
      </header>
      <main className="consoleMain">{children}</main>
    </div>
  );
}
