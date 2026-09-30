"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FocusEvent } from "react";
import { defaultTopNavigation } from "@/lib/navigation";
import { loadTopNavigation } from "@/lib/storage";
import { CloudGate } from "@/components/cloud-gate";
import {cloudClient,cloudConfigured,cloudStatus,retryCloudSync,stopCloudSync,type CloudStatus} from "@/lib/cloud";
import type { TopNavItem } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [nav,setNav]=useState<TopNavItem[]>(defaultTopNavigation);
  const [cloud,setCloud]=useState<CloudStatus>(cloudStatus());
  const [email,setEmail]=useState("");

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

  useEffect(()=>{
    if(!cloudConfigured || !cloudClient) return;
    const refreshStatus=(event:Event)=>{
      setCloud((event as CustomEvent<CloudStatus>).detail);
      void cloudClient.auth.getUser().then(({data})=>setEmail(data.user?.email??""));
    };
    window.addEventListener("nightdesk:cloud-status",refreshStatus);
    void cloudClient.auth.getUser().then(({data})=>setEmail(data.user?.email??""));
    return ()=>window.removeEventListener("nightdesk:cloud-status",refreshStatus);
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
    <CloudGate><div className="appFrame" onFocusCapture={onNumberFocus} onBlurCapture={onNumberBlur}>
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
        {cloudConfigured
          ? <div className="consoleShop cloudConsoleShop">
              <span className={cloud.error?"offlineDot":"onlineDot"}/>
              <div><small>{cloud.error?"同期エラー":cloud.busy?"同期中…":cloud.connected?"クラウド同期":"接続中"}</small><strong title={email}>{email || "スタッフ"}</strong></div>
              {cloud.error && <button type="button" onClick={()=>void retryCloudSync()} title={cloud.error}>再試行</button>}
              <button type="button" onClick={()=>void (async()=>{await stopCloudSync(true);await cloudClient?.auth.signOut();})()}>ログアウト</button>
            </div>
          : <div className="consoleShop">
              <span className="onlineDot"/>
              <div><small>サンプルデータ</small><strong>サンプル店舗A</strong></div>
            </div>}
      </header>
      <main className="consoleMain">{children}</main>
    </div></CloudGate>
  );
}
