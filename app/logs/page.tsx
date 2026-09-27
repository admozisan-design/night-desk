"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAuditLogs } from "@/lib/storage";
import type { AuditLog } from "@/lib/types";

export default function LogsPage(){
  const [logs,setLogs]=useState<AuditLog[]>([]);
  const [query,setQuery]=useState("");

  useEffect(()=>{
    const refresh=()=>setLogs(loadAuditLogs());
    refresh();
    window.addEventListener("nightdesk:logs",refresh);
    return ()=>window.removeEventListener("nightdesk:logs",refresh);
  },[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return logs;
    return logs.filter(log=>
      log.actor.toLowerCase().includes(q) ||
      log.category.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      (log.detail??"").toLowerCase().includes(q)
    );
  },[logs,query]);

  return <div className="logManagementPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">ACTIVITY LOG</p>
        <h1>操作履歴</h1>
        <p>受付・設定変更・マスタ保存などの操作を確認します。</p>
      </div>
      <div className="logCount"><strong>{filtered.length}</strong><span>件</span></div>
    </header>

    <div className="logToolbar">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="操作・カテゴリ・内容で検索"/>
    </div>

    <section className="panel logPanel">
      <div className="logTable">
        <div className="logRow logHead">
          <span>日時</span><span>担当</span><span>カテゴリ</span><span>操作</span><span>内容</span>
        </div>
        {filtered.map(log=><div className="logRow" key={log.id}>
          <span>{new Date(log.createdAt).toLocaleString("ja-JP")}</span>
          <strong>{log.actor}</strong>
          <span className="logCategory">{log.category}</span>
          <strong>{log.action}</strong>
          <span>{log.detail||"—"}</span>
        </div>)}
        {!filtered.length&&<div className="masterEmpty compact">操作履歴はまだありません。今後の保存・受付操作から記録されます。</div>}
      </div>
    </section>
  </div>
}