"use client";

import { useEffect, useMemo, useState } from "react";
import { casts as defaultCasts } from "@/lib/mock-data";
import { formatYen } from "@/lib/pricing";
import { loadCastSettlementAdjustments, loadCasts, loadOrders, saveCastSettlementAdjustment } from "@/lib/storage";
import type { Cast, CastSettlementAdjustment, Order } from "@/lib/types";

function dateValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function orderDate(order:Order){
  if(order.serviceDate) return order.serviceDate;
  return dateValue(new Date(order.createdAt));
}

function nominationLabel(type:Order["nominationType"]){
  if(type==="photo") return "写真指名";
  if(type==="repeat") return "本指名";
  return "フリー";
}

function baseBack(order:Order,cast:Cast){
  if(order.nominationType==="photo") return cast.photoUnitPrice ?? cast.unitPrice ?? 0;
  if(order.nominationType==="repeat") return cast.repeatUnitPrice ?? cast.unitPrice ?? 0;
  return cast.freeUnitPrice ?? cast.unitPrice ?? 0;
}

function emptyAdjustment(orderId:string):CastSettlementAdjustment{
  return {orderId,optionBack:0,extensionBack:0,adjustment:0,memo:""};
}

export default function SettlementPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [casts,setCasts]=useState<Cast[]>(defaultCasts);
  const [adjustments,setAdjustments]=useState<Record<string,CastSettlementAdjustment>>({});
  const [date,setDate]=useState(()=>dateValue(new Date()));
  const [castId,setCastId]=useState("");
  const [savedOrderId,setSavedOrderId]=useState<string|null>(null);

  useEffect(()=>{
    const refresh=()=>{
      const loadedCasts=loadCasts(defaultCasts);
      setOrders(loadOrders());
      setCasts(loadedCasts);
      setAdjustments(loadCastSettlementAdjustments());
      setCastId(current=>current || loadedCasts.find(c=>c.visible!==false)?.id || loadedCasts[0]?.id || "");
    };
    refresh();
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:settlement",refresh);
    return ()=>{
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:settlement",refresh);
    };
  },[]);

  const activeCasts=casts.filter(c=>c.visible!==false);
  const selectedCast=casts.find(c=>c.id===castId);

  const settlementOrders=useMemo(()=>orders
    .filter(order=>order.status!=="cancelled" && order.castId===castId && orderDate(order)===date)
    .sort((a,b)=>a.scheduledStart.localeCompare(b.scheduledStart)),[orders,castId,date]);

  const rows=settlementOrders.map(order=>{
    const adjustment=adjustments[order.id] ?? emptyAdjustment(order.id);
    const base=selectedCast ? baseBack(order,selectedCast) : 0;
    const subtotal=base+adjustment.optionBack+adjustment.extensionBack+adjustment.adjustment;
    return {order,adjustment,base,subtotal};
  });

  const totals=rows.reduce((acc,row)=>({
    base:acc.base+row.base,
    option:acc.option+row.adjustment.optionBack,
    extension:acc.extension+row.adjustment.extensionBack,
    adjustment:acc.adjustment+row.adjustment.adjustment,
    payout:acc.payout+row.subtotal
  }),{base:0,option:0,extension:0,adjustment:0,payout:0});

  function updateAdjustment(orderId:string,changes:Partial<CastSettlementAdjustment>){
    setAdjustments(current=>{
      const base=current[orderId] ?? emptyAdjustment(orderId);
      return {...current,[orderId]:{...base,...changes}};
    });
  }

  function saveRow(orderId:string){
    const value=adjustments[orderId] ?? emptyAdjustment(orderId);
    saveCastSettlementAdjustment(value);
    setSavedOrderId(orderId);
    window.setTimeout(()=>setSavedOrderId(current=>current===orderId?null:current),1100);
  }

  function saveAll(){
    for(const row of rows){
      saveCastSettlementAdjustment(adjustments[row.order.id] ?? emptyAdjustment(row.order.id));
    }
    setSavedOrderId("all");
    window.setTimeout(()=>setSavedOrderId(null),1200);
  }

  return <div className="settlementPage">
    <header className="pageHeader settlementHeader">
      <div>
        <p className="eyebrow">CAST SETTLEMENT</p>
        <h1>キャスト精算</h1>
        <p>オーダー実績とキャスト単価から、その日の支給額を確認・調整します。</p>
      </div>
      <div className="settlementHeaderActions">
        {savedOrderId==="all" && <span className="saveToast">一括保存しました</span>}
        <button type="button" className="primaryButton" onClick={saveAll} disabled={!rows.length}>精算内容を一括保存</button>
      </div>
    </header>

    <section className="settlementFilters panel">
      <label>精算日
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </label>
      <label>キャスト
        <select value={castId} onChange={e=>setCastId(e.target.value)}>
          {activeCasts.map(cast=><option key={cast.id} value={cast.id}>{cast.name}</option>)}
        </select>
      </label>
      {selectedCast && <div className="settlementRates">
        <span>フリー <strong>{formatYen(selectedCast.freeUnitPrice??selectedCast.unitPrice??0)}</strong></span>
        <span>写指 <strong>{formatYen(selectedCast.photoUnitPrice??selectedCast.unitPrice??0)}</strong></span>
        <span>本指 <strong>{formatYen(selectedCast.repeatUnitPrice??selectedCast.unitPrice??0)}</strong></span>
      </div>}
    </section>

    <section className="settlementSummary">
      <div><span>本数</span><strong>{rows.length}</strong><small>本</small></div>
      <div><span>基本バック</span><strong>{formatYen(totals.base)}</strong></div>
      <div><span>OPバック</span><strong>{formatYen(totals.option)}</strong></div>
      <div><span>延長バック</span><strong>{formatYen(totals.extension)}</strong></div>
      <div><span>その他調整</span><strong>{formatYen(totals.adjustment)}</strong></div>
      <div className="settlementPayout"><span>支給合計</span><strong>{formatYen(totals.payout)}</strong></div>
    </section>

    <section className="panel settlementPanel">
      <div className="settlementTable">
        <div className="settlementRow settlementTableHead">
          <span>時間 / 内容</span>
          <span>区分</span>
          <span>基本バック</span>
          <span>OPバック</span>
          <span>延長バック</span>
          <span>その他調整</span>
          <span>小計</span>
          <span>保存</span>
        </div>

        {rows.map(({order,adjustment,base,subtotal})=><div className="settlementRow" key={order.id}>
          <div className="settlementOrderInfo">
            <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
            <span>{order.courseMinutes+(order.extensionMinutes??0)}分 / {order.locationName || "場所未入力"}</span>
            <small>{order.selectedOptions?.length ? order.selectedOptions.join(" / ") : "OPなし"}</small>
          </div>
          <strong className="settlementNomination">{nominationLabel(order.nominationType)}</strong>
          <strong>{formatYen(base)}</strong>
          <input type="number" step="500" value={adjustment.optionBack} onChange={e=>updateAdjustment(order.id,{optionBack:Number(e.target.value)})}/>
          <input type="number" step="500" value={adjustment.extensionBack} onChange={e=>updateAdjustment(order.id,{extensionBack:Number(e.target.value)})}/>
          <div className="settlementAdjustmentCell">
            <input type="number" step="500" value={adjustment.adjustment} onChange={e=>updateAdjustment(order.id,{adjustment:Number(e.target.value)})}/>
            <input className="settlementMemo" value={adjustment.memo??""} onChange={e=>updateAdjustment(order.id,{memo:e.target.value})} placeholder="メモ"/>
          </div>
          <strong className="settlementSubtotal">{formatYen(subtotal)}</strong>
          <button type="button" className="settlementSaveButton" onClick={()=>saveRow(order.id)}>
            {savedOrderId===order.id ? "保存済み" : "保存"}
          </button>
        </div>)}

        {!rows.length && <div className="settlementEmpty">
          <strong>精算対象のオーダーがありません</strong>
          <p>日付とキャストを確認してください。キャンセル済みオーダーは精算対象外です。</p>
        </div>}
      </div>
    </section>

    <section className="settlementHelp">
      <strong>計算ルール</strong>
      <p>基本バックはキャスト登録の「フリー / 写真指名 / 本指名」単価を使用します。OPバック・延長バック・その他調整は精算時に入力し、その他調整はマイナス入力で控除にも使えます。</p>
    </section>
  </div>;
}
