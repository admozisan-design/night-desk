"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultTopNavigation } from "@/lib/navigation";
import { loadTopNavigation } from "@/lib/storage";
import type { TopNavItem } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [nav,setNav]=useState<TopNavItem[]>(defaultTopNavigation);

  useEffect(()=>{
    const refresh=()=>setNav(loadTopNavigation(defaultTopNavigation));
    refresh();
    window.addEventListener("nightdesk:navigation",refresh);
    window.addEventListener("storage",refresh);
    return ()=>{
      window.removeEventListener("nightdesk:navigation",refresh);
      window.removeEventListener("storage",refresh);
    };
  },[]);

  function isActive(href:string){
    if(href==="/") return pathname==="/";
    return pathname===href || pathname.startsWith(href+"/");
  }

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
          {nav.filter(item=>item.visible || item.id==="settings").map(item=>(
            <Link key={item.id} href={item.href} className={isActive(item.href)?"active":""}>{item.label}</Link>
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
