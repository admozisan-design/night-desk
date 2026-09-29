"use client";

import { useEffect, useMemo, useState } from "react";
import { casts as defaultCasts, defaultStoreSettings } from "@/lib/mock-data";
import { exportDailyExcel, exportDailyPdf } from "@/lib/end-of-day-export";
import { formatYen } from "@/lib/pricing";
import { loadCasts, loadOrders, loadStoreSettings } from "@/lib/storage";
import type { Cast, Order } from "@/lib/types";

function dateInputValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function orderServiceDate(order:Order){
  return order.serviceDate || dateInputValue(new Date(order.createdAt));
}

function castShiftForDate(cast:Cast,date:string){
  return cast.schedule?.find(shift=>shift.date===date);
}

export default function ClosingPage(){
  const [date,setDate]=useState(()=>dateInputValue(new Date()));
  const [orders,setOrders]=useState<Order[]>([]);
  const [casts,setCasts]=useState<Cast[]>(defaultCasts);
  const [storeSettings,setStoreSettings]=useState(defaultStoreSettings);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCasts(loadCasts(defaultCasts));
      setStoreSettings(loadStoreSettings(defaultStoreSettings));
    };
    refresh();
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:store-settings",refresh);
    return ()=>{
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:store-settings",refresh);
    };
  },[]);

  const selectedOrders=useMemo(
    ()=>orders.filter(order=>orderServiceDate(order)===date),
    [orders,date]
  );

  const workingCasts=useMemo(
    ()=>casts.filter(cast=>{
      if(cast.visible===false) return false;
      const shift=castShiftForDate(cast,date);
      return shift ? shift.working : cast.scheduledToday!==false;
    }),
    [casts,date]
  );

  const validOrders=selectedOrders.filter(order=>order.status!=="cancelled");
  const cancelledOrders=selectedOrders.filter(order=>order.status==="cancelled");
  const orderRevenue=(order:Order)=>order.status==="cancelled" ? (order.cancelFee??0) : order.total;
  const cashSales=selectedOrders
    .filter(order=>order.paymentMethod!=="card")
    .reduce((sum,order)=>sum+orderRevenue(order),0);
  const cardSales=selectedOrders
    .filter(order=>order.paymentMethod==="card")
    .reduce((sum,order)=>sum+orderRevenue(order),0);
  const totalSales=cashSales+cardSales;
  const cancelledCount=cancelledOrders.length;
  const cancelFeeTotal=cancelledOrders.reduce((sum,order)=>sum+(order.cancelFee??0),0);

  return <div className="closingPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">CLOSING</p>
        <h1>締め作業</h1>
        <p>営業日の内容を確認して、終業データをExcelまたはPDFで保存します。</p>
      </div>
    </header>

    <section className="panel closingDatePanel">
      <label>対象日
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </label>
      <button type="button" onClick={()=>setDate(dateInputValue(new Date()))}>今日に戻す</button>
    </section>

    <section className="closingSummary">
      <div><span>出勤キャスト</span><strong>{workingCasts.length}</strong><small>人</small></div>
      <div><span>オーダー</span><strong>{validOrders.length}</strong><small>件</small></div>
      <div><span>キャンセル</span><strong>{cancelledCount}件</strong><small>料金 {formatYen(cancelFeeTotal)}</small></div>
      <div><span>現金売上</span><strong>{formatYen(cashSales)}</strong></div>
      <div><span>カード売上</span><strong>{formatYen(cardSales)}</strong></div>
      <div className="closingSummaryTotal"><span>売上合計</span><strong>{formatYen(totalSales)}</strong></div>
    </section>

    <section className="panel closingExportPanel">
      <div className="closingExportInfo">
        <strong>{date} の締めデータ</strong>
        <span>営業時間 {storeSettings.openTime}〜{storeSettings.closeTime}</span>
        <p>オーダー明細、キャスト別集計、売上、備考、引継ぎ備考、キャンセル履歴を保存します。</p>
      </div>

      <div className="closingExportButtons">
        <button
          type="button"
          className="closingExcelButton"
          onClick={()=>void exportDailyExcel({date,orders:selectedOrders,casts:workingCasts,storeSettings})}
        >
          <span>Excel</span>
          <strong>Excelで保存</strong>
          <small>.xlsx / 3シート</small>
        </button>

        <button
          type="button"
          className="closingPdfButton"
          onClick={()=>exportDailyPdf({date,orders:selectedOrders,casts:workingCasts,storeSettings})}
        >
          <span>PDF</span>
          <strong>PDFで保存</strong>
          <small>印刷画面からPDF保存</small>
        </button>
      </div>
    </section>

    <section className="panel closingCheckPanel">
      <div className="closingCheckHead">
        <strong>保存前チェック</strong>
        <span>{selectedOrders.length}件の登録データ</span>
      </div>
      <div className="closingCheckGrid">
        <div><span>電話番号</span><strong>{selectedOrders.filter(order=>Boolean(order.customerPhone)).length}/{selectedOrders.length}</strong></div>
        <div><span>ドライバー</span><strong>{selectedOrders.filter(order=>Boolean(order.driverName)).length}/{selectedOrders.length}</strong></div>
        <div><span>利用場所</span><strong>{selectedOrders.filter(order=>Boolean(order.locationName)).length}/{selectedOrders.length}</strong></div>
        <div><span>備考あり</span><strong>{selectedOrders.filter(order=>Boolean(order.note || order.handoffNote)).length}/{selectedOrders.length}</strong></div>
      </div>
    </section>
  </div>;
}
