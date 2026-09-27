"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { casts as defaultCasts, courses, drivers as defaultDrivers, hotels as defaultHotels, options as defaultOptions, pricingSettings } from "@/lib/mock-data";
import { calculateOrderTotal, formatYen } from "@/lib/pricing";
import { loadCasts, loadDrivers, loadHotels, loadOptions, loadOrders, saveOrder } from "@/lib/storage";
import type { Cast, CastStatus, Driver, Hotel, Order, OrderStatus, StoreOption } from "@/lib/types";

const BOARD_START = 10 * 60;
const BOARD_MINUTES = 19 * 60;
const hourLabels = [
  "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00",
  "19:00","20:00","21:00","22:00","23:00","0:00","1:00","2:00","3:00","4:00"
];
const statusLabels: Record<CastStatus,string> = {
  waiting:"待機", moving:"移動中", serving:"接客中", off:"退勤"
};
const orderStatusLabels: Record<OrderStatus,string> = {
  accepted:"受付済", dispatching:"配車中", serving:"接客中", completed:"完了", cancelled:"キャンセル"
};

function normalizedMinutes(time:string){
  const [rawHour,minute] = time.split(":").map(Number);
  const hour = rawHour < 10 ? rawHour + 24 : rawHour;
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
  if(now.getHours() < 10) minutes += 24*60;
  const value = minutes - BOARD_START;
  if(value < 0 || value > BOARD_MINUTES) return null;
  return `${(value/BOARD_MINUTES)*100}%`;
}
function addMinutes(time:string, minutes:number){
  const [h,m] = time.split(":").map(Number);
  const total = h*60+m+minutes;
  return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}
function dateInputValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export default function DashboardPage(){
  const [orders,setOrders] = useState<Order[]>([]);
  const [castList,setCastList] = useState<Cast[]>(defaultCasts);
  const [hotelList,setHotelList] = useState<Hotel[]>(defaultHotels);
  const [driverList,setDriverList] = useState<Driver[]>(defaultDrivers);
  const [optionList,setOptionList] = useState<StoreOption[]>(defaultOptions);
  const [now,setNow] = useState<Date|null>(null);
  const [date,setDate] = useState(()=>dateInputValue(new Date()));
  const [zoom,setZoom] = useState(120);

  const [castId,setCastId] = useState("");
  const [driverId,setDriverId] = useState(defaultDrivers[0]?.id ?? "");
  const [courseId,setCourseId] = useState("60");
  const [nominationType,setNominationType] = useState<"free"|"photo"|"repeat">("free");
  const [scheduledStart,setScheduledStart] = useState("13:30");
  const [locationName,setLocationName] = useState("");
  const [room,setRoom] = useState("101");
  const [phone,setPhone] = useState("090-0000-0000");
  const [note,setNote] = useState("サンプル備考");
  const [travelFee,setTravelFee] = useState(pricingSettings.defaultTravelFee);
  const [discount,setDiscount] = useState(0);
  const [selectedOptionIds,setSelectedOptionIds] = useState<string[]>([]);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCastList(loadCasts(defaultCasts));
      setHotelList(loadHotels(defaultHotels));
      setDriverList(loadDrivers(defaultDrivers));
      setOptionList(loadOptions(defaultOptions));
    };
    refresh();
    setNow(new Date());
    const timer = window.setInterval(()=>setNow(new Date()),60000);
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:hotels",refresh);
    window.addEventListener("nightdesk:drivers",refresh);
    window.addEventListener("nightdesk:options",refresh);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:hotels",refresh);
      window.removeEventListener("nightdesk:drivers",refresh);
      window.removeEventListener("nightdesk:options",refresh);
    };
  },[]);

  const workingCasts = useMemo(
    ()=>castList.filter(c=>c.visible!==false && c.scheduledToday!==false),
    [castList]
  );
  const selectableCasts = useMemo(()=>workingCasts.filter(c=>c.status!=="off"),[workingCasts]);
  const availableHotels = useMemo(
    ()=>hotelList.filter(h=>h.visible!==false),
    [hotelList]
  );
  const availableDrivers = useMemo(
    ()=>driverList.filter(d=>d.active!==false),
    [driverList]
  );

  useEffect(()=>{
    if(!selectableCasts.some(c=>c.id===castId)) setCastId(selectableCasts[0]?.id ?? "");
  },[selectableCasts,castId]);

  useEffect(()=>{
    if(!availableDrivers.some(d=>d.id===driverId)) setDriverId(availableDrivers[0]?.id ?? "");
  },[availableDrivers,driverId]);

  useEffect(()=>{
    if(!availableHotels.some(h=>h.name===locationName)){
      const first=availableHotels[0];
      setLocationName(first?.name ?? "");
      setTravelFee(first?.travelFee ?? 0);
    }
  },[availableHotels,locationName]);

  const course = courses.find(c=>c.id===courseId);
  const selectedCast = selectableCasts.find(c=>c.id===castId);
  const selectedDriver = availableDrivers.find(d=>d.id===driverId);
  const selectableOptions = useMemo(
    ()=>optionList.filter(option=>option.active!==false && (selectedCast?.availableOptions??[]).includes(option.name)),
    [optionList,selectedCast]
  );
  const optionsTotal = useMemo(
    ()=>selectableOptions.filter(option=>selectedOptionIds.includes(option.id)).reduce((sum,option)=>sum+option.price,0),
    [selectableOptions,selectedOptionIds]
  );

  useEffect(()=>{
    const allowed=new Set(selectableOptions.map(option=>option.id));
    setSelectedOptionIds(current=>current.filter(id=>allowed.has(id)));
  },[selectableOptions]);

  const total = useMemo(()=>calculateOrderTotal({
    course,
    nominationType,
    photoNominationFee:pricingSettings.photoNominationFee,
    repeatNominationFee:pricingSettings.repeatNominationFee,
    optionsTotal,
    travelFee,
    discount,
    adjustment:0
  }),[course,nominationType,optionsTotal,travelFee,discount]);

  const activeOrders = useMemo(()=>orders.filter(o=>o.status!=="completed"&&o.status!=="cancelled"),[orders]);
  const todaySales = useMemo(()=>orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+o.total,0),[orders]);
  const waitingCount = workingCasts.filter(c=>c.status==="waiting").length;
  const nowPosition = now ? currentTimePosition(now) : null;

  function shiftDate(days:number){
    const base = new Date(date+"T12:00:00");
    base.setDate(base.getDate()+days);
    setDate(dateInputValue(base));
  }

  function selectHotel(name:string){
    setLocationName(name);
    const hotel=availableHotels.find(h=>h.name===name);
    if(hotel) setTravelFee(hotel.travelFee);
  }

  function toggleOrderOption(id:string){
    setSelectedOptionIds(current=>current.includes(id)
      ? current.filter(optionId=>optionId!==id)
      : [...current,id]
    );
  }

  function registerOrder(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selectedCast || !course) return;
    const order:Order = {
      id:crypto.randomUUID(),
      createdAt:new Date().toISOString(),
      customerPhone:phone,
      locationType:"hotel",
      locationName,
      room,
      castId:selectedCast.id,
      castName:selectedCast.name,
      driverId:selectedDriver?.id,
      driverName:selectedDriver?.name,
      courseMinutes:course.minutes,
      nominationType,
      selectedOptions:selectableOptions.filter(option=>selectedOptionIds.includes(option.id)).map(option=>option.name),
      optionsTotal,
      travelFee,
      discount,
      adjustment:0,
      total,
      status:"accepted",
      scheduledStart,
      scheduledEnd:addMinutes(scheduledStart,course.minutes),
      note
    };
    saveOrder(order);
    setOrders(loadOrders());
    const firstHotel=availableHotels[0];
    setLocationName(firstHotel?.name ?? "");
    setTravelFee(firstHotel?.travelFee ?? 0);
    setRoom("101");
    setPhone("090-0000-0000");
    setNote("サンプル備考");
    setSelectedOptionIds([]);
    setDiscount(0);
  }

  return <div className="deskDashboard">
    <section className="deskKpis">
      <div><span>本日出勤</span><strong>{workingCasts.length}人</strong></div>
      <div><span>待機</span><strong>{waitingCount}人</strong></div>
      <div><span>稼働中</span><strong>{activeOrders.length}件</strong></div>
      <div><span>売上</span><strong>{formatYen(todaySales)}</strong></div>
    </section>

    <div className="deskColumns">
      <aside className="deskLeft">
        <section className="deskPanel">
          <h2>日付</h2>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <div className="dateButtons">
            <button onClick={()=>shiftDate(-1)}>前日</button>
            <button onClick={()=>setDate(dateInputValue(new Date()))}>今日</button>
            <button onClick={()=>shiftDate(1)}>翌日</button>
          </div>
        </section>

        <section className="deskPanel">
          <h2>ボード拡大・縮小</h2>
          <div className="zoomControls">
            <button onClick={()=>setZoom(z=>Math.max(70,z-10))}>−</button>
            <strong>{zoom}%</strong>
            <button onClick={()=>setZoom(z=>Math.min(140,z+10))}>＋</button>
            <button onClick={()=>setZoom(100)}>100%に戻す</button>
          </div>
        </section>
      </aside>

      <main className="deskCenter">
        <section className="deskPanel workRegister">
          <h2>仕事登録</h2>
          <form onSubmit={registerOrder}>
            <div className="workGrid two">
              <label>ドライバー
                <select value={driverId} onChange={e=>setDriverId(e.target.value)}>
                  {availableDrivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label>キャスト
                <select value={castId} onChange={e=>setCastId(e.target.value)} disabled={!selectableCasts.length}>
                  {selectableCasts.map(c=><option key={c.id} value={c.id}>{c.name} / {statusLabels[c.status]}</option>)}
                </select>
              </label>
            </div>

            {selectedCast && <div className="selectedCastInfo selectedCastInfoWide">
              <div>
                <span>フリー単価</span>
                <strong>{new Intl.NumberFormat("ja-JP").format(selectedCast.freeUnitPrice??0)}円</strong>
              </div>
              <div>
                <span>写真指名単価</span>
                <strong>{new Intl.NumberFormat("ja-JP").format(selectedCast.photoUnitPrice??0)}円</strong>
              </div>
              <div>
                <span>本指名単価</span>
                <strong>{new Intl.NumberFormat("ja-JP").format(selectedCast.repeatUnitPrice??0)}円</strong>
              </div>
              <div>
                <span>NG内容</span>
                <strong>{(selectedCast.ngDetails??[]).length ? (selectedCast.ngDetails??[]).join(" / ") : "なし"}</strong>
              </div>
              <div>
                <span>可能OP</span>
                <strong>{(selectedCast.availableOptions??[]).length ? (selectedCast.availableOptions??[]).join(" / ") : "なし"}</strong>
              </div>
              <div>
                <span>備考</span>
                <strong>{selectedCast.notes || "なし"}</strong>
              </div>
            </div>}

            <label>指名区分
              <select value={nominationType} onChange={e=>setNominationType(e.target.value as typeof nominationType)}>
                <option value="free">フリー</option><option value="photo">写真指名</option><option value="repeat">本指名</option>
              </select>
            </label>

            <label>料金コース
              <div className="courseChips">
                {courses.map(c=><button key={c.id} type="button" className={courseId===c.id?"active":""} onClick={()=>setCourseId(c.id)}>{c.minutes}分</button>)}
              </div>
            </label>

            <div className="workGrid two">
              <label>ホテル名
                <select value={locationName} onChange={e=>selectHotel(e.target.value)} disabled={!availableHotels.length}>
                  {availableHotels.length===0 && <option value="">ホテル未登録</option>}
                  {availableHotels.map(hotel=><option key={hotel.id} value={hotel.name}>{hotel.name}</option>)}
                </select>
              </label>
              <label>部屋番号
                <input value={room} onChange={e=>setRoom(e.target.value)} placeholder="例：101"/>
              </label>
            </div>

            <div className="workGrid three">
              <label>交通費<input type="number" value={travelFee} onChange={e=>setTravelFee(Number(e.target.value))}/></label>
              <label>割引<input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label>
              <label>OP合計<input type="number" value={optionsTotal} onChange={e=>setOptionsTotal(Number(e.target.value))}/></label>
            </div>

            <div className="workGrid two">
              <label>開始時間<input type="time" value={scheduledStart} onChange={e=>setScheduledStart(e.target.value)}/></label>
              <label>お客様電話番号<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="090-0000-0000"/></label>
            </div>

            <label>備考
              <textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="サンプル備考を入力"/>
            </label>

            <div className="workFooter">
              <div><small>自動計算</small><strong>{formatYen(total)}</strong></div>
              <div className="workButtons">
                <button className="registerBtn" type="submit" disabled={!selectedCast}>仕事を入れる</button>
                <Link href="/orders/new">詳細入力</Link>
                <button type="reset">クリア</button>
              </div>
            </div>
          </form>
        </section>
      </main>

      <aside className="deskRight">
        <section className="deskPanel">
          <div className="panelTitleRow">
            <h2>本日の予約一覧</h2>
            <span>{orders.length}件</span>
          </div>
          <div className="todayOrders">
            {orders.slice(0,7).map(order=><Link href="/orders" key={order.id}>
              <div><strong>{order.scheduledStart}</strong><span>{order.castName}</span></div>
              <small>{order.locationName || "場所未入力"} / {orderStatusLabels[order.status]}</small>
            </Link>)}
            {!orders.length && <p>本日の予約はありません</p>}
          </div>
        </section>
      </aside>
    </div>

    <section className="boardSection">
      <div className="boardSectionHead">
        <div><h2>配車ボード</h2><span>{date}</span></div>
        <div className="boardLegend">
          <span><i className="legend accepted"/>受付済</span>
          <span><i className="legend dispatching"/>配車中</span>
          <span><i className="legend serving"/>接客中</span>
        </div>
      </div>
      <div className="dispatchScroll boardZoomWrap">
        <div className="dispatchBoard wideBoard" style={{width:`${zoom}%`}}>
          <div className="dispatchHeader dispatchNameHead">キャスト</div>
          <div className="dispatchHeader dispatchShiftHead">出勤 / 受付 / 上り</div>
          <div className="dispatchHeader dispatchCountHead">本数</div>
          <div className="timelineHeader longTimeline">{hourLabels.map(hour=><div key={hour}>{hour}</div>)}</div>

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
              <div className="timelineCell longCell">
                {visibleOrders.map(order=>{
                  const pos = eventPosition(order)!;
                  return <Link key={order.id} href="/orders" className={`timelineOrder timelineOrder-${order.status}`} style={pos}>
                    <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                    <span>{order.castName}</span>
                    <small>{order.locationName || "場所未入力"} / {order.driverName ?? "配車未割当"}</small>
                  </Link>
                })}
                {!visibleOrders.length && <span className="emptyTimeline">空き</span>}
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
