"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FocusEvent } from "react";
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

  // A controlled number input often starts at 0. Clear that initial 0 on focus
  // so typing a new amount never produces e.g. "0500".
  function onNumberFocus(event:FocusEvent<HTMLDivElement>){
    const input=event.target;
    if(!(input instanceof HTMLInputElement) || input.type!=="number" || input.disabled || input.readOnly) return;
    if(/^0+$/.test(input.value)){
      input.value="";
      input.dataset.nightdeskClearedZero="1";
    }else if(/^0+\d/.test(input.value)){
      input.value=String(Number(input.value));
    }
  }

  function onNumberBlur(event:FocusEvent<HTMLDivElement>){
    const input=event.target;
    if(!(input instanceof HTMLInputElement) || input.type!=="number") return;
    if(input.dataset.nightdeskClearedZero==="1"){
      // Keep the displayed value consistent with number-backed React state.
      if(input.value==="") input.value="0";
      delete input.dataset.nightdeskClearedZero;
    }
  }

  function isActive(href:string){
    if(href==="/") return pathname==="/";
    return pathname===href || pathname.startsWith(href+"/");
  }

  return (
    <div className="appFrame" onFocusCapture={onNumberFocus} onBlurCapture={onNumberBlur}>
      <header className="topConsoleBar">
        <Link href="/" className="consoleBrand">
          <span className="brandMark">N</span>
          <div>
            <strong>NIGHT DESK</strong>
            <small>配車管理システム</small>
          </div>
        </Link>
        <nav className="topConsoleNav">
          {nav.filter(item=>(item.inMenu!==false) && (item.visible || item.id==="settings")).map(item=>(
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
