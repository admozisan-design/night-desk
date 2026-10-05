"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import { defaultDispatchWidgets } from "@/lib/dispatch-widgets";
import { loadDispatchWidgets, saveDispatchWidgets } from "@/lib/storage";
import type { DispatchWidgetArea, DispatchWidgetId, DispatchWidgetSetting } from "@/lib/types";

const areaLabels:Record<DispatchWidgetArea,{title:string;description:string}>={
  left:{title:"左",description:"日付や共有メモなどの補助エリア"},
  center:{title:"中央",description:"メイン操作を置くエリア"},
  right:{title:"右",description:"確認用ウィジェットを置くエリア"},
  bottom:{title:"下",description:"横幅を使う大きなウィジェット向け"}
};

const descriptions:Record<DispatchWidgetId,string>={
  date:"表示する営業日を切り替える",
  sharedMemo:"スタッフ間の共有・引継ぎメモ",
  orderRegister:"電話受付からオーダーを登録",
  freeHolds:"キャスト未定のフリー予約を一時保管",
  reservations:"選択日の予約を一覧確認",
  board:"キャストとオーダーを時間軸で確認"
};

function clone(items:DispatchWidgetSetting[]){
  return items.map(item=>({...item}));
}

function normalize(items:DispatchWidgetSetting[]){
  const areas:DispatchWidgetArea[]=["left","center","right","bottom"];
  const next=clone(items);
  for(const area of areas){
    next
      .filter(item=>item.area===area)
      .sort((a,b)=>a.order-b.order)
      .forEach((item,index)=>{ item.order=index; });
  }
  return next;
}

export default function DispatchLayoutSettingsPage(){
  const [items,setItems]=useState<DispatchWidgetSetting[]>(clone(defaultDispatchWidgets));
  const [draggedId,setDraggedId]=useState<DispatchWidgetId|null>(null);
  const [saved,setSaved]=useState(false);
  const [dragOverArea,setDragOverArea]=useState<DispatchWidgetArea|null>(null);
  const [dragOverId,setDragOverId]=useState<DispatchWidgetId|null>(null);

  useEffect(()=>{
    setItems(normalize(loadDispatchWidgets(defaultDispatchWidgets)));
  },[]);

  const byArea=useMemo(()=>{
    const result={} as Record<DispatchWidgetArea,DispatchWidgetSetting[]>;
    (["left","center","right","bottom"] as DispatchWidgetArea[]).forEach(area=>{
      result[area]=items.filter(item=>item.area===area && item.visible).sort((a,b)=>a.order-b.order);
    });
    return result;
  },[items]);

  const hidden=items.filter(item=>!item.visible);

  function startDrag(e:DragEvent<HTMLElement>,id:DispatchWidgetId){
    setDraggedId(id);
    e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/plain",id);
  }

  function moveToArea(id:DispatchWidgetId,area:DispatchWidgetArea,targetId?:DispatchWidgetId){
    setItems(current=>{
      const target=current.find(item=>item.id===id);
      if(!target) return current;

      const other=current.filter(item=>item.id!==id);
      const areaItems=other.filter(item=>item.area===area && item.visible).sort((a,b)=>a.order-b.order);
      let insertIndex=areaItems.length;
      if(targetId){
        const found=areaItems.findIndex(item=>item.id===targetId);
        if(found>=0) insertIndex=found;
      }
      areaItems.splice(insertIndex,0,{...target,area,visible:true});

      const untouched=other.filter(item=>item.area!==area || !item.visible);
      return normalize([...untouched,...areaItems]);
    });
  }

  function onAreaDrop(e:DragEvent<HTMLElement>,area:DispatchWidgetArea,targetId?:DispatchWidgetId){
    e.preventDefault();
    const id=(draggedId || e.dataTransfer.getData("text/plain")) as DispatchWidgetId;
    if(id) moveToArea(id,area,targetId);
    setDraggedId(null);
    setDragOverArea(null);
    setDragOverId(null);
  }

  function hide(id:DispatchWidgetId){
    setItems(current=>normalize(current.map(item=>item.id===id?{...item,visible:false}:item)));
  }

  function show(id:DispatchWidgetId){
    const base=defaultDispatchWidgets.find(item=>item.id===id);
    moveToArea(id,base?.area??"left");
  }

  function save(){
    const next=normalize(items);
    setItems(next);
    saveDispatchWidgets(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function reset(){
    const next=clone(defaultDispatchWidgets);
    setItems(next);
    saveDispatchWidgets(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  return <div className="dispatchLayoutSettings">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">DISPATCH LAYOUT</p>
        <h1>配車管理レイアウト</h1>
        <p>ウィジェットをつかんで、置きたい場所へそのままドラッグしてください。</p>
      </div>
      <div className="masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button type="button" className="secondaryButton" onClick={reset}>初期状態に戻す</button>
        <button type="button" className="primaryButton" onClick={save}>保存</button>
      </div>
    </header>

    <section className="dispatchLayoutPreview panel">
      <div className="dispatchLayoutHint">
        <strong>画面を見たまま配置</strong>
        <span>カードの ☰ をつかんで、左・中央・右・下へ移動できます。</span>
      </div>

      <div className="dispatchLayoutBoard">
        {(Object.keys(areaLabels) as DispatchWidgetArea[]).map(area=>{
          const meta=areaLabels[area];
          return <div
            className={`dispatchLayoutZone zone-${area} ${dragOverArea===area?"isDragOver":""}`}
            key={area}
            onDragOver={e=>{e.preventDefault();setDragOverArea(area);}}
            onDragLeave={e=>{if(e.currentTarget===e.target)setDragOverArea(null);}}
            onDrop={e=>onAreaDrop(e,area)}
          >
            <div className="dispatchLayoutZoneHead">
              <strong>{meta.title}</strong>
              <span>{meta.description}</span>
            </div>

            <div className="dispatchLayoutZoneItems">
              {byArea[area].map(item=><article
                className={`dispatchLayoutWidgetCard ${draggedId===item.id?"isDragging":""} ${dragOverId===item.id?"isTarget":""}`}
                key={item.id}
                onDragOver={e=>{e.preventDefault();setDragOverArea(area);setDragOverId(item.id);}}
                onDrop={e=>onAreaDrop(e,area,item.id)}
              >
                <span
                  className="dispatchWidgetHandle"
                  draggable
                  onDragStart={e=>startDrag(e,item.id)}
                  onDragEnd={()=>{setDraggedId(null);setDragOverArea(null);setDragOverId(null);}}
                >☰</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{descriptions[item.id]}</small>
                </div>
                <button type="button" onClick={()=>hide(item.id)}>非表示</button>
              </article>)}
              {!byArea[area].length && <div className="dispatchLayoutEmpty">ここへドラッグ</div>}
            </div>
          </div>;
        })}
      </div>
    </section>

    <section className="panel dispatchHiddenWidgets">
      <div>
        <strong>非表示のウィジェット</strong>
        <span>「表示する」で元のおすすめ位置へ戻せます。</span>
      </div>
      <div className="dispatchHiddenWidgetList">
        {hidden.map(item=><article key={item.id}>
          <div><strong>{item.label}</strong><small>{descriptions[item.id]}</small></div>
          <button type="button" onClick={()=>show(item.id)}>表示する</button>
        </article>)}
        {!hidden.length && <p>非表示のウィジェットはありません。</p>}
      </div>
    </section>
  </div>;
}
