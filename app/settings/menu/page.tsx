"use client";

import { DragEvent, useEffect, useState } from "react";
import { defaultTopNavigation } from "@/lib/navigation";
import { loadTopNavigation, saveTopNavigation } from "@/lib/storage";
import type { TopNavItem } from "@/lib/types";

function cloneItems(items:TopNavItem[]){
  return items.map(item=>({...item}));
}

export default function MenuSettingsPage(){
  const [items,setItems]=useState<TopNavItem[]>(cloneItems(defaultTopNavigation));
  const [saved,setSaved]=useState(false);
  const [draggedId,setDraggedId]=useState<TopNavItem["id"]|null>(null);
  const [dragOverId,setDragOverId]=useState<TopNavItem["id"]|null>(null);

  useEffect(()=>{
    setItems(cloneItems(loadTopNavigation(defaultTopNavigation)));
  },[]);

  function patch(id:TopNavItem["id"],changes:Partial<TopNavItem>){
    setItems(current=>current.map(item=>item.id===id?{...item,...changes}:item));
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

  function onDragStart(e:DragEvent<HTMLElement>,id:TopNavItem["id"]){
    setDraggedId(id);
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",id);
  }

  function onDragOver(e:DragEvent<HTMLElement>,id:TopNavItem["id"]){
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    if(id!==draggedId) setDragOverId(id);
  }

  function onDrop(e:DragEvent<HTMLElement>,targetId:TopNavItem["id"]){
    e.preventDefault();
    const sourceId=(draggedId || e.dataTransfer.getData("text/plain")) as TopNavItem["id"];
    if(!sourceId || sourceId===targetId){
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    setItems(current=>{
      const from=current.findIndex(item=>item.id===sourceId);
      const to=current.findIndex(item=>item.id===targetId);
      if(from<0 || to<0) return current;
      const next=[...current];
      const [moved]=next.splice(from,1);
      next.splice(to,0,moved);
      return next;
    });
    setDraggedId(null);
    setDragOverId(null);
  }

  function onDragEnd(){
    setDraggedId(null);
    setDragOverId(null);
  }

  return <div className="menuSettingsPage dragMenuSettingsPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">NAVIGATION SETTINGS</p>
        <h1>上部メニュー設定</h1>
        <p>下のカードをドラッグするだけで、ヘッダーメニューの順番を変更できます。</p>
      </div>
      <div className="masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button type="button" className="secondaryButton" onClick={reset}>初期状態に戻す</button>
        <button type="button" className="primaryButton" onClick={save}>保存</button>
      </div>
    </header>

    <section className="panel dragMenuPanel">
      <div className="dragMenuHelp">
        <div>
          <strong>メニューを並び替える</strong>
          <span>左上の「☰」をつかんで、そのまま好きな位置へドラッグしてください。</span>
        </div>
        <small>「設定」は常時表示です。</small>
      </div>

      <div className="dragMenuBoard">
        {items.map((item,index)=><article
          key={item.id}
          className={[
            "dragMenuCard",
            draggedId===item.id?"isDragging":"",
            dragOverId===item.id?"isDragOver":"",
            item.visible || item.id==="settings" ? "" : "isHiddenMenu"
          ].filter(Boolean).join(" ")}
          onDragOver={e=>onDragOver(e,item.id)}
          onDrop={e=>onDrop(e,item.id)}
        >
          <div className="dragMenuCardTop">
            <span
              className="dragMenuHandle"
              draggable
              onDragStart={e=>onDragStart(e,item.id)}
              onDragEnd={onDragEnd}
              title="ドラッグして移動"
            >☰</span>
            <span className="dragMenuNumber">{index+1}</span>
            <label className="dragMenuToggle">
              <input
                type="checkbox"
                checked={item.id==="settings" ? true : item.visible}
                disabled={item.id==="settings"}
                onChange={e=>patch(item.id,{visible:e.target.checked})}
              />
              <span>{item.id==="settings" ? "常時表示" : item.visible ? "表示" : "非表示"}</span>
            </label>
          </div>

          <label className="dragMenuLabel">表示名
            <input value={item.label} onChange={e=>patch(item.id,{label:e.target.value})}/>
          </label>

          <div className="dragMenuDestination">
            <span>リンク先</span>
            <strong>{item.href}</strong>
          </div>
        </article>)}
      </div>
    </section>

    <section className="panel dragMenuPreview">
      <div>
        <span>現在の並び</span>
        <small>保存すると上部メニューへ反映されます</small>
      </div>
      <div className="dragMenuPreviewItems">
        {items.filter(item=>item.visible || item.id==="settings").map(item=><b key={item.id}>{item.label || "名称未入力"}</b>)}
      </div>
    </section>
  </div>;
}
