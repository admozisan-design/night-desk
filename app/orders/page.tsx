"use client";

import { useEffect, useMemo, useState } from "react";
import { formatYen } from "@/lib/pricing";
import { loadOrders, updateOrder } from "@/lib/storage";
import type { Order } from "@/lib/types";

function dateValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return [y,m,d].join("-");
}
function orderDate(order:Order){
  if(order.serviceDate) return order.serviceDate;
  return dateValue(new Date(order.createdAt));
}
function normalizePhone(value:string){
  return value.replace(/\D/g,"");
}
function nominationLabel(value:Order["nominationType"]){
  if(value==="photo") return "写真指名";
  if(value==="repeat") return "本指名";
  return "フリー";
}
type ViewMode="date"|"future";

export default function OrdersPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [selectedDate,setSelectedDate]=useState(()=>dateValue(new Date()));
  const [phoneQuery,setPhoneQuery]=useState("");
  const [viewMode,setViewMode]=useState<ViewMode>("date");
  const [noteDrafts,setNoteDrafts]=useState<Record<string,string>>({});

  useEffect(()=>{
    const refresh=()=>{
      const loaded=loadOrders();
      setOrders(loaded);
      setNoteDrafts(current=>{
        const next={...current};
        for(const order of loaded){
          if(next[order.id]===undefined) next[order.id]=order.handoffNote??"";
        }
        return next;
      });
    };
    refresh();
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("storage",refresh);
    return ()=>{
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("storage",refresh);
    };
  },[]);

  const today=dateValue(new Date());
  const tomorrow=useMemo(()=>{
    const d=new Date();
    d.setDate(d.getDate()+1);
    return dateValue(d);
  },[]);

  const filtered=useMemo(()=>{
    const phone=normalizePhone(phoneQuery);
    return orders
      .filter(order=>{
        const serviceDate=orderDate(order);
        const dateMatches=viewMode==="future" ? serviceDate>=tomorrow : serviceDate===selectedDate;
        if(!dateMatches) return false;
        if(!phone) return true;
        return normalizePhone(order.customerPhone??"").includes(phone);
      })
      .sort((a,b)=>{
        const dateCompare=orderDate(a).localeCompare(orderDate(b));
        if(dateCompare!==0) return dateCompare;
        return a.scheduledStart.localeCompare(b.scheduledStart);
      });
  },[orders,phoneQuery,viewMode,selectedDate,tomorrow]);

  function chooseDate(value:string){
    setSelectedDate(value);
    setViewMode("date");
  }

  function saveHandoffNote(order:Order){
    const value=noteDrafts[order.id]??"";
    if(value===(order.handoffNote??"")) return;
    setOrders(updateOrder(order.id,{handoffNote:value}));
  }

  function editOrder(order:Order){
    window.location.href="/?editOrder="+encodeURIComponent(order.id);
  }

  return <div className="reservationPage">
    <header className="pageHeader reservationHeader">
      <div>
        <p className="eyebrow">RESERVATIONS</p>
        <h1>予約一覧</h1>
        <p>日付・電話番号から予約を確認し、引継ぎ情報を管理します。</p>
      </div>
      <div className="reservationCount">
        <span>表示中</span>
        <strong>{filtered.length}</strong>
        <small>件</small>
      </div>
    </header>

    <section className="panel reservationSearchPanel">
      <div className="reservationDateSearch">
        <label>予約日
          <input type="date" value={selectedDate} onChange={e=>chooseDate(e.target.value)}/>
        </label>
        <div className="reservationQuickDates">
          <button type="button" className={viewMode==="date"&&selectedDate===today?"active":""} onClick={()=>chooseDate(today)}>今日</button>
          <button type="button" className={viewMode==="date"&&selectedDate===tomorrow?"active":""} onClick={()=>chooseDate(tomorrow)}>明日</button>
          <button type="button" className={viewMode==="future"?"active":""} onClick={()=>setViewMode("future")}>明日以降</button>
        </div>
      </div>

      <label className="reservationPhoneSearch">電話番号検索
        <input
          value={phoneQuery}
          inputMode="tel"
          placeholder="09012345678"
          onChange={e=>setPhoneQuery(e.target.value)}
        />
      </label>
    </section>

    <section className="panel reservationListPanel">
      <div className="reservationListHead">
        <div>
          <strong>{viewMode==="future"?"明日以降の予約":selectedDate+" の予約"}</strong>
          {phoneQuery && <span> / 電話番号「{phoneQuery}」</span>}
        </div>
        <span>{filtered.length}件</span>
      </div>

      {filtered.length>0
        ? <div className="reservationList">
            {filtered.map(order=><article key={order.id} className="reservationCard">
              <div className="reservationMain">
                <div className="reservationWhen">
                  <span>{orderDate(order)}</span>
                  <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                </div>
                <div className="reservationCast">
                  <strong>{order.castName}</strong>
                  <span>{order.courseMinutes+(order.extensionMinutes??0)}分 / {nominationLabel(order.nominationType)}</span>
                </div>
                <div className="reservationPlace">
                  <strong>{order.locationName || "場所未入力"}{order.room ? " / "+order.room+"号室" : ""}</strong>
                  <span>{order.driverName??"ドライバー未割当"}</span>
                </div>
                <div className="reservationCustomer">
                  <span>電話番号</span>
                  <strong>{order.customerPhone || "未入力"}</strong>
                </div>
                <div className="reservationPrice">
                  <span>{order.paymentMethod==="card"?"カード":"現金"}</span>
                  <strong>{formatYen(order.total)}</strong>
                </div>
              </div>

              <div className="reservationOptions">
                <span>OP</span>
                <strong>{order.selectedOptions?.length ? order.selectedOptions.join(" / ") : "なし"}</strong>
              </div>

              <label className="reservationHandoff">引継ぎ備考
                <textarea
                  rows={2}
                  value={noteDrafts[order.id]??""}
                  placeholder="次のスタッフに伝えたい内容を入力"
                  onChange={e=>setNoteDrafts(current=>({...current,[order.id]:e.target.value}))}
                  onBlur={()=>saveHandoffNote(order)}
                />
                <small>入力内容はフォーカスを外すと自動保存されます</small>
              </label>

              <div className="reservationCardFooter">
                <span>受付備考：{order.note || "なし"}</span>
                <button type="button" className="reservationEditButton" onClick={()=>editOrder(order)}>修正</button>
              </div>
            </article>)}
          </div>
        : <div className="reservationEmpty">
            <strong>該当する予約はありません</strong>
            <p>{viewMode==="future"?"明日以降の予約はまだ登録されていません。":"日付または電話番号を変更して検索してください。"}</p>
          </div>}
    </section>
  </div>;
}
