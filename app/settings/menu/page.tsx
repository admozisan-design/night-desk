"use client";

import { useEffect, useState } from "react";
import { defaultTopNavigation } from "@/lib/navigation";
import { loadTopNavigation, saveTopNavigation } from "@/lib/storage";
import type { TopNavItem } from "@/lib/types";

function cloneItems(items:TopNavItem[]){
  return items.map(item=>({...item}));
}

export default function MenuSettingsPage(){
  const [items,setItems]=useState<TopNavItem[]>(cloneItems(defaultTopNavigation));
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    setItems(cloneItems(loadTopNavigation(defaultTopNavigation)));
  },[]);

  function patch(id:TopNavItem["id"],changes:Partial<TopNavItem>){
    setItems(current=>current.map(item=>item.id===id?{...item,...changes}:item));
  }

  function move(index:number,direction:-1|1){
    const nextIndex=index+direction;
    if(nextIndex<0 || nextIndex>=items.length) return;
    const next=[...items];
    const [target]=next.splice(index,1);
    next.splice(nextIndex,0,target);
    setItems(next);
  }

  function save(){
    saveTopNavigation(items);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function reset(){
    const next=cloneItems(defaultTopNavigation);
    setItems(next);
    saveTopNavigation(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  return <div className="menuSettingsPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">NAVIGATION SETTINGS</p>
        <h1>上部メニュー設定</h1>
        <p>ヘッダーメニューの表示・順番・表示名を店舗に合わせて変更できます。</p>
      </div>
      <div className="masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button type="button" className="secondaryButton" onClick={reset}>初期状態に戻す</button>
        <button type="button" className="primaryButton" onClick={save}>保存</button>
      </div>
    </header>

    <section className="panel menuSettingsPanel">
      <div className="menuSettingsHelp">
        <strong>上から順にヘッダーへ表示されます</strong>
        <span>「設定」は管理画面へ戻れなくなるのを防ぐため非表示にはできません。</span>
      </div>

      <div className="menuSettingsList">
        {items.map((item,index)=><article className="menuSettingsRow" key={item.id}>
          <div className="menuOrderButtons">
            <button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label="上へ">↑</button>
            <button type="button" onClick={()=>move(index,1)} disabled={index===items.length-1} aria-label="下へ">↓</button>
          </div>

          <div className="menuSettingsIdentity">
            <span>リンク先</span>
            <strong>{item.href}</strong>
          </div>

          <label className="menuLabelEdit">表示名
            <input value={item.label} onChange={e=>patch(item.id,{label:e.target.value})}/>
          </label>

          <label className="menuVisibilityToggle">
            <input
              type="checkbox"
              checked={item.id==="settings" ? true : item.visible}
              disabled={item.id==="settings"}
              onChange={e=>patch(item.id,{visible:e.target.checked})}
            />
            <span>{item.id==="settings" ? "常時表示" : item.visible ? "表示" : "非表示"}</span>
          </label>
        </article>)}
      </div>
    </section>

    <section className="menuPreview panel">
      <span>プレビュー</span>
      <div>
        {items.filter(item=>item.visible || item.id==="settings").map(item=><b key={item.id}>{item.label || "名称未入力"}</b>)}
      </div>
    </section>
  </div>;
}
