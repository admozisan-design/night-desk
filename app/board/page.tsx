"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { casts as defaultCasts, defaultStoreSettings } from "@/lib/mock-data";
import { loadCasts, loadOrders, loadStoreSettings } from "@/lib/storage";
import type { Cast, CastAttendanceStatus, CastStatus, Order } from "@/lib/types";

const BOARD_START=10*60;
const BOARD_MINUTES=19*60;
const hourLabels=[
  "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00",
  "19:00","20:00","21:00","22:00","23:00","0:00","1:00","2:00","3:00","4:00"
];

const statusLabels:Record<CastStatus,string>={
  waiting:"待機",moving:"移動中",serving:"接客中",off:"退勤"
};
const attendanceLabels:Record<CastAttendanceStatus,string>={
  present:"出勤",late:"遅刻",absent:"当欠",leftEarly:"早退"
};

function dateInputValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function orderServiceDate(order:Order){
  if(order.serviceDate) return order.serviceDate;
  return dateInputValue(new Date(order.createdAt));
}
function castShiftForDate(cast:Cast,date:string){
  return cast.schedule?.find(shift=>shift.date===date);
}
function normalizedMinutes(time:string){
  const [rawHour,minute]=time.split(":").map(Number);
  const hour=rawHour<10?rawHour+24:rawHour;
  return hour*60+minute;
}
function eventPosition(order:Order){
  const rawStart=normalizedMinutes(order.scheduledStart)-BOARD_START;
  let rawEnd=normalizedMinutes(order.scheduledEnd)-BOARD_START;
  if(rawEnd<=rawStart) rawEnd+=24*60;
  const start=Math.max(0,rawStart);
  const end=Math.min(BOARD_MINUTES,rawEnd);
  if(end<=0 || start>=BOARD_MINUTES || end<=start) return null;
  return {left:`${(start/BOARD_MINUTES)*100}%`,width:`${((end-start)/BOARD_MINUTES)*100}%`};
}
function currentTimePosition(now:Date){
  let minutes=now.getHours()*60+now.getMinutes();
  if(now.getHours()<10) minutes+=24*60;
  const value=minutes-BOARD_START;
  if(value<0 || value>BOARD_MINUTES) return null;
  return `${(value/BOARD_MINUTES)*100}%`;
}
function orderEndDateTime(order:Order,serviceDate:string){
  const [year,month,day]=serviceDate.split("-").map(Number);
  const [hour,minute]=order.scheduledEnd.split(":").map(Number);
  const result=new Date(year,month-1,day,hour,minute,0,0);
  if(hour<10) result.setDate(result.getDate()+1);
  return result;
}
function orderVisualState(order:Order,serviceDate:string,now:Date|null){
  if(order.status==="cancelled") return "cancelled";
  if(order.status==="completed") return "out";
  if(now && now>=orderEndDateTime(order,serviceDate)) return "out";
  if(order.inTime || order.status==="serving") return "in";
  if(order.status==="dispatching") return "afterDispatch";
  return "beforeDispatch";
}
function shiftAvailabilityPosition(startTime:string,endTime:string){
  let start=normalizedMinutes(startTime)-BOARD_START;
  let end=normalizedMinutes(endTime)-BOARD_START;
  if(end<=start) end+=24*60;
  const visibleStart=Math.max(0,Math.min(BOARD_MINUTES,start));
  const visibleEnd=Math.max(0,Math.min(BOARD_MINUTES,end));
  return {
    beforeWidth:`${(visibleStart/BOARD_MINUTES)*100}%`,
    afterLeft:`${(visibleEnd/BOARD_MINUTES)*100}%`,
    afterWidth:`${((BOARD_MINUTES-visibleEnd)/BOARD_MINUTES)*100}%`
  };
}
function receptionClosedPosition(receptionEnd:string,endTime:string){
  let start=normalizedMinutes(receptionEnd)-BOARD_START;
  let end=normalizedMinutes(endTime)-BOARD_START;
  if(end<start) end+=24*60;
  const visibleStart=Math.max(0,Math.min(BOARD_MINUTES,start));
  const visibleEnd=Math.max(0,Math.min(BOARD_MINUTES,end));
  return {
    left:`${(visibleStart/BOARD_MINUTES)*100}%`,
    width:`${(Math.max(0,visibleEnd-visibleStart)/BOARD_MINUTES)*100}%`
  };
}

