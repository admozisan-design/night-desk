"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { casts as defaultCasts, defaultPricingConfig, drivers as defaultDrivers, hotels as defaultHotels, options as defaultOptions } from "@/lib/mock-data";
import { calculateOrderTotal, formatYen } from "@/lib/pricing";
import { deleteOrder, loadCasts, loadDrivers, loadHotels, loadOptions, loadOrders, loadPricing, saveCasts, saveOrder, updateOrder } from "@/lib/storage";
import type { Cast, CastAttendanceStatus, CastStatus, Driver, Hotel, Order, OrderStatus, PricingConfig, StoreOption } from "@/lib/types";

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
  accepted:"配車前", dispatching:"配車後", serving:"イン中", completed:"アウト", cancelled:"キャンセル"
};
const attendanceLabels: Record<CastAttendanceStatus,string> = {
  present:"出勤", late:"遅刻", absent:"当欠", leftEarly:"早退"
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
function castShiftForDate(cast:Cast,date:string){
  return cast.schedule?.find(shift=>shift.date===date);
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
function resolveOrderCourse(order:Order,pricing:PricingConfig){
  const byId=order.courseId ? pricing.courses.find(course=>course.id===order.courseId) : undefined;
  if(byId) return byId;
  const exact=pricing.courses.find(course=>course.minutes===order.courseMinutes);
  if(exact) return exact;
  return [...pricing.courses]
    .filter(course=>course.minutes<=order.courseMinutes)
    .sort((a,b)=>b.minutes-a.minutes)[0] ?? pricing.courses[0];
}
function resolveOrderExtensionMinutes(order:Order,pricing:PricingConfig){
  if(order.extensionMinutes!==undefined) return order.extensionMinutes;
  const base=resolveOrderCourse(order,pricing);
  return base ? Math.max(0,order.courseMinutes-base.minutes) : 0;
}
function resolveOrderExtensionTotal(order:Order,pricing:PricingConfig){
  if(order.extensionTotal!==undefined) return order.extensionTotal;
  const base=resolveOrderCourse(order,pricing);
  if(!base) return 0;
  const baseTotal=calculateOrderTotal({
    course:base,
    nominationType:order.nominationType,
    photoNominationFee:pricing.photoNominationFee,
    repeatNominationFee:pricing.repeatNominationFee,
    optionsTotal:order.optionsTotal,
    travelFee:order.travelFee,
    discount:order.discount,
    adjustment:order.adjustment??0
  });
  return Math.max(0,order.total-baseTotal);
}

export default function DashboardPage(){
  const [orders,setOrders] = useState<Order[]>([]);
  const [castList,setCastList] = useState<Cast[]>(defaultCasts);
  const [hotelList,setHotelList] = useState<Hotel[]>(defaultHotels);
  const [driverList,setDriverList] = useState<Driver[]>(defaultDrivers);
  const [optionList,setOptionList] = useState<StoreOption[]>(defaultOptions);
  const [pricing,setPricing] = useState<PricingConfig>(defaultPricingConfig);
  const [now,setNow] = useState<Date|null>(null);
  const [date,setDate] = useState(()=>dateInputValue(new Date()));
  const [detailCastId,setDetailCastId] = useState<string|null>(null);
  const [shiftEditCastId,setShiftEditCastId] = useState<string|null>(null);
  const [shiftDraft,setShiftDraft] = useState({start:"18:00",end:"04:00"});
  const [selectedOrderId,setSelectedOrderId] = useState<string|null>(null);
  const [orderMode,setOrderMode] = useState<"menu"|"extend">("menu");
  const [editingOrderId,setEditingOrderId] = useState<string|null>(null);
  const [extensionCount,setExtensionCount] = useState(1);
  const [copyNotice,setCopyNotice] = useState("");
  const orderClickTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [castId,setCastId] = useState("");
  const [driverId,setDriverId] = useState(defaultDrivers[0]?.id ?? "");
  const [courseId,setCourseId] = useState(defaultPricingConfig.courses[0]?.id ?? "");
  const [nominationType,setNominationType] = useState<"free"|"photo"|"repeat">("free");
  const [scheduledStart,setScheduledStart] = useState("13:30");
  const [locationName,setLocationName] = useState("");
  const [room,setRoom] = useState("101");
  const [phone,setPhone] = useState("090-0000-0000");
  const [note,setNote] = useState("サンプル備考");
  const [travelFee,setTravelFee] = useState(defaultPricingConfig.defaultTravelFee);
  const [discount,setDiscount] = useState(0);
  const [selectedOptionIds,setSelectedOptionIds] = useState<string[]>([]);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setCastList(loadCasts(defaultCasts));
      setHotelList(loadHotels(defaultHotels));
      setDriverList(loadDrivers(defaultDrivers));
      setOptionList(loadOptions(defaultOptions));
      setPricing(loadPricing(defaultPricingConfig));
    };
    refresh();
    setNow(new Date());
    const timer = window.setInterval(()=>setNow(new Date()),60000);
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:hotels",refresh);
    window.addEventListener("nightdesk:drivers",refresh);
    window.addEventListener("nightdesk:options",refresh);
    window.addEventListener("nightdesk:pricing",refresh);
    return ()=>{
      window.clearInterval(timer);
      if(orderClickTimer.current) window.clearTimeout(orderClickTimer.current);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:hotels",refresh);
      window.removeEventListener("nightdesk:drivers",refresh);
      window.removeEventListener("nightdesk:options",refresh);
      window.removeEventListener("nightdesk:pricing",refresh);
    };
  },[]);

  const workingCasts = useMemo(
    ()=>castList
      .filter(c=>{
        if(c.visible===false) return false;
        const shift=castShiftForDate(c,date);
        return shift ? shift.working : c.scheduledToday!==false;
      })
      .sort((a,b)=>{
        const aAttendance=castShiftForDate(a,date)?.attendance;
        const bAttendance=castShiftForDate(b,date)?.attendance;
        const rank=(attendance:CastAttendanceStatus|undefined)=>
          attendance==="absent" || attendance==="leftEarly" ? 1 : 0;
        return rank(aAttendance)-rank(bAttendance);
      }),
    [castList,date]
  );
  const selectableCasts = useMemo(()=>workingCasts.filter(c=>{
    const attendance=castShiftForDate(c,date)?.attendance;
    return c.status!=="off" && attendance!=="absent" && attendance!=="leftEarly";
  }),[workingCasts,date]);
  const availableHotels = useMemo(
    ()=>hotelList.filter(h=>h.visible!==false),
    [hotelList]
  );
  const availableDrivers = useMemo(
    ()=>driverList.filter(d=>d.active!==false),
    [driverList]
  );

  useEffect(()=>{
    if(editingOrderId) return;
    if(!selectableCasts.some(c=>c.id===castId)) setCastId(selectableCasts[0]?.id ?? "");
  },[selectableCasts,castId,editingOrderId]);

  useEffect(()=>{
    if(!availableDrivers.some(d=>d.id===driverId)) setDriverId(availableDrivers[0]?.id ?? "");
  },[availableDrivers,driverId]);

  useEffect(()=>{
    if(!pricing.courses.some(course=>course.id===courseId)){
      setCourseId(pricing.courses[0]?.id ?? "");
    }
  },[pricing.courses,courseId]);

  useEffect(()=>{
    if(!availableHotels.some(h=>h.name===locationName)){
      const first=availableHotels[0];
      setLocationName(first?.name ?? "");
      setTravelFee(first?.travelFee ?? 0);
    }
  },[availableHotels,locationName]);

  const editingOrder = editingOrderId ? orders.find(order=>order.id===editingOrderId) : undefined;
  const formCastChoices = useMemo(()=>{
    if(!editingOrder) return selectableCasts;
    const choices=new Map(selectableCasts.map(cast=>[cast.id,cast]));
    const current=castList.find(cast=>cast.id===editingOrder.castId && cast.visible!==false);
    if(current) choices.set(current.id,current);
    return [...choices.values()];
  },[editingOrder,castList,selectableCasts]);
  const course = pricing.courses.find(c=>c.id===courseId);
  const selectedCast = formCastChoices.find(c=>c.id===castId);
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

  const editingExtensionMinutes = editingOrder ? resolveOrderExtensionMinutes(editingOrder,pricing) : 0;
  const editingExtensionTotal = editingOrder ? resolveOrderExtensionTotal(editingOrder,pricing) : 0;
  const editingAdjustment = editingOrder?.adjustment ?? 0;
  const total = useMemo(()=>calculateOrderTotal({
    course,
    nominationType,
    photoNominationFee:pricing.photoNominationFee,
    repeatNominationFee:pricing.repeatNominationFee,
    optionsTotal,
    travelFee,
    discount,
    adjustment:editingAdjustment+editingExtensionTotal
  }),[course,nominationType,optionsTotal,travelFee,discount,pricing.photoNominationFee,pricing.repeatNominationFee,editingAdjustment,editingExtensionTotal]);

  const activeOrders = useMemo(()=>orders.filter(o=>o.status!=="completed"&&o.status!=="cancelled"),[orders]);
  const todaySales = useMemo(()=>orders.filter(o=>o.status!=="cancelled").reduce((sum,o)=>sum+o.total,0),[orders]);
  const waitingCount = workingCasts.filter(c=>c.status==="waiting").length;
  const nowPosition = now ? currentTimePosition(now) : null;
  const detailCast = detailCastId ? castList.find(c=>c.id===detailCastId) : undefined;
  const detailShift = detailCast ? castShiftForDate(detailCast,date) : undefined;
  const shiftEditCast = shiftEditCastId ? castList.find(c=>c.id===shiftEditCastId) : undefined;
  const selectedOrder = selectedOrderId ? orders.find(order=>order.id===selectedOrderId) : undefined;

  function replaceCastShift(cast:Cast, changes:Partial<NonNullable<Cast["schedule"]>[number]>){
    const existing=castShiftForDate(cast,date);
    const nextShift={
      date,
      start:existing?.start ?? cast.shiftStart ?? "18:00",
      end:existing?.end ?? cast.shiftEnd ?? "04:00",
      working:existing?.working ?? true,
      attendance:existing?.attendance,
      ...changes
    };
    const schedule=[...(cast.schedule??[]).filter(item=>item.date!==date),nextShift]
      .sort((a,b)=>a.date.localeCompare(b.date));
    const next=castList.map(item=>item.id===cast.id?{...item,schedule}:item);
    setCastList(next);
    saveCasts(next);
  }

  function updateAttendance(cast:Cast, attendance:CastAttendanceStatus){
    replaceCastShift(cast,{attendance,working:true});
  }

  function openShiftQuickEdit(cast:Cast){
    const shift=castShiftForDate(cast,date);
    setShiftDraft({
      start:shift?.start ?? cast.shiftStart ?? "18:00",
      end:shift?.end ?? cast.shiftEnd ?? "04:00"
    });
    setShiftEditCastId(cast.id);
  }

  function saveQuickShift(){
    if(!shiftEditCast) return;
    replaceCastShift(shiftEditCast,{start:shiftDraft.start,end:shiftDraft.end,working:true});
    setShiftEditCastId(null);
  }

  function openOrderMenu(order:Order){
    setSelectedOrderId(order.id);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function handleOrderSingleClick(order:Order){
    if(orderClickTimer.current) window.clearTimeout(orderClickTimer.current);
    orderClickTimer.current=window.setTimeout(()=>{
      openOrderMenu(order);
      orderClickTimer.current=null;
    },220);
  }

  function handleOrderDoubleClick(order:Order){
    if(orderClickTimer.current){
      window.clearTimeout(orderClickTimer.current);
      orderClickTimer.current=null;
    }
    const visual=orderVisualState(order,date,now);
    if(visual==="in" || visual==="out" || visual==="cancelled") return;
    const nextStatus:OrderStatus=order.status==="dispatching" ? "accepted" : "dispatching";
    setOrders(updateOrder(order.id,{status:nextStatus}));
  }

  function closeOrderMenu(){
    setSelectedOrderId(null);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function currentClockTime(){
    const value=new Date();
    return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
  }

  function recordInTime(){
    if(!selectedOrder) return;
    const inTime=currentClockTime();
    setOrders(updateOrder(selectedOrder.id,{inTime,status:"serving"}));
    setCopyNotice(`イン時間 ${inTime} を記録しました`);
  }

  async function copyOrderLine(kind:"send"|"pickup"){
    if(!selectedOrder) return;
    const roomText=selectedOrder.room ? ` ${selectedOrder.room}号室` : "";
    const text=kind==="send"
      ? `【送り】\nキャスト：${selectedOrder.castName}\n場所：${selectedOrder.locationName}${roomText}\n時間：${selectedOrder.scheduledStart}〜${selectedOrder.scheduledEnd}\nドライバー：${selectedOrder.driverName ?? "未割当"}`
      : `【お迎え】\nキャスト：${selectedOrder.castName}\nお迎え：${selectedOrder.scheduledEnd}\n場所：${selectedOrder.locationName}${roomText}\nドライバー：${selectedOrder.driverName ?? "未割当"}`;
    try{
      await navigator.clipboard.writeText(text);
      setCopyNotice(kind==="send"?"送り用LINEをコピーしました":"お迎え用LINEをコピーしました");
    }catch{
      setCopyNotice("コピーできませんでした");
    }
  }

  function beginOrderEdit(){
    if(!selectedOrder) return;
    const driver=driverList.find(driver=>driver.id===selectedOrder.driverId || driver.name===selectedOrder.driverName);
    const courseMatch=resolveOrderCourse(selectedOrder,pricing);
    const optionIds=optionList
      .filter(option=>(selectedOrder.selectedOptions??[]).includes(option.name))
      .map(option=>option.id);

    setEditingOrderId(selectedOrder.id);
    setCastId(selectedOrder.castId);
    setDriverId(selectedOrder.driverId ?? driver?.id ?? "");
    if(courseMatch) setCourseId(courseMatch.id);
    setNominationType(selectedOrder.nominationType);
    setScheduledStart(selectedOrder.scheduledStart);
    setLocationName(selectedOrder.locationName);
    setRoom(selectedOrder.room ?? "");
    setPhone(selectedOrder.customerPhone ?? "");
    setNote(selectedOrder.note ?? "");
    setTravelFee(selectedOrder.travelFee);
    setDiscount(selectedOrder.discount);
    setSelectedOptionIds(optionIds);

    closeOrderMenu();
    window.setTimeout(()=>{
      document.getElementById("work-register")?.scrollIntoView({behavior:"smooth",block:"start"});
    },60);
  }

  function resetOrderForm(){
    setEditingOrderId(null);
    setCastId(selectableCasts[0]?.id ?? "");
    setDriverId(availableDrivers[0]?.id ?? "");
    setCourseId(pricing.courses[0]?.id ?? "");
    setNominationType("free");
    setScheduledStart("13:30");
    const firstHotel=availableHotels[0];
    setLocationName(firstHotel?.name ?? "");
    setTravelFee(firstHotel?.travelFee ?? pricing.defaultTravelFee);
    setRoom("101");
    setPhone("090-0000-0000");
    setNote("サンプル備考");
    setSelectedOptionIds([]);
    setDiscount(0);
  }

  function beginExtension(){
    setExtensionCount(1);
    setOrderMode("extend");
  }

  function applyExtension(){
    if(!selectedOrder) return;
    const add=pricing.extensionMinutes*extensionCount;
    const addPrice=pricing.extensionPrice*extensionCount;
    const baseCourse=resolveOrderCourse(selectedOrder,pricing);
    const currentExtensionMinutes=resolveOrderExtensionMinutes(selectedOrder,pricing);
    const currentExtensionTotal=resolveOrderExtensionTotal(selectedOrder,pricing);
    setOrders(updateOrder(selectedOrder.id,{
      courseId:baseCourse?.id ?? selectedOrder.courseId,
      courseMinutes:baseCourse?.minutes ?? selectedOrder.courseMinutes,
      extensionMinutes:currentExtensionMinutes+add,
      extensionTotal:currentExtensionTotal+addPrice,
      scheduledEnd:addMinutes(selectedOrder.scheduledEnd,add),
      total:selectedOrder.total+addPrice
    }));
    setOrderMode("menu");
    setCopyNotice(`${add}分延長しました`);
  }

  function removeSelectedOrder(){
    if(!selectedOrder) return;
    if(!window.confirm(`${selectedOrder.castName} のオーダーを削除しますか？`)) return;
    setOrders(deleteOrder(selectedOrder.id));
    closeOrderMenu();
  }

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

    const selectedOptionNames=selectableOptions
      .filter(option=>selectedOptionIds.includes(option.id))
      .map(option=>option.name);
    const effectiveExtensionMinutes=editingOrder ? editingExtensionMinutes : 0;
    const effectiveExtensionTotal=editingOrder ? editingExtensionTotal : 0;
    const commonChanges = {
      customerPhone:phone,
      locationType:"hotel" as const,
      locationName,
      room,
      castId:selectedCast.id,
      castName:selectedCast.name,
      driverId:selectedDriver?.id,
      driverName:selectedDriver?.name,
      courseId:course.id,
      courseMinutes:course.minutes,
      extensionMinutes:effectiveExtensionMinutes,
      extensionTotal:effectiveExtensionTotal,
      nominationType,
      selectedOptions:selectedOptionNames,
      optionsTotal,
      travelFee,
      discount,
      total,
      scheduledStart,
      scheduledEnd:addMinutes(scheduledStart,course.minutes+effectiveExtensionMinutes),
      note
    };

    if(editingOrderId){
      const syncedOrders=updateOrder(editingOrderId,commonChanges);
      setOrders(syncedOrders);
    }else{
      const order:Order = {
        id:crypto.randomUUID(),
        createdAt:new Date().toISOString(),
        ...commonChanges,
        extensionMinutes:0,
        extensionTotal:0,
        adjustment:0,
        status:"accepted"
      };
      saveOrder(order);
      setOrders(loadOrders());
    }
    resetOrderForm();
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

        <section className="deskPanel operationGuide">
          <h2>操作ガイド</h2>
          <div className="operationGuideList">
            <div><span className="guideDot beforeDispatch"/><p><strong>紫：配車前</strong><small>オーダーをダブルクリックで配車後へ</small></p></div>
            <div><span className="guideDot afterDispatch"/><p><strong>橙：配車後</strong><small>もう一度ダブルクリックで配車前へ戻す</small></p></div>
            <div><span className="guideDot inService"/><p><strong>緑：イン中</strong><small>オーダーをクリック →「イン時間」で切替</small></p></div>
            <div><span className="guideDot out"/><p><strong>灰：アウト</strong><small>終了予定時間を過ぎると自動でグレー表示</small></p></div>
          </div>
          <div className="operationGuideTips">
            <p><strong>クリック</strong><span>オーダー操作メニューを開く</span></p>
            <p><strong>キャスト名</strong><span>出勤・遅刻・当欠・早退を変更</span></p>
            <p><strong>出勤時間</strong><span>クリックでクイック修正</span></p>
          </div>
        </section>
      </aside>

      <main className="deskCenter">
        <section className={`deskPanel workRegister ${editingOrderId?"isEditingOrder":""}`} id="work-register">
          <div className="workRegisterTitleRow">
            <h2>{editingOrderId?"仕事編集":"仕事登録"}</h2>
            {editingOrderId && <span className="workEditBadge">既存オーダー編集中</span>}
          </div>
          <form onSubmit={registerOrder}>
            <div className="workGrid two">
              <label>ドライバー
                <select value={driverId} onChange={e=>setDriverId(e.target.value)}>
                  {availableDrivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label>キャスト
                <select value={castId} onChange={e=>setCastId(e.target.value)} disabled={!formCastChoices.length}>
                  {formCastChoices.map(c=><option key={c.id} value={c.id}>{c.name} / {statusLabels[c.status]}</option>)}
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
                {pricing.courses.map(c=><button key={c.id} type="button" className={courseId===c.id?"active":""} onClick={()=>setCourseId(c.id)}>{c.minutes}分</button>)}
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

            <div className="orderOptionPicker">
              <div className="orderOptionPickerHead">
                <span>オプション</span>
                <strong>{formatYen(optionsTotal)}</strong>
              </div>
              <div className="orderOptionChoices">
                {selectableOptions.map(option=>{
                  const checked=selectedOptionIds.includes(option.id);
                  return <button key={option.id} type="button" className={checked?"active":""} onClick={()=>toggleOrderOption(option.id)}>
                    <span>{option.name}</span>
                    <small>{option.price===0?"無料":formatYen(option.price)}</small>
                  </button>
                })}
                {selectedCast && selectableOptions.length===0 && <span className="orderOptionEmpty">対応可能なオプションはありません</span>}
              </div>
            </div>

            <div className="workGrid two">
              <label>交通費<input type="number" value={travelFee} onChange={e=>setTravelFee(Number(e.target.value))}/></label>
              <label>割引<input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label>
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
                <button className="registerBtn" type="submit" disabled={!selectedCast}>{editingOrderId?"変更を保存":"仕事を入れる"}</button>
                {!editingOrderId && <Link href="/orders/new">詳細入力</Link>}
                <button type="button" onClick={resetOrderForm}>{editingOrderId?"編集キャンセル":"クリア"}</button>
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
          <span><i className="legend beforeDispatch"/>配車前</span>
          <span><i className="legend afterDispatch"/>配車後</span>
          <span><i className="legend inService"/>イン中</span>
          <span><i className="legend out"/>アウト</span>
        </div>
      </div>
      <div className="dispatchScroll boardZoomWrap">
        <div className="dispatchBoard wideBoard">
          <div className="dispatchHeader dispatchNameHead">キャスト</div>
          <div className="dispatchHeader dispatchShiftHead">出勤 / 受付 / 上り</div>
          <div className="dispatchHeader dispatchCountHead">本数</div>
          <div className="timelineHeader longTimeline">{hourLabels.map(hour=><div key={hour}>{hour}</div>)}</div>

          {workingCasts.map(cast=>{
            const castOrders = orders.filter(o=>o.castId===cast.id && o.status!=="cancelled");
            const visibleOrders = castOrders.filter(o=>eventPosition(o));
            const shift=castShiftForDate(cast,date);
            const attendance=shift?.attendance;
            const unavailable=attendance==="absent" || attendance==="leftEarly";
            const shiftStart=shift?.start ?? cast.shiftStart ?? "10:00";
            const shiftEnd=shift?.end ?? cast.shiftEnd ?? "05:00";
            const availability=shiftAvailabilityPosition(shiftStart,shiftEnd);
            return <div className={`dispatchRowContents ${unavailable?"isUnavailableCast":""}`} key={cast.id}>
              <div className="dispatchName">
                <span className={`castStateDot ${cast.status}`}/>
                <button type="button" className="dispatchCastButton" onClick={()=>setDetailCastId(cast.id)}>
                  <strong>{cast.name}</strong>
                  <span className="dispatchCastMeta">
                    <small>{statusLabels[cast.status]}</small>
                    {shift?.attendance
                      ? <em className={`attendanceBadge ${shift.attendance}`}>{attendanceLabels[shift.attendance]}</em>
                      : <em className="attendanceBadge unconfirmed">未確認</em>}
                  </span>
                </button>
              </div>
              <div className="dispatchShift">
                <button type="button" className="dispatchShiftQuick" onClick={()=>openShiftQuickEdit(cast)} title="出勤時間をクイック修正">
                  <span>出勤 <b>{shift?.start ?? cast.shiftStart ?? "--:--"}</b></span>
                  <span>上り <b>{shift?.end ?? cast.shiftEnd ?? "--:--"}</b></span>
                </button>
              </div>
              <div className="dispatchCount"><strong>{castOrders.length}</strong><span>本</span></div>
              <div className="timelineCell longCell">
                {visibleOrders.map(order=>{
                  const pos = eventPosition(order)!;
                  const visualState=orderVisualState(order,date,now);
                  return <button
                    type="button"
                    key={order.id}
                    className={`timelineOrder orderVisual-${visualState}`}
                    style={pos}
                    onClick={()=>handleOrderSingleClick(order)}
                    onDoubleClick={()=>handleOrderDoubleClick(order)}
                    title={visualState==="beforeDispatch"?"配車前（ダブルクリックで配車後へ）":visualState==="afterDispatch"?"配車後（ダブルクリックで配車前へ）":visualState==="in"?"イン中":visualState==="out"?"アウト":"キャンセル"}
                  >
                    <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                    <span>{order.castName}</span>
                    <small>{order.locationName || "場所未入力"}{order.room ? ` ${order.room}` : ""} / {order.driverName ?? "配車未割当"} / {order.courseMinutes+(order.extensionMinutes??0)}分</small>
                  </button>
                })}
                {!visibleOrders.length && !unavailable && <span className="emptyTimeline">空き</span>}
                <div className="offShiftBlock before" style={{width:availability.beforeWidth}} title="出勤時間外">
                  <span>出勤前</span>
                </div>
                <div className="offShiftBlock after" style={{left:availability.afterLeft,width:availability.afterWidth}} title="出勤時間外">
                  <span>上り後</span>
                </div>
                {unavailable && <div className="unavailableCastTimelineBlock">
                  <strong>{attendance==="absent"?"当欠":"早退"}</strong>
                </div>}
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

    {selectedOrder && <div className="orderActionBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)closeOrderMenu();}}>
      <div className="orderActionModal" role="dialog" aria-modal="true" aria-labelledby="order-action-title">
        <div className="orderActionSummary">
          <div>
            <span>{selectedOrder.castName}</span>
            <strong id="order-action-title">{selectedOrder.scheduledStart}〜{selectedOrder.scheduledEnd}</strong>
          </div>
          <small>{selectedOrder.locationName}{selectedOrder.room ? ` / ${selectedOrder.room}号室` : ""}</small>
        </div>

        {copyNotice && <div className="orderActionNotice">{copyNotice}</div>}

        {orderMode==="menu" && <div className="orderActionButtons">
          <button type="button" className="orderActionIn" onClick={recordInTime}>
            {selectedOrder.inTime ? `イン ${selectedOrder.inTime}` : "イン時間"}
          </button>
          <button type="button" className="orderActionSend" onClick={()=>copyOrderLine("send")}>送り用LINEコピー</button>
          <button type="button" className="orderActionPickup" onClick={()=>copyOrderLine("pickup")}>お迎え用LINEコピー</button>
          <button type="button" className="orderActionEdit" onClick={beginOrderEdit}>編集</button>
          <button type="button" className="orderActionExtend" onClick={beginExtension}>延長処理</button>
          <button type="button" className="orderActionDelete" onClick={removeSelectedOrder}>削除</button>
          <button type="button" className="orderActionClose" onClick={closeOrderMenu}>閉じる</button>
        </div>}

        {orderMode==="extend" && <div className="orderActionSubpanel">
          <h3>延長処理</h3>
          <div className="extensionControl">
            <button type="button" onClick={()=>setExtensionCount(value=>Math.max(1,value-1))}>−</button>
            <div>
              <strong>{pricing.extensionMinutes*extensionCount}分</strong>
              <span>＋{formatYen(pricing.extensionPrice*extensionCount)}</span>
            </div>
            <button type="button" onClick={()=>setExtensionCount(value=>value+1)}>＋</button>
          </div>
          <p className="extensionPreview">終了予定 {selectedOrder.scheduledEnd} → <strong>{addMinutes(selectedOrder.scheduledEnd,pricing.extensionMinutes*extensionCount)}</strong></p>
          <div className="orderActionSubButtons">
            <button type="button" onClick={()=>setOrderMode("menu")}>戻る</button>
            <button type="button" className="primary danger" onClick={applyExtension}>延長確定</button>
          </div>
        </div>}
      </div>
    </div>}

    {detailCast && <div className="attendanceModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setDetailCastId(null);}}>
      <div className="attendanceModal" role="dialog" aria-modal="true" aria-labelledby="attendance-modal-title">
        <div className="attendanceModalHead">
          <div>
            <span>キャスト詳細</span>
            <h2 id="attendance-modal-title">{detailCast.name}</h2>
          </div>
          <button type="button" onClick={()=>setDetailCastId(null)} aria-label="閉じる">×</button>
        </div>
        <div className="attendanceModalInfo">
          <div><span>日付</span><strong>{date}</strong></div>
          <div><span>出勤予定</span><strong>{detailShift?.start ?? detailCast.shiftStart ?? "--:--"} 〜 {detailShift?.end ?? detailCast.shiftEnd ?? "--:--"}</strong></div>
          <div><span>現在状態</span><strong>{statusLabels[detailCast.status]}</strong></div>
        </div>
        <div className="attendanceModalSection">
          <div className="attendanceModalSectionTitle">
            <span>出勤確認</span>
            <strong>{detailShift?.attendance ? attendanceLabels[detailShift.attendance] : "未確認"}</strong>
          </div>
          <div className="attendanceStatusChoices">
            <button type="button" className={detailShift?.attendance==="present"?"present active":"present"} onClick={()=>updateAttendance(detailCast,"present")}>出勤</button>
            <button type="button" className={detailShift?.attendance==="late"?"late active":"late"} onClick={()=>updateAttendance(detailCast,"late")}>遅刻</button>
            <button type="button" className={detailShift?.attendance==="absent"?"absent active":"absent"} onClick={()=>updateAttendance(detailCast,"absent")}>当欠</button>
            <button type="button" className={detailShift?.attendance==="leftEarly"?"leftEarly active":"leftEarly"} onClick={()=>updateAttendance(detailCast,"leftEarly")}>早退</button>
          </div>
        </div>
        <div className="attendanceModalFooter">
          <button type="button" onClick={()=>setDetailCastId(null)}>閉じる</button>
        </div>
      </div>
    </div>}

    {shiftEditCast && <div className="attendanceModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setShiftEditCastId(null);}}>
      <div className="attendanceModal shiftQuickModal" role="dialog" aria-modal="true" aria-labelledby="shift-quick-title">
        <div className="attendanceModalHead">
          <div>
            <span>クイック修正</span>
            <h2 id="shift-quick-title">{shiftEditCast.name} の出勤時間</h2>
          </div>
          <button type="button" onClick={()=>setShiftEditCastId(null)} aria-label="閉じる">×</button>
        </div>
        <div className="shiftQuickForm">
          <label>出勤
            <input type="time" value={shiftDraft.start} onChange={e=>setShiftDraft(current=>({...current,start:e.target.value}))}/>
          </label>
          <label>上り
            <input type="time" value={shiftDraft.end} onChange={e=>setShiftDraft(current=>({...current,end:e.target.value}))}/>
          </label>
        </div>
        <div className="attendanceModalFooter">
          <button type="button" onClick={()=>setShiftEditCastId(null)}>キャンセル</button>
          <button type="button" className="primaryButton" onClick={saveQuickShift}>保存</button>
        </div>
      </div>
    </div>}
  </div>
}
