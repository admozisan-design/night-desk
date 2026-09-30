"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {casts as defaults} from "@/lib/mock-data";
import {loadCasts,loadOrders,loadExpenses,loadCastSettlementAdjustments} from "@/lib/storage";
import {buildPerformance,businessMinutes,clockMinutes,localDate,orderDate} from "@/lib/operations";
import {formatYen} from "@/lib/pricing";
import type {Cast,Order,Expense,CastSettlementAdjustment} from "@/lib/types";

export default function AnalyticsPage(){
 const [orders,setOrders]=useState<Order[]>([]);
 const [casts,setCasts]=useState<Cast[]>(defaults);
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [settlements,setSettlements]=useState<Record<string,CastSettlementAdjustment>>({});
 const [from,setFrom]=useState(()=>localDate(new Date(new Date().getFullYear(),new Date().getMonth(),1)));
 const [to,setTo]=useState(()=>localDate());
 useEffect(()=>{
  const refresh=()=>{setOrders(loadOrders());setCasts(loadCasts(defaults));
    setExpenses(loadExpenses());setSettlements(loadCastSettlementAdjustments());};
  refresh();
  const ev=["nightdesk:orders","nightdesk:casts","nightdesk:expenses","nightdesk:settlement","storage"];
  ev.forEach(x=>window.addEventListener(x,refresh));
  return ()=>ev.forEach(x=>window.removeEventListener(x,refresh));
 },[]);
 const p=useMemo(()=>buildPerformance({orders,casts,expenses,settlements,dateFrom:from,dateTo:to}),
  [orders,casts,expenses,settlements,from,to]);
 const castStats=useMemo(()=>casts.filter(c=>c.visible!==false).map(cast=>{
   const done=p.completed.filter(x=>x.castId===cast.id);
   const booked=p.orders.filter(x=>x.castId===cast.id && x.status!=="cancelled");
   const minutes=done.reduce((n,x)=>n+x.courseMinutes+(x.extensionMinutes??0),0);
   const shiftMinutes=(cast.schedule??[]).filter(s=>s.date>=from&&s.date<=to&&s.working)
     .reduce((n,s)=>{
       const start=clockMinutes(s.start);
       let end=businessMinutes(s.endTime,s.start);
       if(s.endType==="reception")return n; // checkout unknown; do not invent an end.
       if(end<=start)end+=1440;
       return n+Math.max(0,end-start);
     },0);
   return {cast,booked:booked.length,done:done.length,minutes,shiftMinutes,
     nomination:done.filter(x=>x.nominationType!=="free").length,
     repeat:done.filter(x=>x.nominationType==="repeat").length,
     sales:done.reduce((n,x)=>n+x.total,0)};
 }).filter(x=>x.booked||x.shiftMinutes).sort((a,b)=>b.sales-a.sales),[casts,p,from,to]);
 const hourStats=useMemo(()=>{
   const a=Array.from({length:24},(_,hour)=>({hour,booked:0,sales:0}));
   for(const o of p.completed){
     const h=Number(o.scheduledStart.split(":")[0]);
     if(a[h]){a[h].booked++;a[h].sales+=o.total;}
   }
   return a.filter(x=>x.booked).sort((a,b)=>b.booked-a.booked);
 },[p]);
 const daily=useMemo(()=>{
   const map=new Map<string,{date:string,total:number,count:number}>();
   for(const o of p.completed){
     const key=orderDate(o),x=map.get(key)??{date:key,total:0,count:0};
     x.total+=o.total;x.count++;map.set(key,x);
   }
   return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
 },[p]);
 const most=Math.max(1,...daily.map(x=>x.total));
 const pill={padding:"5px 10px",border:"1px solid #e2e8f0",borderRadius:9};
 function csv(){
   const rows=[["キャスト","予約本数","完了本数","指名本数","本指本数","売上","接客分数"],
     ...castStats.map(s=>[s.cast.name,s.booked,s.done,s.nomination,s.repeat,s.sales,s.minutes])];
   const content="\uFEFF"+rows.map(cols=>cols.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;a.download="nightdesk_analysis_"+from+"_"+to+".csv";
   a.click();URL.revokeObjectURL(url);
 }
 return <main style={{display:"grid",gap:20}}>
  <header className="pageHeader"><div><p className="eyebrow">BUSINESS ANALYTICS</p><h1>経営・稼働分析</h1>
   <p>予約・出勤・売上・バックが連動。推測値と確定値を分けて表示します。</p></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Link href="/expenses" style={pill}>経費・利益管理 →</Link><button onClick={csv}>集計CSV出力</button>
   </div></header>
  <section className="panel" style={{display:"flex",gap:12,flexWrap:"wrap",padding:18}}>
   <label>開始日 <input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
   <label>終了日 <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
  </section>
  <section className="salesKpis">
   {[["確定売上",formatYen(p.turnover)],["未完了の予約見込み",formatYen(p.expected)],
     ["完了本数",p.completed.length+"本"],["指名率",(p.nominationRate*100).toFixed(1)+"%"],
     ["平均客単価",formatYen(p.average)],["実利用の顧客数",p.uniqueCustomers+"人"],
     ["キャンセル",p.cancelled.length+"本"],["概算利益",formatYen(p.grossProfit)]].map(([label,value])=>
      <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
  </section>
  <p>確定売上＝接客完了分＋設定済みのキャンセル料。キャストバックは概算、稼働率は「上がり」時刻が設定されている出勤日についてのみ算出します。</p>
  <section className="panel" style={{padding:18}}>
   <h2>キャスト別実績</h2>
   <div style={{overflowX:"auto",marginTop:12}}>
    <table style={{width:"100%",borderCollapse:"collapse",minWidth:750}}>
     <thead><tr>{["キャスト","予約","完了","指名率","本指名","接客時間","稼働率※","確定売上"].map(x=><th style={{textAlign:"left",padding:10,borderBottom:"1px solid #ddd"}} key={x}>{x}</th>)}</tr></thead>
     <tbody>{castStats.map(s=><tr key={s.cast.id}>
       <td style={{padding:10}}><b>{s.cast.name}</b></td>
       <td>{s.booked}本</td><td>{s.done}本</td>
       <td>{s.done?(s.nomination/s.done*100).toFixed(1)+"%":"—"}</td>
       <td>{s.repeat}本</td><td>{s.minutes}分</td>
       <td>{s.shiftMinutes?(s.minutes/s.shiftMinutes*100).toFixed(1)+"%":"—"}</td>
       <td>{formatYen(s.sales)}</td>
      </tr>)}</tbody></table>
    {!castStats.length&&<p>この期間の実績はありません。</p>}
   </div>
  </section>
  <section className="panel" style={{padding:18}}>
   <h2>日別の確定売上</h2>
   <div style={{display:"grid",gap:10,marginTop:14}}>
    {daily.map(x=><div key={x.date} style={{display:"grid",gridTemplateColumns:"110px 1fr 110px",alignItems:"center",gap:12}}>
      <span>{x.date}</span><div style={{background:"#f1f5f9",borderRadius:5,height:22}}>
       <div style={{background:"#2563eb",height:22,width:Math.max(1,x.total/most*100)+"%",borderRadius:5}}/>
      </div><b>{formatYen(x.total)}</b>
     </div>)}
    {!daily.length&&<p>確定売上はありません。</p>}
   </div>
  </section>
  <section className="panel" style={{padding:18}}>
   <h2>時間帯別の接客開始</h2>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
    {hourStats.map(x=><div key={x.hour} style={pill}><b>{String(x.hour).padStart(2,"0")}:00</b>　{x.booked}本 / {formatYen(x.sales)}</div>)}
    {!hourStats.length&&<p>集計対象がありません。</p>}
   </div>
  </section>
 </main>;
}
