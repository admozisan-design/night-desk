"use client";

import { useEffect, useMemo, useState } from "react";
import { formatYen } from "@/lib/pricing";
import { loadOrders } from "@/lib/storage";
import type { Order } from "@/lib/types";

function dateValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export default function SalesPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [date,setDate]=useState(dateValue(new Date()));
  const [allPeriod,setAllPeriod]=useState(false);

  useEffect(()=>{
    const refresh=()=>setOrders(loadOrders());
    refresh();
    window.addEventListener("nightdesk:orders",refresh);
    return ()=>window.removeEventListener("nightdesk:orders",refresh);
  },[]);

  const periodOrders=useMemo(()=>orders.filter(order=>{
    if(allPeriod) return true;
    const serviceDate=order.serviceDate ?? dateValue(new Date(order.createdAt));
    return serviceDate===date;
  }),[orders,date,allPeriod]);
  const salesOrders=useMemo(()=>periodOrders.filter(order=>order.status!=="cancelled"),[periodOrders]);
  const cancelFeeTotal=periodOrders
    .filter(order=>order.status==="cancelled")
    .reduce((sum,order)=>sum+(order.cancelFee??0),0);

  const total=salesOrders.reduce((sum,order)=>sum+order.total,0)+cancelFeeTotal;
  const optionTotal=salesOrders.reduce((sum,order)=>sum+order.optionsTotal,0);
  const average=salesOrders.length?Math.round(salesOrders.reduce((sum,order)=>sum+order.total,0)/salesOrders.length):0;

  const castRows=useMemo(()=>{
    const map=new Map<string,{name:string,count:number,total:number}>();
    for(const order of salesOrders){
      const current=map.get(order.castId)??{name:order.castName,count:0,total:0};
      current.count+=1;
      current.total+=order.total;
      map.set(order.castId,current);
    }
    return [...map.values()].sort((a,b)=>b.total-a.total);
  },[salesOrders]);

  const dailyRows=useMemo(()=>{
    const map=new Map<string,{date:string,count:number,total:number}>();
    for(const order of orders){
      const key=order.serviceDate ?? dateValue(new Date(order.createdAt));
      const current=map.get(key)??{date:key,count:0,total:0};
      if(order.status!=="cancelled") current.count+=1;
      current.total+=order.status==="cancelled" ? (order.cancelFee??0) : order.total;
      map.set(key,current);
    }
    return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,31);
  },[orders]);

  return <div className="salesManagementPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">SALES</p>
        <h1>売上管理</h1>
        <p>日別・キャスト別の売上と本数を確認します。</p>
      </div>
      <div className="salesFilter">
        <input type="date" value={date} disabled={allPeriod} onChange={e=>setDate(e.target.value)}/>
        <button className={allPeriod?"active":""} type="button" onClick={()=>setAllPeriod(value=>!value)}>{allPeriod?"日別に戻す":"全期間"}</button>
      </div>
    </header>

    <section className="salesKpis">
      <div><span>売上</span><strong>{formatYen(total)}</strong></div>
      <div><span>本数</span><strong>{salesOrders.length}本</strong></div>
      <div><span>平均単価</span><strong>{formatYen(average)}</strong></div>
      <div><span>OP売上</span><strong>{formatYen(optionTotal)}</strong></div>
    </section>

    <div className="salesGrid">
      <section className="panel salesPanel">
        <div className="salesPanelHead"><h2>キャスト別</h2><span>{allPeriod?"全期間":date}</span></div>
        <div className="salesTable">
          <div className="salesTableRow salesTableHeader"><span>キャスト</span><span>本数</span><span>売上</span></div>
          {castRows.map(row=><div className="salesTableRow" key={row.name}>
            <strong>{row.name}</strong><span>{row.count}本</span><strong>{formatYen(row.total)}</strong>
          </div>)}
          {!castRows.length&&<div className="masterEmpty compact">対象期間の売上はありません。</div>}
        </div>
      </section>

      <section className="panel salesPanel">
        <div className="salesPanelHead"><h2>日別売上</h2><span>直近31日</span></div>
        <div className="salesTable">
          <div className="salesTableRow salesTableHeader"><span>日付</span><span>本数</span><span>売上</span></div>
          {dailyRows.map(row=><button className="salesTableRow salesDateRow" type="button" key={row.date} onClick={()=>{setDate(row.date);setAllPeriod(false);}}>
            <strong>{row.date}</strong><span>{row.count}本</span><strong>{formatYen(row.total)}</strong>
          </button>)}
          {!dailyRows.length&&<div className="masterEmpty compact">売上データはまだありません。</div>}
        </div>
      </section>
    </div>
  </div>
}