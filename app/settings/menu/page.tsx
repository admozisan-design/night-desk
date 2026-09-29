"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import { defaultTopNavigation, settingsNavigationCatalog } from "@/lib/navigation";
import { loadTopNavigation, saveTopNavigation } from "@/lib/storage";
import type { TopNavItem } from "@/lib/types";

type DragSource="menu"|"catalog";

function cloneItems(items:TopNavItem[]){
  return items.map(item=>({...item}));
}

export default function MenuSettingsPage(){
  const [items,setItems]=useState<TopNavItem[]>(cloneItems(defaultTopNavigation));
  const [saved,setSaved]=useState(false);
  const [draggedId,setDraggedId]=useState<string|null>(null);
  const [dragSource,setDragSource]=useState<DragSource|null>(null);
  const [dragOverId,setDragOverId]=useState<string|null>(null);
  const [menuDropActive,setMenuDropActive]=useState(false);
  const [catalogDropActive,setCatalogDropActive]=useState(false);

  useEffect(()=>{
    setItems(cloneItems(loadTopNavigation(defaultTopNavigation)));
  },[]);

  const menuItems=useMemo(()=>items.filter(item=>item.inMenu!==false),[items]);
  const addedIds=useMemo(()=>new Set(menuItems.map(item=>item.id)),[menuItems]);

  function patch(id:string,changes:Partial<TopNavItem>){
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

  function dragPayload(e:DragEvent<HTMLElement>,id:string,source:DragSource){
    setDraggedId(id);
    setDragSource(source);
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",JSON.stringify({id,source}));
  }

  function readPayload(e:DragEvent<HTMLElement>){
    if(draggedId && dragSource) return {id:draggedId,source:dragSource};
    try{
      return JSON.parse(e.dataTransfer.getData("text/plain")) as {id:string;source:DragSource};
    }catch{
      return null;
    }
  }

  function clearDrag(){
    setDraggedId(null);
    setDragSource(null);
    setDragOverId(null);
    setMenuDropActive(false);
    setCatalogDropActive(false);
  }

  function addCatalogItem(id:string,targetId?:string){
    const catalogItem=settingsNavigationCatalog.find(item=>item.id===id);
    if(!catalogItem) return;

    setItems(current=>{
      const existing=current.find(item=>item.id===id);
      let next=current.filter(item=>item.id!==id);
      const added:TopNavItem=existing
        ? {...existing,inMenu:true,visible:true}
        : {...catalogItem,inMenu:true,visible:true};

      if(targetId){
        const targetIndex=next.findIndex(item=>item.id===targetId);
        if(targetIndex>=0){
          next.splice(targetIndex,0,added);
          return next;
        }
      }
      return [...next,added];
    });
  }

  function reorderMenu(sourceId:string,targetId:string){
    if(sourceId===targetId) return;
    setItems(current=>{
      const from=current.findIndex(item=>item.id===sourceId);
      const to=current.findIndex(item=>item.id===targetId);
      if(from<0 || to<0) return current;
      const next=[...current];
      const [moved]=next.splice(from,1);
      const newTarget=next.findIndex(item=>item.id===targetId);
      next.splice(newTarget<0?next.length:newTarget,0,moved);
      return next;
    });
  }

  function onCardDragOver(e:DragEvent<HTMLElement>,targetId:string){
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOverId(targetId);
  }

  function onCardDrop(e:DragEvent<HTMLElement>,targetId:string){
    e.preventDefault();
    const payload=readPayload(e);
    if(!payload) return clearDrag();
    if(payload.source==="catalog") addCatalogItem(payload.id,targetId);
    else reorderMenu(payload.id,targetId);
    clearDrag();
  }

  function onMenuDrop(e:DragEvent<HTMLElement>){
    e.preventDefault();
    const payload=readPayload(e);
    if(payload?.source==="catalog") addCatalogItem(payload.id);
    clearDrag();
  }

  function onCatalogDrop(e:DragEvent<HTMLElement>){
    e.preventDefault();
    const payload=readPayload(e);
    if(payload?.source==="menu" && payload.id!=="settings"){
      const isSettingsItem=settingsNavigationCatalog.some(item=>item.id===payload.id);
      if(isSettingsItem) patch(payload.id,{inMenu:false});
    }
    clearDrag();
  }

  function removeFromMenu(id:string){
    if(id==="settings") return;
    const isSettingsItem=settingsNavigationCatalog.some(item=>item.id===id);
    if(isSettingsItem) patch(id,{inMenu:false});
  }

  return <div className="menuSettingsPage dragMenuSettingsPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">NAVIGATION SETTINGS</p>
        <h1>上部メニュー設定</h1>
        <p>上のメニューを並び替えたり、下の設定項目をドラッグして追加できます。</p>
      </div>
      <div className="masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button type="button" className="secondaryButton" onClick={reset}>初期状態に戻す</button>
        <button type="button" className="primaryButton" onClick={save}>保存</button>
      </div>
    </header>

    <section className={`panel dragMenuPanel ${menuDropActive?"isDropActive":""}`}
      onDragOver={e=>{e.preventDefault();setMenuDropActive(true);}}
      onDragLeave={e=>{if(e.currentTarget===e.target)setMenuDropActive(false);}}
      onDrop={onMenuDrop}
    >
      <div className="dragMenuHelp">
        <div>
          <strong>現在のメニューバー</strong>
          <span>☰をドラッグして並び替え。下の設定一覧からここへ持ってくると追加できます。</span>
        </div>
        <small>「設定」は常時表示です。</small>
      </div>

      <div className="dragMenuBoard">
        {menuItems.map((item,index)=><article
          key={item.id}
          className={[
            "dragMenuCard",
            draggedId===item.id?"isDragging":"",
            dragOverId===item.id?"isDragOver":"",
            item.visible || item.id==="settings" ? "" : "isHiddenMenu"
          ].filter(Boolean).join(" ")}
          onDragOver={e=>onCardDragOver(e,item.id)}
          onDrop={e=>onCardDrop(e,item.id)}
        >
          <div className="dragMenuCardTop">
            <span
              className="dragMenuHandle"
              draggable
              onDragStart={e=>dragPayload(e,item.id,"menu")}
              onDragEnd={clearDrag}
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
            <div><span>リンク先</span><strong>{item.href}</strong></div>
            {settingsNavigationCatalog.some(setting=>setting.id===item.id) && <button type="button" onClick={()=>removeFromMenu(item.id)}>外す</button>}
          </div>
        </article>)}
      </div>
    </section>

    <section className={`panel settingsMenuCatalog ${catalogDropActive?"isDropActive":""}`}
      onDragOver={e=>{e.preventDefault();setCatalogDropActive(true);}}
      onDragLeave={e=>{if(e.currentTarget===e.target)setCatalogDropActive(false);}}
      onDrop={onCatalogDrop}
    >
      <div className="settingsMenuCatalogHead">
        <div>
          <strong>設定メニュー一覧</strong>
          <span>使いたい項目を上の「現在のメニューバー」へドラッグ</span>
        </div>
        <small>{settingsNavigationCatalog.length}項目</small>
      </div>

      <div className="settingsMenuCatalogGrid">
        {settingsNavigationCatalog.map(item=>{
          const added=addedIds.has(item.id);
          return <article
            key={item.id}
            className={`settingsMenuCatalogCard ${added?"isAdded":""}`}
            draggable={!added}
            onDragStart={e=>!added && dragPayload(e,item.id,"catalog")}
            onDragEnd={clearDrag}
          >
            <div className="settingsCatalogDrag">☰</div>
            <div className="settingsCatalogInfo">
              <strong>{item.label}</strong>
              <span>{item.href}</span>
            </div>
            {added
              ? <em>追加済み</em>
              : <button type="button" onClick={()=>addCatalogItem(item.id)}>＋ 追加</button>}
          </article>;
        })}
      </div>
    </section>

    <section className="panel dragMenuPreview">
      <div>
        <span>現在の並び</span>
        <small>保存すると上部メニューへ反映されます</small>
      </div>
      <div className="dragMenuPreviewItems">
        {menuItems.filter(item=>item.visible || item.id==="settings").map(item=><b key={item.id}>{item.label || "名称未入力"}</b>)}
      </div>
    </section>
  </div>;
}
