"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {loadExpenses,saveExpenses,loadOrders,loadCasts,loadCastSettlementAdjustments} from "@/lib/storage";
import {casts as defaults} from "@/lib/mock-data";
import {buildPerformance,localDate} from "@/lib/operations";
import {formatYen} from "@/lib/pricing";
import type {Expense,Order,Cast,CastSettlementAdjustment} from "@/lib/types";

export default function ExpensesPage(){
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [casts,setCasts]=useState<Cast[]>(defaults);
 const [settlements,setSettlements]=useState<Record<string,CastSettlementAdjustment>>({});
 const [dateFrom,setDateFrom]=useState(()=>localDate(new Date(new Date().getFullYear(),new Date().getMonth(),1)));
 const [dateTo,setDateTo]=useState(()=>localDate());
 useEffect(()=>{
   const refresh=()=>{
     setExpenses(loadExpenses());setOrders(loadOrders());
     setCasts(loadCasts(defaults));setSettlements(loadCastSettlementAdjustments());
   };
   refresh();
   const events=["nightdesk:expenses","nightdesk:orders","nightdesk:settlement","nightdesk:casts","storage"];
   events.forEach(name=>window.addEventListener(name,refresh));
   return ()=>events.forEach(name=>window.removeEventListener(name,refresh));
 },[]);
 const totals=useMemo(()=>buildPerformance({orders,casts,expenses,settlements,dateFrom,dateTo}),[orders,casts,expenses,settlements,dateFrom,dateTo]);
 function add(e:FormEvent<HTMLFormElement>){
   e.preventDefault();
   const form=new FormData(e.currentTarget);
   const amount=Number(form.get("amount"));
   if(!Number.isFinite(amount)||amount<0)return;
   const expense:Expense={id:crypto.randomUUID(),date:String(form.get("date")),
    category:String(form.get("category")),description:String(form.get("description")).trim(),amount};
   if(!expense.description)return;
   const next=[expense,...expenses];saveExpenses(next);setExpenses(next);e.currentTarget.reset();
 }
 const filtered=expenses.filter(row=>row.date>=dateFrom&&row.date<=dateTo).sort((a,b)=>b.date.localeCompare(a.date));
 return <main style={{display:"grid",gap:18}}>
   <header className="pageHeader"><div><p className="eyebrow">COST MANAGEMENT</p><h1>経費・利益管理</h1>
     <p>完了売上とキャストバック、登録した経費から概算利益を確認します。</p></div></header>
   <section className="panel" style={{display:"flex",gap:12,padding:18}}>
     <label>開始日 <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label>
     <label>終了日 <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label>
   </section>
   <section className="salesKpis">
     <div><span>確定売上（キャンセル料込み）</span><strong>{formatYen(totals.turnover)}</strong></div>
     <div><span>概算バック</span><strong>{formatYen(totals.payout)}</strong></div>
     <div><span>経費</span><strong>{formatYen(totals.expenses)}</strong></div>
     <div><span>概算利益</span><strong>{formatYen(totals.grossProfit)}</strong></div>
   </section>
   <p>ドライバー報酬など未登録の経費は含みません。利益は参考値です。</p>
   <section className="panel" style={{padding:18}}>
     <h2>経費登録</h2>
     <form onSubmit={add} style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:12}}>
       <input name="date" type="date" required defaultValue={localDate()}/>
       <select name="category"><option>ドライバー</option><option>広告</option><option>備品</option><option>その他</option></select>
       <input name="description" required maxLength={120} placeholder="内容"/>
       <input name="amount" required type="number" min="0" placeholder="金額"/>
       <button className="primaryButton" type="submit">保存</button>
     </form>
   </section>
   <section className="panel" style={{padding:18}}>
     <h2>経費履歴</h2>
     {filtered.map(row=><div key={row.id} style={{padding:10,borderBottom:"1px solid #ddd",display:"flex",gap:12,justifyContent:"space-between"}}>
       <span>{row.date} / {row.category} / {row.description}</span><strong>{formatYen(row.amount)}</strong>
       <button onClick={()=>{if(window.confirm("削除しますか？")){const next=expenses.filter(x=>x.id!==row.id);saveExpenses(next);setExpenses(next);}}}>削除</button>
     </div>)}
     {!filtered.length&&<p>登録経費はありません。</p>}
   </section>
 </main>;
}