export default function StandaloneBoardPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [casts,setCasts]=useState<Cast[]>(defaultCasts);
  const [storeSettings,setStoreSettings]=useState(defaultStoreSettings);
  const [date,setDate]=useState(()=>dateInputValue(new Date()));
  const [now,setNow]=useState<Date|null>(null);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCasts(loadCasts(defaultCasts));
      setStoreSettings(loadStoreSettings(defaultStoreSettings));
    };
    refresh();
    setNow(new Date());
    const timer=window.setInterval(()=>setNow(new Date()),60000);
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:store-settings",refresh);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:store-settings",refresh);
    };
  },[]);

  const workingCasts=useMemo(()=>casts
    .filter(cast=>{
      if(cast.visible===false) return false;
      const shift=castShiftForDate(cast,date);
      return shift ? shift.working : cast.scheduledToday!==false;
    })
    .sort((a,b)=>{
      const aStart=castShiftForDate(a,date)?.start ?? a.shiftStart ?? "99:99";
      const bStart=castShiftForDate(b,date)?.start ?? b.shiftStart ?? "99:99";
      return normalizedMinutes(aStart)-normalizedMinutes(bStart);
    }),[casts,date]);

  const selectedDateOrders=useMemo(
    ()=>orders.filter(order=>orderServiceDate(order)===date),
    [orders,date]
  );
  const selectedOrders=useMemo(
    ()=>selectedDateOrders.filter(order=>order.status!=="cancelled"),
    [selectedDateOrders]
  );

  const today=dateInputValue(new Date());
  const nowPosition=now && date===today ? currentTimePosition(now) : null;

  function shiftDate(days:number){
    const base=new Date(date+"T12:00:00");
    base.setDate(base.getDate()+days);
    setDate(dateInputValue(base));
  }

  return <div className="standaloneBoardPage">
    <header className="standaloneBoardToolbar">
      <div>
        <p className="eyebrow">DISPATCH BOARD</p>
        <h1>配車ボード</h1>
        <span>配車状況を一覧で確認する専用画面</span>
      </div>

      <div className="standaloneBoardDate">
        <button type="button" onClick={()=>shiftDate(-1)}>前日</button>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        <button type="button" onClick={()=>setDate(today)}>今日</button>
        <button type="button" onClick={()=>shiftDate(1)}>翌日</button>
      </div>

      <Link href="/" className="standaloneBoardManageLink">配車管理を開く</Link>
    </header>

    <section className="standaloneBoardStats">
      <div><span>出勤</span><strong>{workingCasts.length}</strong><small>人</small></div>
      <div><span>オーダー</span><strong>{selectedOrders.length}</strong><small>件</small></div>
      <div><span>営業時間</span><strong>{storeSettings.openTime}〜{storeSettings.closeTime}</strong></div>
      <div className="boardLegend">
        <span><i className="legend beforeDispatch"/>配車前</span>
        <span><i className="legend afterDispatch"/>配車後</span>
        <span><i className="legend inService"/>イン中</span>
        <span><i className="legend out"/>アウト</span>
      </div>
    </section>

    <section className="boardSection standaloneBoardSection">
      <div className="boardSectionHead">
        <div><h2>{date}</h2><span>クリックすると配車管理で編集できます</span></div>
      </div>

      <div className="dispatchScroll standaloneDispatchScroll">
        <div className="dispatchBoard wideBoard standaloneDispatchBoard">
          <div className="dispatchHeader dispatchNameHead">キャスト</div>
          <div className="dispatchHeader dispatchShiftHead">出勤 / 終了条件</div>
          <div className="dispatchHeader dispatchCountHead">本数</div>
          <div className="timelineHeader longTimeline">{hourLabels.map(hour=><div key={hour}>{hour}</div>)}</div>

          {workingCasts.map(cast=>{
            const castOrders=selectedOrders.filter(order=>order.castId===cast.id);
            const visibleOrders=castOrders.filter(order=>eventPosition(order));
            const shift=castShiftForDate(cast,date);
            const attendance=shift?.attendance;
            const unavailable=attendance==="absent" || attendance==="leftEarly";
            const shiftStart=shift?.start ?? cast.shiftStart ?? storeSettings.openTime;
            const endType=shift?.endType ?? "leave";
            const endTime=shift?.endTime ?? cast.shiftEnd ?? storeSettings.closeTime;
            const timelineEnd=endType==="leave" ? endTime : storeSettings.closeTime;
            const availability=shiftAvailabilityPosition(shiftStart,timelineEnd);
            const receptionClosed=endType==="reception"
              ? receptionClosedPosition(endTime,storeSettings.closeTime)
              : null;

            return <div className={`dispatchRowContents ${unavailable?"isUnavailableCast":""}`} key={cast.id}>
              <div className="dispatchName">
                <span className={`castStateDot ${cast.status}`}/>
                <div className="standaloneCastName">
                  <strong>{cast.name}</strong>
                  <span className="dispatchCastMeta">
                    <small>{statusLabels[cast.status]}</small>
                    {shift?.attendance
                      ? <em className={`attendanceBadge ${shift.attendance}`}>{attendanceLabels[shift.attendance]}</em>
                      : <em className="attendanceBadge unconfirmed">未確認</em>}
                  </span>
                </div>
              </div>

              <div className="dispatchShift">
                <div className="dispatchShiftQuick standaloneShiftInfo">
                  <span>出勤 <b>{shift?.start ?? cast.shiftStart ?? "--:--"}</b></span>
                  <span>{endType==="reception"?"受付終了":"上がり"} <b>{endTime}</b></span>
                </div>
              </div>

              <div className="dispatchCount"><strong>{castOrders.length}</strong><span>本</span></div>

              <div className="timelineCell longCell">
                {visibleOrders.map(order=>{
                  const pos=eventPosition(order)!;
                  const visualState=orderVisualState(order,date,now);
                  return <button
                    type="button"
                    key={order.id}
                    className={`timelineOrder orderVisual-${visualState}`}
                    style={pos}
                    onClick={()=>window.location.href="/?editOrder="+encodeURIComponent(order.id)}
                    title="配車管理でこのオーダーを開く"
                  >
                    <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                    <span>{order.castName}</span>
                    <small>{order.locationName || "場所未入力"}{order.room ? ` ${order.room}` : ""} / {order.driverName ?? "配車未割当"} / {order.courseMinutes+(order.extensionMinutes??0)}分</small>
                  </button>;
                })}

                {!visibleOrders.length && !unavailable && <span className="emptyTimeline">空き</span>}

                {receptionClosed && <div className="receptionClosedBlock" style={receptionClosed} title="受付終了後">
                  <span>受付終了後（事前予約のみ）</span>
                </div>}

                <div className="offShiftBlock before" style={{width:availability.beforeWidth}} title="出勤時間外"><span>出勤前</span></div>
                <div className="offShiftBlock after" style={{left:availability.afterLeft,width:availability.afterWidth}} title="出勤時間外"><span>上り後</span></div>

                {unavailable && <div className="unavailableCastTimelineBlock">
                  <strong>{attendance==="absent"?"当欠":"早退"}</strong>
                </div>}

                {nowPosition && <span className="nowLine" style={{left:nowPosition}}><b>現在</b></span>}
              </div>
            </div>;
          })}

          {!workingCasts.length && <div className="standaloneBoardEmpty">この日の出勤キャストはいません</div>}

          <div className="dispatchName totalCell"><strong>合計</strong></div>
          <div className="dispatchShift totalCell"><strong>{workingCasts.length}人</strong></div>
          <div className="dispatchCount totalCell"><strong>{selectedOrders.length}</strong><span>本</span></div>
          <div className="timelineCell totalTimeline">{nowPosition && <span className="nowLine" style={{left:nowPosition}}/>}</div>
        </div>
      </div>
    </section>
  </div>;
}
