"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { casts as defaultCasts } from "@/lib/mock-data";
import { loadCasts, loadOrders } from "@/lib/storage";
import type { Cast, CastStatus, Order, OrderStatus } from "@/lib/types";
import { formatYen } from "@/lib/pricing";

const BOARD_START = 19 * 60;
const BOARD_MINUTES = 10 * 60;
const hourLabels = ["19:00","20:00","21:00","22:00","23:00","0:00","1:00","2:00","3:00","4:00"];

const statusLabels: Record<CastStatus,string> = {
  waiting:"待機", moving:"移動中", serving:"接客中", off:"退勤"
};
const orderStatusLabels: Record<OrderStatus,string> = {
  accepted:"受付済", dispatching:"配車中", serving:"接客中", completed:"完了", cancelled:"キャンセル"
};

function normalizedMinutes(time:string){
  const [rawHour,minute] = time.split(":").map(Number);
  const hour = rawHour < 12 ? rawHour + 24 : rawHour;
  return hour * 60 + minute;
}
function eventPosition(order:Order){
  const rawStart = normalizedMinutes(order.scheduledStart) - BOARD_START;
  let rawEnd = normalizedMinutes(order.scheduledEnd) - BOARD_START;
  if(rawEnd <= rawStart) rawEnd += 24*60;
  const start = Math.max(0,rawStart);
  const end = Math.min(BOARD_MINUTES,rawEnd);
  if(end <= 0 || start >= BOARD_MINUTES || end <= start) return null;
  return { left:`${(start/BOARD_MINUTES)*100}%`, width:`${((end-start)/BOARD_MINUTES)*100}%` };
}
function currentTimePosition(now:Date){
  let minutes = now.getHours()*60 + now.getMinutes();
  if(now.getHours() < 12) minutes += 24*60;
  const value = minutes - BOARD_START;
  if(value < 0 || value > BOARD_MINUTES) return null;
  return `${(value/BOARD_MINUTES)*100}%`;
}

export default function DashboardPage(){
  const [orders,setOrders] = useState<Order[]>([]);
  const [castList,setCastList] = useState<Cast[]>(defaultCasts);
  const [now,setNow] = useState<Date|null>(null);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCastList(loadCasts(defaultCasts));
    };
    refresh();
    setNow(new Date());
    const timer = window.setInterval(()=>setNow(new Date()),60000);
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
    };
  },[]);

  const workingCasts = useMemo(
    ()=>castList.filter(c=>c.visible!==false && c.scheduledToday!==false),
    [castList]
  );
  const activeOrders = useMemo(()=>orders.filter(o=>o.status!=="completed"&&o.status!=="cancelled"),[orders]);
  const todaySales = useMemo(()=>orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+o.total,0),[orders]);
  const waitingCount = workingCasts.filter(c=>c.status==="waiting").length;
  const nowPosition = now ? currentTimePosition(now) : null;

  return <div>
    <header className="pageHeader boardPageHeader">
      <div>
        <p className="eyebrow">DISPATCH BOARD</p>
        <h1>配車ボード</h1>
        <p>キャスト管理で登録した本日の出勤者だけを表示しています。</p>
      </div>
      <div className="headerActions">
        <Link className="secondaryButton" href="/casts">出勤を編集</Link>
        <Link className="primaryButton" href="/orders/new">＋ 新規受付</Link>
      </div>
    </header>

    <section className="boardSummary">
      <div><span>稼働中</span><strong>{activeOrders.length}</strong><small>件</small></div>
      <div><span>本日出勤</span><strong>{workingCasts.length}</strong><small>人</small></div>
      <div><span>待機</span><strong>{waitingCount}</strong><small>人</small></div>
      <div><span>本日受付</span><strong>{orders.length}</strong><small>件</small></div>
      <div className="sales"><span>本日売上</span><strong>{formatYen(todaySales)}</strong></div>
    </section>

    <section className="dispatchPanel">
      <div className="dispatchPanelTop">
        <div><strong>本日の稼働状況</strong><span>19:00 〜 翌5:00</span></div>
        <div className="boardLegend">
          <span><i className="legend accepted"/>受付済</span>
          <span><i className="legend dispatching"/>配車中</span>
          <span><i className="legend serving"/>接客中</span>
        </div>
      </div>

      <div className="dispatchScroll">
        <div className="dispatchBoard">
          <div className="dispatchHeader dispatchNameHead">キャスト</div>
          <div className="dispatchHeader dispatchShiftHead">出勤 / 上り</div>
          <div className="dispatchHeader dispatchCountHead">本数</div>
          <div className="timelineHeader">{hourLabels.map(hour=><div key={hour}>{hour}</div>)}</div>

          <div className="dispatchName holdCell"><strong>保留・フリー予約</strong></div>
          <div className="dispatchShift holdCell"><span>未割当</span></div>
          <div className="dispatchCount holdCell"><strong>0</strong><span>本</span></div>
          <div className="timelineCell holdTimeline">
            <span className="holdHint">キャスト未確定の予約はここに表示</span>
            {nowPosition && <span className="nowLine" style={{left:nowPosition}}><b>現在</b></span>}
          </div>

          {workingCasts.length===0 && <>
            <div className="dispatchName noCastCell"><strong>出勤者なし</strong></div>
            <div className="dispatchShift noCastCell"><span>キャスト管理から登録</span></div>
            <div className="dispatchCount noCastCell"><strong>0</strong><span>人</span></div>
            <div className="timelineCell noCastTimeline"><Link href="/casts">本日の出勤を登録する →</Link></div>
          </>}

          {workingCasts.map(cast=>{
            const castOrders = orders.filter(o=>o.castId===cast.id && o.status!=="cancelled");
            const visibleOrders = castOrders.filter(o=>eventPosition(o));
            return <div className="dispatchRowContents" key={cast.id}>
              <div className="dispatchName">
                <span className={`castStateDot ${cast.status}`}/>
                <div><strong>{cast.name}</strong><small>{statusLabels[cast.status]}</small></div>
              </div>
              <div className="dispatchShift">
                <span>出勤 <b>{cast.shiftStart ?? "--:--"}</b></span>
                <span>上り <b>{cast.shiftEnd ?? "--:--"}</b></span>
              </div>
              <div className="dispatchCount"><strong>{castOrders.length}</strong><span>本</span></div>
              <div className="timelineCell">
                {visibleOrders.map(order=>{
                  const pos = eventPosition(order)!;
                  return <Link key={order.id} href="/orders" className={`timelineOrder timelineOrder-${order.status}`} style={pos}>
                    <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                    <span>{order.locationName || "場所未入力"}{order.room ? ` ${order.room}` : ""}</span>
                    <small>{orderStatusLabels[order.status]} ・ {order.driverName ?? "配車未割当"}</small>
                  </Link>
                })}
                {visibleOrders.length===0 && <span className="emptyTimeline">空き</span>}
                {nowPosition && <span className="nowLine" style={{left:nowPosition}}><b>現在</b></span>}
              </div>
            </div>
          })}

          <div className="dispatchName totalCell"><strong>合計</strong></div>
          <div className="dispatchShift totalCell"><strong>{workingCasts.length}人</strong></div>
          <div className="dispatchCount totalCell"><strong>{orders.filter(o=>o.status!=="cancelled").length}</strong><span>本</span></div>
          <div className="timelineCell totalTimeline">{nowPosition && <span className="nowLine" style={{left:nowPosition}}/>}</div>
        </div>
      </div>
    </section>
  </div>
}
