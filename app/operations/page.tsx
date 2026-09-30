"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {casts as demoCasts,drivers as demoDrivers,defaultStoreSettings} from "@/lib/mock-data";
import {loadCasts,loadDrivers,loadOrders,loadStoreSettings,updateOrderStatus} from "@/lib/storage";
import {checkCastAvailability,activeBusinessDate,orderDate,orderInterval,suggestDrivers} from "@/lib/operations";
import type {Cast,Driver,Order,StoreSettings} from "@/lib/types";

const card:React.CSSProperties={padding:18,border:"1px solid #e2e8f0",borderRadius:14,background:"#fff"};
const grid:React.CSSProperties={display:"grid",gap:14,gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))"};
const line:React.CSSProperties={display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"};

export default function OperationsPage(){
  const [date,setDate]=useState(()=>activeBusinessDate(new Date(),defaultStoreSettings.openTime));
  const [time,setTime]=useState(()=>{const n=new Date();return String(n.getHours()).padStart(2,"0")+":"+String(n.getMinutes()).padStart(2,"0");});
  const [minutes,setMinutes]=useState(60);
  const [castId,setCastId]=useState("");
  const [orders,setOrders]=useState<Order[]>([]);
  const [casts,setCasts]=useState<Cast[]>(demoCasts);
  const [drivers,setDrivers]=useState<Driver[]>(demoDrivers);
  const [settings,setSettings]=useState<StoreSettings>(defaultStoreSettings);
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCasts(loadCasts(demoCasts));
      setDrivers(loadDrivers(demoDrivers));
      setSettings(loadStoreSettings(defaultStoreSettings));
    };
    refresh();
    const events=["nightdesk:orders","nightdesk:casts","nightdesk:drivers","nightdesk:store-settings","storage"];
    for(const event of events)window.addEventListener(event,refresh);
    return ()=>{for(const event of events)window.removeEventListener(event,refresh);};
  },[]);
  useEffect(()=>{
    if(castId && casts.some(c=>c.id===castId))return;
    setCastId(casts.find(c=>c.visible!==false)?.id??"");
  },[castId,casts]);

  const dateOrders=useMemo(()=>orders.filter(order=>orderDate(order)===date),[orders,date]);
  const liveOrders=dateOrders.filter(order=>order.status!=="cancelled"&&order.status!=="completed");
  const selectedCast=casts.find(c=>c.id===castId);
  const availability=selectedCast?checkCastAvailability({
    cast:selectedCast,date,start:time,minutes,orders,settings,includeSlots:true
  }):null;
  const available=useMemo(()=>casts.filter(cast=>
    checkCastAvailability({cast,date,start:time,minutes,orders,settings}).ok
  ),[casts,date,time,minutes,orders,settings]);
  const driverCandidates=useMemo(()=>suggestDrivers({
    drivers,orders,date,start:time,settings
  }),[drivers,orders,date,time,settings]);
  const ordered=useMemo(()=>[...dateOrders].sort((a,b)=>
    orderInterval(a,settings).start-orderInterval(b,settings).start
  ),[dateOrders,settings]);
  const upcoming=liveOrders.filter(x=>x.status==="accepted");
  const sendTasks=dateOrders.filter(x=>x.status!=="cancelled"&&x.driverId).length;
  const occupiedCasts=new Set(liveOrders.filter(x=>x.status==="serving").map(x=>x.castId)).size;

  function mark(order:Order,status:Order["status"]){
    if(status==="completed"&&!window.confirm("接客完了にしますか？この予約は確定売上の集計対象になります。"))return;
    setOrders(updateOrderStatus(order.id,status));
    setNotice(order.castName+"：ステータスを更新しました");
    setTimeout(()=>setNotice(""),2200);
  }

  const params=new URLSearchParams({date,start:time,minutes:String(minutes),
    ...(castId?{cast:castId}:{})}).toString();
  return <div style={{display:"grid",gap:19}}>
    <header className="pageHeader" style={line}>
      <div><p className="eyebrow">OPERATION CENTER</p>
        <h1>業務統合パネル</h1><p>空き枠・予約・キャスト・配車を連携。変更は配車ボードにも反映されます。</p></div>
      <label>営業日 <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    </header>
    {notice&&<div role="status" style={{...card,borderColor:"#86efac"}}>{notice}</div>}
    <section style={grid} aria-label="当日の状況">
      {[["進行中の予約",liveOrders.length+" 件"],["配車待ち",upcoming.length+" 件"],
        ["接客中キャスト",occupiedCasts+" 人"],["送り割当",sendTasks+" 件"]].map(([name,value])=>
        <article key={name} style={card}><div style={{color:"#64748b",fontSize:13}}>{name}</div>
          <strong style={{fontSize:26}}>{value}</strong></article>)}
    </section>
    <section className="panel" style={{...card,display:"grid",gap:14}}>
      <div style={line}><div><h2>スマート予約・空き枠検索</h2>
        <p>営業時間、出勤、受付締切・上がり時刻、予約の重複を確認します。</p></div>
        <Link className="primaryButton" href={"/orders/new?"+params}>この条件で予約登録 →</Link>
      </div>
      <div style={grid}>
        <label>開始予定 <input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
        <label>コース時間
          <select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>
            {[40,60,70,80,90,100,120,150,180,240].map(n=><option value={n} key={n}>{n}分</option>)}
          </select>
        </label>
        <label>キャスト
          <select value={castId} onChange={e=>setCastId(e.target.value)}>
            {casts.filter(c=>c.visible!==false).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {availability&&<div role="status" style={{...card,background:availability.ok?"#f0fdf4":"#fff7ed",
        borderColor:availability.ok?"#bbf7d0":"#fed7aa"}}>
        <strong>{availability.ok?"このキャストは予約可能です":"予約できません："+availability.message}</strong>
        {!availability.ok&&availability.conflicts.length>0&&<p>重複予約：{availability.conflicts.map(o=>o.scheduledStart+" "+o.locationName).join(" / ")}</p>}
        {!!availability.nextSlots.length&&<div style={{...line,justifyContent:"flex-start"}}>
          <span>次の空き枠：</span>{availability.nextSlots.map(slot=>
            <button type="button" key={slot} onClick={()=>setTime(slot)}>{slot}</button>)}
        </div>}
      </div>}
      <div><strong>同時刻に予約可能なキャスト：{available.length}人</strong>
        <div style={{...line,justifyContent:"flex-start",marginTop:9}}>
          {available.map(c=><button type="button" key={c.id} onClick={()=>setCastId(c.id)}
            style={{padding:"7px 12px",borderRadius:12,border:"1px solid #94a3b8",
              background:c.id===castId?"#dbeafe":"white"}}>{c.name}</button>)}
          {!available.length&&<span>該当者はいません。日時・コース時間を変更してください。</span>}
        </div>
      </div>
    </section>
    <section className="panel" style={{...card,display:"grid",gap:10}}>
      <div><h2>配車候補</h2><p>当日の送迎割当件数と時間帯の重複から候補を提案します。実際の道路状況・送迎距離は別途確認してください。</p></div>
      <div style={grid}>
        {driverCandidates.map((row,index)=><article style={{...card,
          background:row.overlap.length?"#fef2f2":"#f0fdf4"}} key={row.driver.id}>
          <div style={line}><strong>{row.driver.name}</strong>
            {index===0&&!row.overlap.length&&<span style={{fontSize:12}}>最初の候補</span>}</div>
          <div style={{color:row.overlap.length?"#991b1b":"#166534",fontWeight:700}}>
            {row.overlap.length?"⚠ 同時間帯の配車あり":"指定時刻に空きあり"}
          </div>
          <small>本日の割当：{row.load}件{row.next?" ／ 次："+
            (String(Math.floor(row.next.start/60)%24).padStart(2,"0")+":"+
            String(row.next.start%60).padStart(2,"0")):""}</small>
        </article>)}
        {!driverCandidates.length&&<p>稼働中のドライバーがいません。</p>}
      </div>
    </section>
    <section className="panel" style={{...card,display:"grid",gap:10}}>
      <div style={line}><h2>本日の予約タイムライン</h2><Link href="/board">配車ボードを開く →</Link></div>
      <div style={{display:"grid",gap:8}}>
        {ordered.map(order=><article key={order.id} style={{...card,...line,
          opacity:order.status==="cancelled"?0.55:1}}>
          <div style={{minWidth:160}}><b>{order.scheduledStart}〜{order.scheduledEnd}</b>
            <div style={{fontSize:13,color:"#64748b"}}>{order.status==="accepted"?"配車前":
              order.status==="dispatching"?"配車済":order.status==="serving"?"接客中":
              order.status==="completed"?"完了":"キャンセル"}</div></div>
          <div style={{flex:1,minWidth:180}}><strong>{order.castName}</strong>
            <div>{order.locationName}{order.room?" / "+order.room:""}</div>
            <small>送り：{order.driverName??"未割当"} ／ 迎え：{order.pickupDriverName??"未割当"}</small></div>
          <div style={{...line,justifyContent:"flex-start"}}>
            {order.status==="accepted"&&<button type="button" onClick={()=>mark(order,"dispatching")}>送り出し</button>}
            {order.status==="dispatching"&&<button type="button" onClick={()=>mark(order,"serving")}>接客開始</button>}
            {order.status==="serving"&&<button type="button" onClick={()=>mark(order,"completed")}>接客完了</button>}
            <Link href={"/?orderAction="+encodeURIComponent(order.id)}>詳細 →</Link>
          </div>
        </article>)}
        {!ordered.length&&<p>この営業日の予約はありません。</p>}
      </div>
    </section>
    <section style={{...grid,gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))"}}>
      {[["キャスト出勤管理","/casts"],["料金設定","/pricing"],["売上・分析","/analytics"],
        ["顧客・利用履歴","/customers"],["経費台帳","/expenses"]].map(([label,href])=>
        <Link key={href} href={href} className="panel" style={{...card,textDecoration:"none",color:"inherit"}}>
          <strong>{label} →</strong></Link>)}
    </section>
  </div>;
}
