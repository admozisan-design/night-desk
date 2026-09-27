"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  ["/", "配車ボード"],
  ["/orders/new", "新規受付"],
  ["/orders", "オーダー一覧"],
  ["/settings", "店舗設定"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">N</span>
          <div><strong>NIGHT DESK</strong><small>Front Operations</small></div>
        </div>
        <nav>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="shopCard">
          <small>現在の店舗</small><strong>DEMO STORE</strong><span>営業中</span>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
