"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { casts as defaultCasts, defaultPricingConfig, defaultStoreSettings, drivers as defaultDrivers, hotels as defaultHotels, options as defaultOptions } from "@/lib/mock-data";
import { defaultDispatchWidgets } from "@/lib/dispatch-widgets";
import { calculateOrderTotal, formatYen } from "@/lib/pricing";
import {checkCastAvailability,suggestDrivers,activeBusinessDate,businessMinutes} from "@/lib/operations";
import { addFreeReservationHold, deleteFreeReservationHold, deleteOrder, loadCasts, loadCustomers, loadDrivers, loadFreeReservationHolds, loadHotels, loadOptions, loadOrders, loadPricing, loadSharedMemo, loadStoreSettings, saveCasts, saveCustomers, confirmReservation, saveSharedMemo, updateOrder } from "@/lib/storage";
import type { Cast, CastAttendanceStatus, CastShiftEndType, CastStatus, Customer, DispatchWidgetId, Driver, FreeReservationHold, Hotel, Order, OrderStatus, PricingConfig, StoreOption } from "@/lib/types";

function clockMinutes(time:string){
  const [hour,minute]=time.split(":").map(Number);
  return hour*60+minute;
}
function boardRelativeMinutes(time:string,boardStart:number){
  let value=clockMinutes(time);
  while(value<boardStart) value+=24*60;
  return value-boardStart;
}
const statusLabels: Record<CastStatus,string> = {
  waiting:"待機", moving:"移動中", serving:"接客中", off:"退勤"
};
const orderStatusLabels: Record<OrderStatus,string> = {
  accepted:"配車前", dispatching:"配車後", serving:"イン中", completed:"アウト", cancelled:"キャンセル"
};
const attendanceLabels: Record<CastAttendanceStatus,string> = {
  present:"出勤", late:"遅刻", absent:"当欠", leftEarly:"早退"
};
type OperationAlert = {
  key:string;
  level:"danger"|"warning";
  label:string;
  detail:string;
  order:Order;
  time:string;
};

function eventPosition(order:Order,boardStart:number,boardMinutes:number){
  const rawStart=boardRelativeMinutes(order.scheduledStart,boardStart);
  let rawEnd=boardRelativeMinutes(order.scheduledEnd,boardStart);
  if(rawEnd<=rawStart) rawEnd+=24*60;
  const start=Math.max(0,rawStart);
  const end=Math.min(boardMinutes,rawEnd);
  if(end<=0 || start>=boardMinutes || end<=start) return null;
  return {left:`${(start/boardMinutes)*100}%`,width:`${((end-start)/boardMinutes)*100}%`};
}
function freeHoldPosition(item:FreeReservationHold,boardStart:number,boardMinutes:number){
  const start=boardRelativeMinutes(item.scheduledStart,boardStart);
  const duration=Math.max(1,item.courseMinutes+(item.extensionMinutes??0));
  const end=start+duration;
  const visibleStart=Math.max(0,start);
  const visibleEnd=Math.min(boardMinutes,end);
  if(visibleEnd<=0 || visibleStart>=boardMinutes || visibleEnd<=visibleStart) return null;
  return {
    left:`${(visibleStart/boardMinutes)*100}%`,
    width:`${((visibleEnd-visibleStart)/boardMinutes)*100}%`
  };
}
function currentTimePosition(now:Date,boardStart:number,boardMinutes:number){
  let minutes=now.getHours()*60+now.getMinutes();
  while(minutes<boardStart) minutes+=24*60;
  const value=minutes-boardStart;
  if(value<0 || value>boardMinutes) return null;
  return `${(value/boardMinutes)*100}%`;
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
function castShiftEndDateTime(cast:Cast,serviceDate:string,storeClose:string){
  const shift=castShiftForDate(cast,serviceDate);
  const endType=shift?.endType ?? "leave";
  const endTime=endType==="reception"
    ? storeClose
    : (shift?.endTime ?? cast.shiftEnd ?? storeClose);
  const [year,month,day]=serviceDate.split("-").map(Number);
  const [hour,minute]=endTime.split(":").map(Number);
  const result=new Date(year,month-1,day,hour,minute,0,0);
  if(hour<10) result.setDate(result.getDate()+1);
  return result;
}
function castIsAutoOff(cast:Cast,serviceDate:string,storeClose:string,now:Date|null){
  if(!now) return false;
  return now>=castShiftEndDateTime(cast,serviceDate,storeClose);
}
function castOperationalStatus(cast:Cast,dateOrders:Order[],serviceDate:string,now:Date|null,storeClose:string):CastStatus{
  const shift=castShiftForDate(cast,serviceDate);
  if(shift && (!shift.working || shift.attendance==="absent" || shift.attendance==="leftEarly")) return "off";
  if(castIsAutoOff(cast,serviceDate,storeClose,now)) return "off";
  const states=dateOrders
    .filter(order=>order.castId===cast.id && order.status!=="cancelled")
    .map(order=>orderVisualState(order,serviceDate,now));
  if(states.includes("in")) return "serving";
  if(states.includes("afterDispatch")) return "moving";
  return "waiting";
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
function normalizePhone(value:string){
  return value.replace(/\D/g,"");
}
function clockTimeValue(value=new Date()){
  return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
}
function roundUpToUnit(value:number,unit:number){
  if(unit<=1) return Math.round(value);
  return Math.ceil(value/unit)*unit;
}
function orderServiceDate(order:Order){
  if(order.serviceDate) return order.serviceDate;
  return dateInputValue(new Date(order.createdAt));
}
function hotelKindLabel(kind:Hotel["kind"]){
  if(kind==="business") return "ビジネス";
  if(kind==="home") return "自宅";
  return "ラブホテル";
}
function castShiftForDate(cast:Cast,date:string){
  return cast.schedule?.find(shift=>shift.date===date);
}
function shiftAvailabilityPosition(startTime:string,endTime:string,boardStart:number,boardMinutes:number){
  let start=boardRelativeMinutes(startTime,boardStart);
  let end=boardRelativeMinutes(endTime,boardStart);
  if(end<=start) end+=24*60;

  const visibleStart=Math.max(0,Math.min(boardMinutes,start));
  const visibleEnd=Math.max(0,Math.min(boardMinutes,end));

  return {
    beforeWidth:`${(visibleStart/boardMinutes)*100}%`,
    afterLeft:`${(visibleEnd/boardMinutes)*100}%`,
    afterWidth:`${((boardMinutes-visibleEnd)/boardMinutes)*100}%`
  };
}
function receptionClosedPosition(receptionEnd:string,endTime:string,boardStart:number,boardMinutes:number){
  let start=boardRelativeMinutes(receptionEnd,boardStart);
  let end=boardRelativeMinutes(endTime,boardStart);
  if(end<start) end+=24*60;
  const visibleStart=Math.max(0,Math.min(boardMinutes,start));
  const visibleEnd=Math.max(0,Math.min(boardMinutes,end));
  return {
    left:`${(visibleStart/boardMinutes)*100}%`,
    width:`${(Math.max(0,visibleEnd-visibleStart)/boardMinutes)*100}%`
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
  const [freeReservationHolds,setFreeReservationHolds] = useState<FreeReservationHold[]>([]);
  const [activeFreeHoldId,setActiveFreeHoldId] = useState<string|null>(null);
  const [castList,setCastList] = useState<Cast[]>(defaultCasts);
  const [hotelList,setHotelList] = useState<Hotel[]>(defaultHotels);
  const [driverList,setDriverList] = useState<Driver[]>(defaultDrivers);
  const [optionList,setOptionList] = useState<StoreOption[]>(defaultOptions);
  const [customerList,setCustomerList] = useState<Customer[]>([]);
  const [pricing,setPricing] = useState<PricingConfig>(defaultPricingConfig);
  const [storeSettings,setStoreSettings] = useState(defaultStoreSettings);
  const [now,setNow] = useState<Date|null>(null);
  const [date,setDate] = useState(()=>activeBusinessDate(new Date(),defaultStoreSettings.openTime));
  const [detailCastId,setDetailCastId] = useState<string|null>(null);
  const [shiftEditCastId,setShiftEditCastId] = useState<string|null>(null);
  const [shiftDraft,setShiftDraft] = useState<{start:string;endType:CastShiftEndType;endTime:string}>({start:"18:00",endType:"leave",endTime:"04:00"});
  const [selectedOrderId,setSelectedOrderId] = useState<string|null>(null);
  const [orderMode,setOrderMode] = useState<"menu"|"inTime"|"extend"|"change"|"cancel">("menu");
  const [editingOrderId,setEditingOrderId] = useState<string|null>(null);
  const [pendingEditOrderId,setPendingEditOrderId] = useState<string|null>(null);
  const [pendingActionOrderId,setPendingActionOrderId] = useState<string|null>(null);
  const [extensionCount,setExtensionCount] = useState(1);
  const [formExtensionCount,setFormExtensionCount] = useState(0);
  const [inTimeDraft,setInTimeDraft] = useState("");
  const [changeCastId,setChangeCastId] = useState("");
  const [copyNotice,setCopyNotice] = useState("");
  const [customerNotice,setCustomerNotice] = useState("");
  const [customerPanelOpen,setCustomerPanelOpen] = useState(false);
  const [optionModalOpen,setOptionModalOpen] = useState(false);
  const [castNotesExpanded,setCastNotesExpanded] = useState(false);
  const [sharedMemo,setSharedMemo] = useState("");
  const [sharedMemoSaved,setSharedMemoSaved] = useState(false);
  const dispatchWidgets=defaultDispatchWidgets;
  const [castSortMode,setCastSortMode] = useState<"default"|"activity"|"countDesc"|"countAsc"|"shiftStart"|"name">("default");

  const [castId,setCastId] = useState("");
  const [driverId,setDriverId] = useState("");
  const [courseId,setCourseId] = useState(defaultPricingConfig.courses[0]?.id ?? "");
  const [nominationType,setNominationType] = useState<"free"|"photo"|"repeat">("free");
  const [scheduledStart,setScheduledStart] = useState(()=>clockTimeValue());
  const [locationName,setLocationName] = useState("");
  const [room,setRoom] = useState("101");
  const [address,setAddress] = useState("");
  const [phone,setPhone] = useState("");
  const [note,setNote] = useState("サンプル備考");
  const [travelFee,setTravelFee] = useState(defaultPricingConfig.defaultTravelFee);
  const [discount,setDiscount] = useState(0);
  const [surcharge,setSurcharge] = useState(0);
  const discountPresets=storeSettings.discountPresets??[0];
  const surchargePresets=storeSettings.surchargePresets??[0];
  const [paymentMethod,setPaymentMethod] = useState<"cash"|"card">("cash");
  const [selectedOptionIds,setSelectedOptionIds] = useState<string[]>([]);
  const boardScrollRef=useRef<HTMLDivElement|null>(null);
  const lastBoardAutoScrollDateRef=useRef<string|null>(null);
  const boardGridRef=useRef<HTMLDivElement|null>(null);
  const [globalNowLineLeft,setGlobalNowLineLeft]=useState<number|null>(null);
  const widgetLeftRef=useRef<HTMLDivElement|null>(null);
  const widgetCenterRef=useRef<HTMLDivElement|null>(null);
  const widgetRightRef=useRef<HTMLDivElement|null>(null);
  const widgetBottomRef=useRef<HTMLDivElement|null>(null);
  const [widgetTargetsReady,setWidgetTargetsReady]=useState(false);

  useEffect(()=>{
    setWidgetTargetsReady(true);
  },[]);

  useEffect(()=>{
    const refresh=()=>{
      setOrders(loadOrders());
      setFreeReservationHolds(loadFreeReservationHolds());
      setCastList(loadCasts(defaultCasts));
      setHotelList(loadHotels(defaultHotels));
      setDriverList(loadDrivers(defaultDrivers));
      setOptionList(loadOptions(defaultOptions));
      setCustomerList(loadCustomers());
      setPricing(loadPricing(defaultPricingConfig));
      setStoreSettings(loadStoreSettings(defaultStoreSettings));
    };
    refresh();
    setSharedMemo(loadSharedMemo());
    setNow(new Date());
    const searchParams=new URLSearchParams(window.location.search);
    setPendingEditOrderId(searchParams.get("editOrder"));
    setPendingActionOrderId(searchParams.get("orderAction"));
    const timer = window.setInterval(()=>setNow(new Date()),60000);
    window.addEventListener("storage",refresh);
    window.addEventListener("nightdesk:orders",refresh);
    window.addEventListener("nightdesk:free-reservation-holds",refresh);
    window.addEventListener("nightdesk:casts",refresh);
    window.addEventListener("nightdesk:hotels",refresh);
    window.addEventListener("nightdesk:drivers",refresh);
    window.addEventListener("nightdesk:options",refresh);
    window.addEventListener("nightdesk:pricing",refresh);
    window.addEventListener("nightdesk:customers",refresh);
    window.addEventListener("nightdesk:store-settings",refresh);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("nightdesk:orders",refresh);
      window.removeEventListener("nightdesk:free-reservation-holds",refresh);
      window.removeEventListener("nightdesk:casts",refresh);
      window.removeEventListener("nightdesk:hotels",refresh);
      window.removeEventListener("nightdesk:drivers",refresh);
      window.removeEventListener("nightdesk:options",refresh);
      window.removeEventListener("nightdesk:pricing",refresh);
      window.removeEventListener("nightdesk:customers",refresh);
      window.removeEventListener("nightdesk:store-settings",refresh);
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
    if(castId && !selectableCasts.some(c=>c.id===castId)) setCastId("");
  },[selectableCasts,castId,editingOrderId]);

  useEffect(()=>{
    setCastNotesExpanded(false);
  },[castId]);

  useEffect(()=>{
    if(driverId && !availableDrivers.some(d=>d.id===driverId)) setDriverId("");
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
  const selectedHotel = availableHotels.find(h=>h.name===locationName);
  const phoneKey=normalizePhone(phone);
  const matchedCustomer=useMemo(()=>{
    if(phoneKey.length<4) return undefined;
    return customerList.find(customer=>normalizePhone(customer.phone)===phoneKey);
  },[customerList,phoneKey]);
  const customerHistory=useMemo(()=>{
    if(phoneKey.length<4) return [];
    return orders
      .filter(order=>normalizePhone(order.customerPhone??"")===phoneKey && order.status!=="cancelled")
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  },[orders,phoneKey]);
  const workingCastIdsToday=useMemo(()=>new Set(workingCasts.map(cast=>cast.id)),[workingCasts]);
  const customerNgText=(matchedCustomer?.ngInfo??"").toLowerCase();
  function historyCastIsNg(history:Order){
    const cast=castList.find(item=>item.id===history.castId);
    const castName=(cast?.name ?? history.castName ?? "").trim().toLowerCase();
    return Boolean(castName && customerNgText.includes(castName));
  }
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

  const editingAdjustment = editingOrder?.adjustment ?? 0;
  const formExtensionMinutes=Math.max(0,pricing.extensionMinutes*formExtensionCount);
  const formExtensionTotal=Math.max(0,pricing.extensionPrice*formExtensionCount);
  const formScheduledEnd=course ? addMinutes(scheduledStart,course.minutes+formExtensionMinutes) : scheduledStart;
  const subtotalBeforeCard = useMemo(()=>calculateOrderTotal({
    course,
    nominationType,
    photoNominationFee:pricing.photoNominationFee,
    repeatNominationFee:pricing.repeatNominationFee,
    optionsTotal,
    travelFee,
    discount,
    adjustment:editingAdjustment+formExtensionTotal+surcharge
  }),[course,nominationType,optionsTotal,travelFee,discount,surcharge,pricing.photoNominationFee,pricing.repeatNominationFee,editingAdjustment,formExtensionTotal]);
  const cardFee = paymentMethod==="card"
    ? roundUpToUnit(subtotalBeforeCard*((storeSettings.cardFeeRate??0)/100),storeSettings.priceUnit??100)
    : 0;
  const total = subtotalBeforeCard+cardFee;

  const driverCandidates=suggestDrivers({
    drivers:availableDrivers,orders,date,start:scheduledStart,
    settings:storeSettings,ignoreOrderId:editingOrderId??undefined
  });

  const selectedDateOrders = useMemo(
    ()=>orders.filter(order=>orderServiceDate(order)===date),
    [orders,date]
  );
  const selectedDateFreeHolds = useMemo(
    ()=>freeReservationHolds
      .filter(item=>item.serviceDate===date)
      .sort((a,b)=>a.scheduledStart.localeCompare(b.scheduledStart)),
    [freeReservationHolds,date]
  );

  const boardCasts = useMemo(()=>{
    const baseOrder=new Map(workingCasts.map((cast,index)=>[cast.id,index]));
    const orderCount=(cast:Cast)=>selectedDateOrders.filter(
      order=>order.castId===cast.id && order.status!=="cancelled"
    ).length;
    const isFinished=(cast:Cast)=>{
      const shift=castShiftForDate(cast,date);
      return cast.status==="off" ||
        shift?.attendance==="absent" ||
        shift?.attendance==="leftEarly" ||
        castIsAutoOff(cast,date,storeSettings.closeTime,now);
    };
    const shiftStart=(cast:Cast)=>{
      const shift=castShiftForDate(cast,date);
      return businessMinutes(shift?.start ?? cast.shiftStart ?? storeSettings.openTime,storeSettings.openTime);
    };
    const activityMeta=(cast:Cast)=>{
      const castOrders=selectedDateOrders.filter(order=>order.castId===cast.id && order.status!=="cancelled");
      const states=castOrders.map(order=>({
        order,
        state:orderVisualState(order,date,now)
      }));
      const rankForState=(state:string)=>{
        if(state==="in") return 0;
        if(state==="afterDispatch") return 1;
        if(state==="beforeDispatch") return 2;
        return 3;
      };
      let rank=3;
      for(const row of states) rank=Math.min(rank,rankForState(row.state));
      const relevantTimes=states
        .filter(row=>rankForState(row.state)===rank && rank<3)
        .map(row=>businessMinutes(row.order.scheduledStart,storeSettings.openTime));
      return {
        rank,
        time:relevantTimes.length ? Math.min(...relevantTimes) : Number.POSITIVE_INFINITY
      };
    };

    return workingCasts.slice().sort((a,b)=>{
      const finishedRank=Number(isFinished(a))-Number(isFinished(b));
      if(finishedRank!==0) return finishedRank;

      if(castSortMode==="activity"){
        const aMeta=activityMeta(a);
        const bMeta=activityMeta(b);
        const rankDiff=aMeta.rank-bMeta.rank;
        if(rankDiff!==0) return rankDiff;
        const timeDiff=aMeta.time-bMeta.time;
        if(Number.isFinite(timeDiff) && timeDiff!==0) return timeDiff;
      }else if(castSortMode==="countDesc"){
        const diff=orderCount(b)-orderCount(a);
        if(diff!==0) return diff;
      }else if(castSortMode==="countAsc"){
        const diff=orderCount(a)-orderCount(b);
        if(diff!==0) return diff;
      }else if(castSortMode==="shiftStart"){
        const diff=shiftStart(a)-shiftStart(b);
        if(diff!==0) return diff;
      }else if(castSortMode==="name"){
        const diff=a.name.localeCompare(b.name,"ja");
        if(diff!==0) return diff;
      }

      return (baseOrder.get(a.id)??0)-(baseOrder.get(b.id)??0);
    });
  },[workingCasts,selectedDateOrders,date,storeSettings.openTime,storeSettings.closeTime,now,castSortMode]);
  const displayedBoardOrderCount = useMemo(
    ()=>boardCasts.reduce(
      (sum,cast)=>sum+selectedDateOrders.filter(order=>order.castId===cast.id && order.status!=="cancelled").length,
      0
    ),
    [boardCasts,selectedDateOrders]
  );
  const todayValue=activeBusinessDate(new Date(),storeSettings.openTime);
  const operationAlerts = useMemo<OperationAlert[]>(()=>{
    if(!now) return [];
    const activeDate=activeBusinessDate(now,storeSettings.openTime);
    const currentMinute=businessMinutes(clockTimeValue(now),storeSettings.openTime);
    if(!Number.isFinite(currentMinute)) return [];

    const alerts:OperationAlert[]=[];
    for(const order of orders){
      if(orderServiceDate(order)!==activeDate || order.status==="cancelled" || order.status==="completed") continue;

      const start=businessMinutes(order.scheduledStart,storeSettings.openTime);
      if(!Number.isFinite(start)) continue;
      const duration=Math.max(1,(order.courseMinutes||0)+(order.extensionMinutes??0));
      const end=start+duration;
      const startDiff=start-currentMinute;
      const endDiff=end-currentMinute;
      const sendDriverAssigned=Boolean(order.driverId || order.driverName);
      const pickupDriverAssigned=Boolean(order.pickupDriverId || order.pickupDriverName);

      if(order.status==="accepted" && startDiff<0){
        alerts.push({
          key:`overdue-${order.id}`,
          level:"danger",
          label:"予約時間を過ぎています",
          detail:`${Math.abs(Math.floor(startDiff))}分超過 / まだ配車前です`,
          order,
          time:order.scheduledStart
        });
        continue;
      }

      if(!sendDriverAssigned && (order.status==="accepted" || order.status==="dispatching") && startDiff>=0 && startDiff<=10){
        alerts.push({
          key:`send-${order.id}`,
          level:"warning",
          label:"送りドライバー未設定",
          detail:startDiff===0 ? "予約開始時刻です" : `予約まであと${Math.ceil(startDiff)}分`,
          order,
          time:order.scheduledStart
        });
      }

      if(!pickupDriverAssigned && (order.status==="dispatching" || order.status==="serving") && endDiff<=10){
        alerts.push({
          key:`pickup-${order.id}`,
          level:endDiff<0 ? "danger" : "warning",
          label:endDiff<0 ? "アウト時刻超過・お迎え未設定" : "お迎えドライバー未設定",
          detail:endDiff<0 ? `${Math.abs(Math.floor(endDiff))}分超過` : (endDiff===0 ? "アウト予定時刻です" : `アウトまであと${Math.ceil(endDiff)}分`),
          order,
          time:order.scheduledEnd
        });
      }
    }

    return alerts.sort((a,b)=>{
      if(a.level!==b.level) return a.level==="danger" ? -1 : 1;
      return businessMinutes(a.time,storeSettings.openTime)-businessMinutes(b.time,storeSettings.openTime);
    });
  },[orders,now,storeSettings.openTime]);
  const boardStartMinute=clockMinutes(storeSettings.openTime);
  const rawBoardCloseMinute=clockMinutes(storeSettings.closeTime);
  const boardEndMinute=rawBoardCloseMinute<=boardStartMinute ? rawBoardCloseMinute+24*60 : rawBoardCloseMinute;
  const boardMinutes=Math.max(60,boardEndMinute-boardStartMinute);
  const boardHourCount=Math.max(1,Math.ceil(boardMinutes/60));
  const hourLabels=Array.from({length:boardHourCount},(_,index)=>{
    const total=(boardStartMinute+index*60)%(24*60);
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;
  });
  const timelineMajorPercent=100/boardHourCount;
  const timelineMinorPercent=timelineMajorPercent/4;
  const timelineMinWidth=Math.max(1100,Math.round(boardHourCount*108));
  const timelineGridStyle={backgroundSize:`${timelineMajorPercent}% 100%,${timelineMinorPercent}% 100%`};
  const freeHoldBoardLayout=useMemo(()=>{
    const rows=selectedDateFreeHolds.map(item=>{
      const start=boardRelativeMinutes(item.scheduledStart,boardStartMinute);
      const end=start+Math.max(1,item.courseMinutes+(item.extensionMinutes??0));
      return {item,start,end,lane:0,overlapCount:1};
    }).sort((a,b)=>a.start-b.start || a.end-b.end || a.item.createdAt.localeCompare(b.item.createdAt));

    const laneEnds:number[]=[];
    for(const row of rows){
      let lane=laneEnds.findIndex(end=>end<=row.start);
      if(lane<0){
        lane=laneEnds.length;
        laneEnds.push(row.end);
      }else{
        laneEnds[lane]=row.end;
      }
      row.lane=lane;
    }
    for(const row of rows){
      row.overlapCount=rows.filter(other=>row.start<other.end && row.end>other.start).length;
    }
    return {rows,laneCount:Math.max(1,laneEnds.length)};
  },[selectedDateFreeHolds,boardStartMinute]);
  const freeHoldRowHeight=Math.max(72,14+freeHoldBoardLayout.laneCount*54);
  const nowPosition = now && date===todayValue ? currentTimePosition(now,boardStartMinute,boardMinutes) : null;
  const detailCast = detailCastId ? castList.find(c=>c.id===detailCastId) : undefined;
  const detailShift = detailCast ? castShiftForDate(detailCast,date) : undefined;
  const shiftEditCast = shiftEditCastId ? castList.find(c=>c.id===shiftEditCastId) : undefined;
  const selectedOrder = selectedOrderId ? orders.find(order=>order.id===selectedOrderId) : undefined;
  const selectedOrderSendDriver = selectedOrder
    ? driverList.find(driver=>driver.id===selectedOrder.driverId) ?? driverList.find(driver=>driver.name===selectedOrder.driverName)
    : undefined;
  const selectedOrderPickupDriver = selectedOrder
    ? driverList.find(driver=>driver.id===selectedOrder.pickupDriverId) ?? driverList.find(driver=>driver.name===selectedOrder.pickupDriverName)
    : undefined;

  const selectedOrderCast=selectedOrder ? castList.find(cast=>cast.id===selectedOrder.castId) : undefined;
  const extensionAddMinutes=pricing.extensionMinutes*extensionCount;
  const extensionAvailability=selectedOrder&&selectedOrderCast
    ? checkCastAvailability({
        cast:selectedOrderCast,
        date:orderServiceDate(selectedOrder),
        start:selectedOrder.scheduledStart,
        minutes:selectedOrder.courseMinutes+(selectedOrder.extensionMinutes??0)+extensionAddMinutes,
        orders,
        settings:storeSettings,
        ignoreOrderId:selectedOrder.id
      })
    : null;
  const extensionSoftTimeWarning=Boolean(
    extensionAvailability &&
    !extensionAvailability.ok &&
    extensionAvailability.conflicts.length===0 &&
    (extensionAvailability.message==="キャストの上がり時間を超えます" ||
      extensionAvailability.message==="キャストの受付終了後です")
  );
  const extensionHardWarning=extensionAvailability&&!extensionAvailability.ok&&!extensionSoftTimeWarning
    ? (extensionAvailability.conflicts.length
        ? "次の予約と重複するため、この延長は確定できません。"
        : extensionAvailability.message)
    : "";

  useEffect(()=>{
    if(date!==todayValue){
      lastBoardAutoScrollDateRef.current=null;
      return;
    }
    if(!now || lastBoardAutoScrollDateRef.current===date) return;

    const frame=window.requestAnimationFrame(()=>{
      const scroll=boardScrollRef.current;
      const timeline=scroll?.querySelector<HTMLElement>(".timelineHeader");
      if(!scroll || !timeline) return;

      let minutes=now.getHours()*60+now.getMinutes();
      while(minutes<boardStartMinute) minutes+=24*60;
      const elapsed=Math.max(0,Math.min(boardMinutes,minutes-boardStartMinute));
      const ratio=elapsed/boardMinutes;
      const contextRatio=30/boardMinutes;
      const target=Math.max(0,timeline.offsetWidth*Math.max(0,ratio-contextRatio));

      scroll.scrollTo({left:target,behavior:"auto"});
      lastBoardAutoScrollDateRef.current=date;
    });

    return ()=>window.cancelAnimationFrame(frame);
  },[date,now,todayValue,boardStartMinute,boardMinutes]);

  useEffect(()=>{
    if(!now || date!==todayValue){
      setGlobalNowLineLeft(null);
      return;
    }

    const update=()=>{
      const board=boardGridRef.current;
      const timeline=board?.querySelector<HTMLElement>(".timelineHeader");
      if(!board || !timeline) return;

      let minutes=now.getHours()*60+now.getMinutes();
      while(minutes<boardStartMinute) minutes+=24*60;
      const elapsed=Math.max(0,Math.min(boardMinutes,minutes-boardStartMinute));
      const ratio=elapsed/boardMinutes;
      setGlobalNowLineLeft(timeline.offsetLeft+(timeline.offsetWidth*ratio));
    };

    const frame=window.requestAnimationFrame(update);
    window.addEventListener("resize",update);
    return ()=>{
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize",update);
    };
  },[date,now,todayValue,workingCasts.length,boardStartMinute,boardMinutes]);

  useEffect(()=>{
    if(!pendingEditOrderId || !orders.length) return;
    const target=orders.find(order=>order.id===pendingEditOrderId);
    if(!target){
      setPendingEditOrderId(null);
      window.history.replaceState(null,"","/");
      return;
    }
    loadOrderIntoEditForm(target);
    setPendingEditOrderId(null);
    window.history.replaceState(null,"","/");
  },[pendingEditOrderId,orders]);

  useEffect(()=>{
    if(!pendingActionOrderId || !orders.length) return;
    const target=orders.find(order=>order.id===pendingActionOrderId);
    if(!target){
      setPendingActionOrderId(null);
      window.history.replaceState(null,"","/");
      return;
    }
    setDate(orderServiceDate(target));
    openOrderMenu(target);
    setPendingActionOrderId(null);
    window.history.replaceState(null,"","/");
  },[pendingActionOrderId,orders]);

  function replaceCastShift(cast:Cast, changes:Partial<NonNullable<Cast["schedule"]>[number]>){
    const existing=castShiftForDate(cast,date);
    const nextShift={
      date,
      start:existing?.start ?? cast.shiftStart ?? "18:00",
      endType:existing?.endType ?? "leave",
      endTime:existing?.endTime ?? cast.shiftEnd ?? "04:00",
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
      endType:shift?.endType ?? "leave",
      endTime:shift?.endTime ?? cast.shiftEnd ?? "04:00"
    });
    setShiftEditCastId(cast.id);
  }

  function saveQuickShift(){
    if(!shiftEditCast) return;
    replaceCastShift(shiftEditCast,{start:shiftDraft.start,endType:shiftDraft.endType,endTime:shiftDraft.endTime,working:true});
    setShiftEditCastId(null);
  }

  function openOrderMenu(order:Order){
    setSelectedOrderId(order.id);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function closeOrderMenu(){
    setSelectedOrderId(null);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function changeOrderDriver(kind:"send"|"pickup",nextDriverId:string){
    if(!selectedOrder) return;
    const driver=driverList.find(item=>item.id===nextDriverId);
    const changes=kind==="send"
      ? {driverId:driver?.id,driverName:driver?.name}
      : {pickupDriverId:driver?.id,pickupDriverName:driver?.name};
    setOrders(updateOrder(selectedOrder.id,changes));
    setCopyNotice(driver
      ? `${kind==="send"?"送り":"お迎え"}ドライバーを ${driver.name} に設定しました`
      : `${kind==="send"?"送り":"お迎え"}ドライバーの設定を解除しました`
    );
  }

  function sendOrderDriverMail(kind:"send"|"pickup"){
    if(!selectedOrder) return;
    const driver=kind==="send" ? selectedOrderSendDriver : selectedOrderPickupDriver;
    if(!driver?.email) return;

    const serviceDate=orderServiceDate(selectedOrder);
    const time=kind==="send" ? selectedOrder.scheduledStart : selectedOrder.scheduledEnd;
    const label=kind==="send" ? "送り" : "お迎え";
    const roomText=selectedOrder.room ? ` / ${selectedOrder.room}号室` : "";
    const subject=`【NIGHT DESK】${label}依頼 ${serviceDate} ${time} ${selectedOrder.castName}`;
    const body=[
      `ドライバー：${driver.name}`,
      `依頼：${label}`,
      `日付：${serviceDate}`,
      `${label}時間：${time}`,
      `キャスト：${selectedOrder.castName}`,
      `ホテル・場所：${selectedOrder.locationName||"未入力"}${roomText}`,
      selectedOrder.address ? `住所：${selectedOrder.address}` : "",
      `コース：${selectedOrder.courseMinutes+(selectedOrder.extensionMinutes??0)}分`,
      selectedOrder.note ? `備考：${selectedOrder.note}` : ""
    ].filter(Boolean).join("\n");

    window.location.href=`mailto:${encodeURIComponent(driver.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setCopyNotice(`${driver.name} のメールアドレスで ${label}メールを作成しました`);
  }

  function currentClockTime(){
    const value=new Date();
    return `${String(value.getHours()).padStart(2,"0")}:${String(value.getMinutes()).padStart(2,"0")}`;
  }

  function markOrderDispatched(){
    if(!selectedOrder) return;
    if(selectedOrder.inTime || selectedOrder.status==="serving" || selectedOrder.status==="completed" || selectedOrder.status==="cancelled") return;
    setOrders(updateOrder(selectedOrder.id,{status:"dispatching"}));
    setCopyNotice("配車済みに変更しました");
  }

  function beginInTimeEntry(){
    if(!selectedOrder) return;
    setInTimeDraft(selectedOrder.inTime ?? currentClockTime());
    setCopyNotice("");
    setOrderMode("inTime");
  }

  function recordInTime(){
    if(!selectedOrder || !inTimeDraft) return;
    const duration=selectedOrder.courseMinutes+(selectedOrder.extensionMinutes??0);
    const scheduledEnd=addMinutes(inTimeDraft,duration);
    setOrders(updateOrder(selectedOrder.id,{
      inTime:inTimeDraft,
      status:"serving",
      scheduledStart:inTimeDraft,
      scheduledEnd
    }));
    setCopyNotice(`イン時間 ${inTimeDraft} に合わせてオーダーを移動しました`);
    setOrderMode("menu");
  }

  async function copyOrderForLine(kind:"send"|"pickup"){
    if(!selectedOrder) return;
    const roomText=selectedOrder.room ? ` / ${selectedOrder.room}号室` : "";
    const nomination=selectedOrder.nominationType==="photo"
      ? "写指"
      : selectedOrder.nominationType==="repeat" ? "本指" : "フリー";
    const options=(selectedOrder.selectedOptions??[]).filter(Boolean).join(" / ");
    const payment=selectedOrder.paymentMethod==="card" ? "カード" : "現金";
    const isSend=kind==="send";
    const driverName=isSend
      ? (selectedOrder.driverName ? `${selectedOrder.driverName}さん` : "未設定")
      : (selectedOrder.pickupDriverName ? `${selectedOrder.pickupDriverName}さん` : "未設定");

    const lines:Array<string|null>=isSend
      ? [
          "【送りオーダー】",
          `送り　${driverName}`,
          "",
          "【詳細】",
          `日付：${orderServiceDate(selectedOrder)}`,
          `時間：${selectedOrder.scheduledStart}〜${selectedOrder.scheduledEnd}`,
          `キャスト：${selectedOrder.castName}`,
          `コース：${selectedOrder.courseMinutes+(selectedOrder.extensionMinutes??0)}分（${nomination}）`,
          `場所：${selectedOrder.locationName||"未入力"}${roomText}`,
          selectedOrder.address ? `住所：${selectedOrder.address}` : null,
          options ? `OP：${options}` : null,
          `料金：${formatYen(selectedOrder.total)}（${payment}）`,
          selectedOrder.note ? `備考：${selectedOrder.note}` : null,
          selectedOrder.customerPhone ? "" : null,
          selectedOrder.customerPhone ? `電話番号：${selectedOrder.customerPhone}` : null
        ]
      : [
          "【お迎えオーダー】",
          `お迎え　${driverName}`,
          "",
          "【詳細】",
          `日付：${orderServiceDate(selectedOrder)}`,
          `イン時間：${selectedOrder.inTime??"未入力"}`,
          `アウト時間：${selectedOrder.scheduledEnd}`,
          `キャスト：${selectedOrder.castName}`,
          `場所：${selectedOrder.locationName||"未入力"}${roomText}`,
          selectedOrder.address ? `住所：${selectedOrder.address}` : null,
          `コース：${selectedOrder.courseMinutes+(selectedOrder.extensionMinutes??0)}分（${nomination}）`,
          selectedOrder.note ? `備考：${selectedOrder.note}` : null,
          selectedOrder.customerPhone ? "" : null,
          selectedOrder.customerPhone ? `電話番号：${selectedOrder.customerPhone}` : null
        ];
    const text=lines.filter((line):line is string=>line!==null).join("\n");
    try{
      await navigator.clipboard.writeText(text);
      setCopyNotice(isSend ? "送りオーダーをコピーしました" : "お迎えオーダーをコピーしました");
    }catch{
      setCopyNotice("コピーできませんでした");
    }
  }

  function loadOrderIntoEditForm(order:Order){
    const driver=driverList.find(driver=>driver.id===order.driverId || driver.name===order.driverName);
    const courseMatch=resolveOrderCourse(order,pricing);
    const optionIds=optionList
      .filter(option=>(order.selectedOptions??[]).includes(option.name))
      .map(option=>option.id);

    setEditingOrderId(order.id);
    setDate(orderServiceDate(order));
    setCastId(order.castId);
    setDriverId(order.driverId ?? driver?.id ?? "");
    if(courseMatch) setCourseId(courseMatch.id);
    setNominationType(order.nominationType);
    setScheduledStart(order.scheduledStart);
    setLocationName(order.locationName);
    setRoom(order.room ?? "");
    setAddress(order.address ?? "");
    setPhone(order.customerPhone ?? "");
    setCustomerPanelOpen(Boolean(order.customerPhone));
    setNote(order.note ?? "");
    setTravelFee(order.travelFee);
    setDiscount(order.discount);
    setSurcharge(order.surcharge??0);
    setPaymentMethod(order.paymentMethod??"cash");
    setSelectedOptionIds(optionIds);
    const savedExtensionMinutes=resolveOrderExtensionMinutes(order,pricing);
    setFormExtensionCount(
      pricing.extensionMinutes>0
        ? Math.max(0,Math.round(savedExtensionMinutes/pricing.extensionMinutes))
        : 0
    );
    setCustomerNotice("");

    window.setTimeout(()=>{
      document.getElementById("work-register")?.scrollIntoView({behavior:"smooth",block:"start"});
    },60);
  }

  function beginOrderEdit(){
    if(!selectedOrder) return;
    loadOrderIntoEditForm(selectedOrder);
    closeOrderMenu();
  }

  function resetOrderForm(){
    setEditingOrderId(null);
    setActiveFreeHoldId(null);
    setCastId("");
    setDriverId("");
    setCourseId(pricing.courses[0]?.id ?? "");
    setNominationType("free");
    setScheduledStart(clockTimeValue());
    const firstHotel=availableHotels[0];
    setLocationName(firstHotel?.name ?? "");
    setTravelFee(firstHotel?.travelFee ?? pricing.defaultTravelFee);
    setAddress(firstHotel?.address ?? "");
    setRoom(firstHotel?.kind==="home" ? "" : "101");
    setPhone("");
    setCustomerPanelOpen(false);
    setNote("サンプル備考");
    setSelectedOptionIds([]);
    setOptionModalOpen(false);
    setDiscount(0);
    setSurcharge(0);
    setPaymentMethod("cash");
    setFormExtensionCount(0);
    setCustomerNotice("");
  }

  function saveCurrentAsFreeHold(){
    if(!course){
      window.alert("料金コースを選択してください");
      return;
    }
    const item:FreeReservationHold={
      id:crypto.randomUUID(),
      createdAt:new Date().toISOString(),
      serviceDate:date,
      scheduledStart,
      courseId:course.id,
      courseMinutes:course.minutes,
      extensionMinutes:formExtensionMinutes,
      customerPhone:phone.trim(),
      locationType:selectedHotel?.kind==="home" ? "home" : "hotel",
      locationName,
      room,
      address,
      selectedOptionIds:[...selectedOptionIds],
      travelFee,
      discount,
      surcharge,
      paymentMethod,
      note
    };
    const next=addFreeReservationHold(item);
    setFreeReservationHolds(next);
    resetOrderForm();
    setCopyNotice(`${item.scheduledStart} のフリー予約を保管しました`);
  }

  function loadFreeHoldIntoOrderForm(item:FreeReservationHold){
    setEditingOrderId(null);
    setActiveFreeHoldId(item.id);
    setCastId("");
    setDate(item.serviceDate);
    setDriverId("");
    const savedCourse=pricing.courses.find(course=>course.id===item.courseId)
      ?? pricing.courses.find(course=>course.minutes===item.courseMinutes);
    if(savedCourse) setCourseId(savedCourse.id);
    setNominationType("free");
    setScheduledStart(item.scheduledStart);
    setLocationName(item.locationName);
    setRoom(item.room??"");
    setAddress(item.address??"");
    setPhone(item.customerPhone??"");
    setCustomerPanelOpen(Boolean(item.customerPhone));
    setNote(item.note??"");
    setTravelFee(item.travelFee??pricing.defaultTravelFee);
    setDiscount(item.discount??0);
    setSurcharge(item.surcharge??0);
    setPaymentMethod(item.paymentMethod??"cash");
    setSelectedOptionIds((item.selectedOptionIds??[]).filter(id=>optionList.some(option=>option.id===id)));
    setFormExtensionCount(
      pricing.extensionMinutes>0
        ? Math.max(0,Math.round((item.extensionMinutes??0)/pricing.extensionMinutes))
        : 0
    );
    setCustomerNotice("");
    window.setTimeout(()=>{
      document.getElementById("work-register")?.scrollIntoView({behavior:"smooth",block:"start"});
    },60);
  }

  function removeFreeHold(id:string){
    if(!window.confirm("このフリー予約を削除しますか？")) return;
    setFreeReservationHolds(deleteFreeReservationHold(id));
    if(activeFreeHoldId===id) setActiveFreeHoldId(null);
  }

  function registerSelectedCastAsCustomerNg(){
    if(!editingOrderId || !selectedCast || !phoneKey) return;
    const current=loadCustomers();
    const index=current.findIndex(customer=>normalizePhone(customer.phone)===phoneKey);
    const label=`NGキャスト：${selectedCast.name}`;
    let next:Customer[];
    if(index>=0){
      const target=current[index];
      const existing=(target.ngInfo??"").trim();
      if(existing.toLowerCase().includes(selectedCast.name.toLowerCase())){
        setCustomerNotice(`${selectedCast.name} はすでにNG登録されています`);
        return;
      }
      const updated={...target,ngInfo:existing ? `${existing}\n${label}` : label};
      next=current.map((customer,i)=>i===index?updated:customer);
    }else{
      next=[...current,{id:crypto.randomUUID(),phone,name:"",notes:"",ngInfo:label,active:true}];
    }
    saveCustomers(next);
    setCustomerList(next);
    setCustomerNotice(`${selectedCast.name} をNGキャストに登録しました`);
  }

  function beginChange(){
    if(!selectedOrder) return;
    const candidates=selectableCasts.filter(cast=>cast.id!==selectedOrder.castId);
    setChangeCastId(candidates[0]?.id ?? "");
    setCopyNotice("");
    setOrderMode("change");
  }

  async function applyChange(){
    if(!selectedOrder || !changeCastId) return;
    const nextCast=castList.find(cast=>cast.id===changeCastId);
    if(!nextCast || nextCast.id===selectedOrder.castId) return;

    const fee=storeSettings.changeFee??0;
    const currentCardFee=selectedOrder.cardFee??0;
    const currentBase=Math.max(0,selectedOrder.total-currentCardFee);
    const nextBase=currentBase+fee;
    const nextCardFee=selectedOrder.paymentMethod==="card"
      ? roundUpToUnit(nextBase*((storeSettings.cardFeeRate??0)/100),storeSettings.priceUnit??100)
      : currentCardFee;
    const changedAt=new Date().toISOString();

    const updates={
      castId:nextCast.id,
      castName:nextCast.name,
      changeFee:(selectedOrder.changeFee??0)+fee,
      changeCount:(selectedOrder.changeCount??0)+1,
      changeHistory:[
        ...(selectedOrder.changeHistory??[]),
        {
          fromCastId:selectedOrder.castId,
          fromCastName:selectedOrder.castName,
          toCastId:nextCast.id,
          toCastName:nextCast.name,
          fee,
          changedAt
        }
      ],
      cardFee:nextCardFee,
      total:nextBase+nextCardFee
    };
    try{
      setOrders(await confirmReservation({...selectedOrder,...updates},selectedOrder.id));
      setCopyNotice(`${selectedOrder.castName} → ${nextCast.name} にチェンジ / ＋${formatYen(fee)}`);
      setOrderMode("menu");
    }catch(err){
      window.alert("チェンジを確定できませんでした："+(err instanceof Error?err.message:"予約時間を確認してください"));
    }
  }

  function beginCancel(){
    if(!selectedOrder) return;
    setCopyNotice("");
    setOrderMode("cancel");
  }

  function applyCancel(){
    if(!selectedOrder) return;
    const fee=storeSettings.cancelFee??0;
    setOrders(updateOrder(selectedOrder.id,{
      status:"cancelled",
      cancelFee:fee,
      cancelledAt:new Date().toISOString()
    }));
    setSelectedOrderId(null);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function deleteSelectedOrder(){
    if(!selectedOrder) return;
    if(!window.confirm("このオーダーを完全に削除しますか？")) return;
    setOrders(deleteOrder(selectedOrder.id));
    setSelectedOrderId(null);
    setOrderMode("menu");
    setCopyNotice("");
  }

  function beginExtension(){
    setExtensionCount(1);
    setOrderMode("extend");
  }

  async function applyExtension(){
    if(!selectedOrder) return;
    if(extensionHardWarning){
      window.alert("⚠ 延長できません\n"+extensionHardWarning);
      return;
    }
    if(extensionSoftTimeWarning){
      const confirmed=window.confirm(
        "⚠ キャストの受付時間を超えています。\n本人確認のうえ延長しますか？"
      );
      if(!confirmed) return;
    }
    const add=pricing.extensionMinutes*extensionCount;
    const addPrice=pricing.extensionPrice*extensionCount;
    const baseCourse=resolveOrderCourse(selectedOrder,pricing);
    const currentExtensionMinutes=resolveOrderExtensionMinutes(selectedOrder,pricing);
    const currentExtensionTotal=resolveOrderExtensionTotal(selectedOrder,pricing);
    const currentCardFee=selectedOrder.cardFee??0;
    const currentBase=Math.max(0,selectedOrder.total-currentCardFee);
    const nextBase=currentBase+addPrice;
    const nextCardFee=selectedOrder.paymentMethod==="card"
      ? roundUpToUnit(nextBase*((storeSettings.cardFeeRate??0)/100),storeSettings.priceUnit??100)
      : currentCardFee;
    try{
      setOrders(await confirmReservation({...selectedOrder,
        courseId:baseCourse?.id ?? selectedOrder.courseId,
        courseMinutes:baseCourse?.minutes ?? selectedOrder.courseMinutes,
        extensionMinutes:currentExtensionMinutes+add,
        extensionTotal:currentExtensionTotal+addPrice,
        scheduledEnd:addMinutes(selectedOrder.scheduledEnd,add),
        cardFee:nextCardFee,
        total:nextBase+nextCardFee
      },selectedOrder.id,{allowCastTimeOverride:extensionSoftTimeWarning}));
      setOrderMode("menu");
      setCopyNotice(`${add}分延長 / ＋${formatYen(addPrice)}`);
    }catch(err){
      window.alert("延長できませんでした："+(err instanceof Error?err.message:"次の予約時間を確認してください"));
    }
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
    if(hotel){
      setTravelFee(hotel.travelFee);
      setAddress(hotel.address??"");
      if(hotel.kind==="home") setRoom("");
    }
  }

  function saveSharedMemoNow(){
    saveSharedMemo(sharedMemo);
    setSharedMemoSaved(true);
    window.setTimeout(()=>setSharedMemoSaved(false),1200);
  }

  function openDriverMail(){
    if(!selectedDriver?.email) return;

    const selectedNames=selectableOptions
      .filter(option=>selectedOptionIds.includes(option.id))
      .map(option=>option.name)
      .join(" / ");
    const subject=`【NIGHT DESK】送迎依頼 ${date} ${scheduledStart} ${selectedCast?.name??""}`;
    const body=[
      `ドライバー：${selectedDriver.name}`,
      `日付：${date}`,
      `開始予定：${scheduledStart}`,
      `キャスト：${selectedCast?.name??"未選択"}`,
      `場所：${locationName||"未入力"}${room ? ` / ${room}号室` : ""}`,
      address ? `住所：${address}` : "",
      course ? `コース：${course.minutes+formExtensionMinutes}分` : "",
      `指名：${nominationType==="photo"?"写真指名":nominationType==="repeat"?"本指名":"フリー"}`,
      selectedNames ? `オプション：${selectedNames}` : "",
      note ? `備考：${note}` : ""
    ].filter(Boolean).join("\n");

    window.location.href=`mailto:${encodeURIComponent(selectedDriver.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function toggleOrderOption(id:string){
    setSelectedOptionIds(current=>current.includes(id)
      ? current.filter(optionId=>optionId!==id)
      : [...current,id]
    );
  }

  function dispatchWidget(id:DispatchWidgetId){
    return dispatchWidgets.find(item=>item.id===id) ?? defaultDispatchWidgets.find(item=>item.id===id)!;
  }
  function widgetVisible(id:DispatchWidgetId){
    return dispatchWidget(id).visible;
  }
  function widgetAreaClass(id:DispatchWidgetId){
    return `widgetArea-${dispatchWidget(id).area}`;
  }
  function widgetOrder(id:DispatchWidgetId){
    const item=dispatchWidget(id);
    return (item.area==="bottom" ? 100 : 0) + item.order;
  }
  function widgetTarget(id:DispatchWidgetId){
    const area=dispatchWidget(id).area;
    if(area==="left") return widgetLeftRef.current;
    if(area==="center") return widgetCenterRef.current;
    if(area==="right") return widgetRightRef.current;
    return widgetBottomRef.current;
  }
  function widgetPortal(id:DispatchWidgetId,node:ReactNode){
    if(!widgetTargetsReady || !widgetVisible(id)) return null;
    const target=widgetTarget(id);
    return target ? createPortal(node,target) : null;
  }

  async function registerOrder(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selectedCast || !course) return;
    const availabilityNow=checkCastAvailability({
      cast:selectedCast,date,start:scheduledStart,minutes:course.minutes+formExtensionMinutes,
      orders:loadOrders(),settings:storeSettings,ignoreOrderId:editingOrderId??undefined
    });
    let allowOverlapOverride=false;
    let allowCastTimeOverride=false;
    if(!availabilityNow.ok){
      const castTimeOver=
        availabilityNow.conflicts.length===0 &&
        (availabilityNow.message==="キャストの上がり時間を超えます" ||
          availabilityNow.message==="キャストの受付終了後です");
      const hasOverlap=
        availabilityNow.conflicts.length>0 &&
        availabilityNow.message.includes("重複");

      if(castTimeOver){
        const warning=availabilityNow.message==="キャストの受付終了後です"
          ? "⚠ キャストの受付終了時間を過ぎています。\nキャスト本人に確認できていますか？\nこのまま予約を登録しますか？"
          : "⚠ キャストの上がり時間を超えています。\nキャスト本人に確認できていますか？\nこのまま予約を登録しますか？";
        if(!window.confirm(warning)) return;
        allowCastTimeOverride=true;
      }else if(hasOverlap){
        const onlyServing=availabilityNow.conflicts.every(order=>order.status==="serving");
        const warning=onlyServing
          ? "⚠ まだ接客中のオーダーがあります。\nこのまま次の予約を登録しますか？"
          : "⚠ 同じキャストの別予約と時間が重複しています。\n既存予約を確認しましたか？\n本当にこのまま登録しますか？";
        if(!window.confirm(warning)) return;
        allowOverlapOverride=true;
      }else{
        window.alert("予約できません：" + availabilityNow.message);
        return;
      }
    }
    if(matchedCustomer?.active===false){
      window.alert("利用不可として登録されているお客様です。顧客情報を確認してください。");
      return;
    }
    if(matchedCustomer?.ngInfo && !window.confirm("NG情報が登録されています。確認して続けますか？\\n"+matchedCustomer.ngInfo))return;

    const selectedOptionNames=selectableOptions
      .filter(option=>selectedOptionIds.includes(option.id))
      .map(option=>option.name);
    const effectiveExtensionMinutes=formExtensionMinutes;
    const effectiveExtensionTotal=formExtensionTotal;
    const commonChanges = {
      customerPhone:phone,
      locationType:(selectedHotel?.kind==="home" ? "home" : "hotel") as "hotel"|"home",
      locationName,
      room,
      address,
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
      surcharge,
      paymentMethod,
      cardFee,
      total,
      serviceDate:date,
      scheduledStart,
      scheduledEnd:addMinutes(scheduledStart,course.minutes+effectiveExtensionMinutes),
      note
    };

    const order:Order=editingOrder
      ? {...editingOrder,...commonChanges}
      : {
          id:crypto.randomUUID(),
          createdAt:new Date().toISOString(),
          ...commonChanges,
          adjustment:0,
          status:"accepted"
        };
    try{
      const confirmed=await confirmReservation(
        order,
        editingOrderId??undefined,
        (allowOverlapOverride || allowCastTimeOverride)
          ? {allowOverlapOverride,allowCastTimeOverride}
          : undefined
      );
      setOrders(confirmed);
      if(activeFreeHoldId){
        setFreeReservationHolds(deleteFreeReservationHold(activeFreeHoldId));
      }
      resetOrderForm();
    }catch(err){
      window.alert("予約を確定できませんでした："+(err instanceof Error?err.message:"同期エラー"));
    }
  }

  return <div className="deskDashboard">
    {operationAlerts.length>0 && <section className="operationAlerts" aria-live="polite">
      <div className="operationAlertsHeader">
        <div>
          <span className="operationAlertsEyebrow">AUTO ALERT</span>
          <strong>要対応 {operationAlerts.length}件</strong>
        </div>
        <span className="operationAlertsHint">対応すると自動で消えます</span>
      </div>
      <div className="operationAlertsList">
        {operationAlerts.map(alert=><button
          type="button"
          key={alert.key}
          className={`operationAlertItem ${alert.level==="danger"?"isDanger":"isWarning"}`}
          onClick={()=>{
            setDate(orderServiceDate(alert.order));
            openOrderMenu(alert.order);
          }}
        >
          <span className="operationAlertIcon" aria-hidden="true">{alert.level==="danger"?"!":"⚠"}</span>
          <span className="operationAlertBody">
            <strong>{alert.label}</strong>
            <small>{alert.order.castName} / {alert.time} / {alert.detail}</small>
          </span>
          <span className="operationAlertOpen">確認 ›</span>
        </button>)}
      </div>
    </section>}

    <div className="dispatchWidgetCanvas">
      <div className="dispatchWidgetTopSlots">
        <div className="dispatchWidgetSlot dispatchWidgetSlotLeft" ref={widgetLeftRef}/>
        <div className="dispatchWidgetSlot dispatchWidgetSlotCenter" ref={widgetCenterRef}/>
        <div className="dispatchWidgetSlot dispatchWidgetSlotRight" ref={widgetRightRef}/>
      </div>
      <div className="dispatchWidgetSlot dispatchWidgetSlotBottom" ref={widgetBottomRef}/>
    </div>

    <div className="dispatchWidgetPortalSources">
    <div className="deskColumns dispatchWidgetGrid">
      <aside className="deskLeft">
        {widgetPortal("date", <section className={`deskPanel dispatchWidget ${widgetAreaClass("date")}`} style={{order:widgetOrder("date")}}>
          <h2>日付</h2>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <div className="dateButtons">
            <button onClick={()=>shiftDate(-1)}>前日</button>
            <button onClick={()=>setDate(dateInputValue(new Date()))}>今日</button>
            <button onClick={()=>shiftDate(1)}>翌日</button>
          </div>
        </section>)}

        {widgetPortal("sharedMemo", <section className={`deskPanel sharedMemoPanel dispatchWidget ${widgetAreaClass("sharedMemo")}`} style={{order:widgetOrder("sharedMemo")}}>
          <div className="sharedMemoHead">
            <h2>共有メモ</h2>
            {sharedMemoSaved && <span>保存済み</span>}
          </div>
          <textarea
            rows={9}
            value={sharedMemo}
            onChange={e=>setSharedMemo(e.target.value)}
            onBlur={saveSharedMemoNow}
            placeholder="送迎状況、注意事項、次のスタッフへの引継ぎなどを共有"
          />
          <button type="button" onClick={saveSharedMemoNow}>共有メモを保存</button>
        </section>)}
      </aside>

      <main className="deskCenter">
        {widgetPortal("orderRegister", <section className={`deskPanel workRegister dispatchWidget ${widgetAreaClass("orderRegister")} ${editingOrderId?"isEditingOrder":""}`} style={{order:widgetOrder("orderRegister")}} id="work-register">
          <div className="workRegisterTitleRow">
            <h2>{editingOrderId?"仕事編集":"仕事登録"}</h2>
            {editingOrderId && <span className="workEditBadge">既存オーダー編集中</span>}
            {!editingOrderId && activeFreeHoldId && <span className="workEditBadge freeHoldBadge">フリー予約から作成中</span>}
          </div>
          <form onSubmit={registerOrder}>
            <div className="customerLookupTop">
              <label className="customerPhoneField">お客様電話番号
                <div className="customerPhoneInputWrap">
                  <input
                    value={phone}
                    inputMode="tel"
                    enterKeyHint="search"
                    onChange={e=>{
                      const next=e.target.value;
                      setPhone(next);
                      setCustomerPanelOpen(normalizePhone(next).length>=4);
                    }}
                    onKeyDown={e=>{
                      if(e.key==="Enter"){
                        e.preventDefault();
                      }
                    }}
                    placeholder="090-0000-0000"
                  />
                  {phoneKey.length>=4 && <span className={matchedCustomer?"customerFoundBadge":"customerNewBadge"}>
                    {matchedCustomer ? "登録顧客" : customerHistory.length ? "履歴あり" : "新規"}
                  </span>}
                </div>
              </label>

              {phoneKey.length>=4 && <section className={`customerLookupPanel ${matchedCustomer?.ngInfo || matchedCustomer?.active===false ? "hasWarning" : ""} ${customerPanelOpen?"isOpen":"isClosed"}`}>
                <div className="customerLookupHead">
                  <div>
                    <span>顧客情報</span>
                    <strong>{matchedCustomer?.name || "名前未登録"}</strong>
                    {(matchedCustomer?.active===false || matchedCustomer?.ngInfo) && <em className="customerLookupNgBadge">NGあり</em>}
                  </div>
                  <div className="customerLookupHeadActions">
                    <div className="customerLookupStats">
                      <span>利用 <strong>{customerHistory.length}回</strong></span>
                      <span>最終 <strong>{customerHistory[0] ? orderServiceDate(customerHistory[0]) : "—"}</strong></span>
                    </div>
                    <button type="button" className="customerPanelToggle" onClick={()=>setCustomerPanelOpen(value=>!value)}>
                      {customerPanelOpen?"閉じる":"開く"}
                    </button>
                  </div>
                </div>

                {editingOrderId && selectedCast && <div className="customerNgActionRow">
                  <div className="customerNgActionText">
                    <strong>このキャストをNG登録</strong>
                    <span>このお客様を「{selectedCast.name}」のNGとして登録します</span>
                  </div>
                  <button type="button" className="customerNgRegisterButton customerNgRegisterButtonLarge" onClick={registerSelectedCastAsCustomerNg}>
                    {selectedCast.name}をNG登録
                  </button>
                </div>}

                {customerPanelOpen && <div className="customerLookupExpanded">
                  {customerNotice && <div className="customerLookupNotice">{customerNotice}</div>}

                  {(matchedCustomer?.active===false || matchedCustomer?.ngInfo) && <div className="customerNgWarning">
                    <strong>⚠ NG警告</strong>
                    <p>{matchedCustomer?.active===false ? "利用不可設定の顧客です。" : ""}{matchedCustomer?.active===false && matchedCustomer?.ngInfo ? " / " : ""}{matchedCustomer?.ngInfo || ""}</p>
                  </div>}

                  <div className="customerLookupNotes">
                    <span>顧客備考</span>
                    <p>{matchedCustomer?.notes || "登録された備考はありません"}</p>
                  </div>

                  <div className="customerHistoryBox">
                    <div className="customerHistoryTitle">
                      <span>利用履歴</span>
                      <strong>{customerHistory.length}件</strong>
                    </div>
                    {customerHistory.length>0
                      ? <div className="customerHistoryList">
                          {customerHistory.slice(0,5).map(history=>{
                          const isWorkingToday=workingCastIdsToday.has(history.castId);
                          const isNgCast=historyCastIsNg(history);
                          return <div
                            key={history.id}
                            className={`customerHistoryItem ${isNgCast?"isNgCast":isWorkingToday?"isWorkingCast":""}`}
                          >
                            <div>
                              <strong>{orderServiceDate(history)} {history.scheduledStart}</strong>
                              <span>{history.castName} / {history.courseMinutes+(history.extensionMinutes??0)}分</span>
                              {isNgCast
                                ? <em className="historyCastFlag ng">NGキャスト</em>
                                : isWorkingToday
                                  ? <em className="historyCastFlag working">本日出勤</em>
                                  : null}
                            </div>
                            <div>
                              <span>{history.locationName || "場所未入力"}</span>
                              <strong>{formatYen(history.total)}</strong>
                            </div>
                          </div>
                        })}
                        </div>
                      : <p className="customerHistoryEmpty">過去の利用履歴はありません</p>}
                    {customerHistory.length>5 && <small>直近5件を表示しています</small>}
                  </div>
                </div>}
              </section>}
            </div>

            <label>キャスト
              <select value={castId} onChange={e=>setCastId(e.target.value)} disabled={!formCastChoices.length}>
                <option value="">未設定</option>
                {formCastChoices.map(c=><option key={c.id} value={c.id}>{c.name} / {statusLabels[castOperationalStatus(c,selectedDateOrders,date,now,storeSettings.closeTime)]}</option>)}
              </select>
            </label>

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
              <div className="selectedCastAdCell">
                <span>広告サイト</span>
                {selectedCast.advertisingUrl
                  ? <a href={selectedCast.advertisingUrl} target="_blank" rel="noreferrer">広告ページを開く ↗</a>
                  : <strong>URL未登録</strong>}
              </div>
              <div className={`selectedCastNotesCell ${castNotesExpanded?"expanded":""}`}>
                <span>備考</span>
                <strong>{selectedCast.notes || "なし"}</strong>
                {(selectedCast.notes?.length??0)>24 && <button type="button" onClick={()=>setCastNotesExpanded(value=>!value)}>
                  {castNotesExpanded?"閉じる":"全文表示"}
                </button>}
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

            <div className="formExtensionBox">
              <div className="formExtensionHead">
                <span>延長</span>
                <small>終了予定 {formScheduledEnd}</small>
              </div>
              <div className="formExtensionStepper">
                <button
                  type="button"
                  onClick={()=>setFormExtensionCount(value=>Math.max(0,value-1))}
                  disabled={formExtensionCount===0}
                  aria-label="延長を減らす"
                >−</button>
                <div>
                  <strong>{formExtensionMinutes}分</strong>
                  <span>{formExtensionTotal>0 ? `＋${formatYen(formExtensionTotal)}` : "＋0円"}</span>
                </div>
                <button
                  type="button"
                  onClick={()=>setFormExtensionCount(value=>value+1)}
                  aria-label="延長を増やす"
                >＋</button>
              </div>
            </div>

            <div className="workGrid two">
              <label>利用場所
                <select value={locationName} onChange={e=>selectHotel(e.target.value)} disabled={!availableHotels.length}>
                  {availableHotels.length===0 && <option value="">利用場所未登録</option>}
                  {availableHotels.map(hotel=><option key={hotel.id} value={hotel.name}>【{hotelKindLabel(hotel.kind)}】{hotel.name}</option>)}
                </select>
              </label>
              <label>部屋番号
                <input value={room} onChange={e=>setRoom(e.target.value)} placeholder={selectedHotel?.kind==="home"?"自宅の場合は空欄でOK":"例：101"}/>
              </label>
            </div>

            <label>住所（任意）
              <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="例：札幌市中央区南5条西4丁目"/>
            </label>

            <div className="orderOptionPicker optionPopupPicker">
              <div className="orderOptionPickerHead">
                <span>オプション</span>
                <div>
                  <strong>{formatYen(optionsTotal)}</strong>
                  <button type="button" className="optionOpenButton" onClick={()=>setOptionModalOpen(true)} disabled={!selectedCast || !selectableOptions.length}>選択</button>
                </div>
              </div>
              <div className="selectedOptionLabels">
                {selectedOptionIds.length
                  ? selectableOptions.filter(option=>selectedOptionIds.includes(option.id)).map(option=><span key={option.id}>
                      {option.name}<small>{option.price===0?"無料":formatYen(option.price)}</small>
                      <button type="button" onClick={()=>toggleOrderOption(option.id)}>×</button>
                    </span>)
                  : <em>{selectedCast ? "オプション未選択" : "キャストを選択してください"}</em>}
              </div>
            </div>

            <div className="workGrid three">
              <label>交通費<input type="number" step={storeSettings.priceUnit??100} value={travelFee} onChange={e=>setTravelFee(Number(e.target.value))}/></label>
              <label>割引
                <div className="moneyPresetControl">
                  <select
                    value={discountPresets.includes(discount)?String(discount):"__custom__"}
                    onChange={e=>{if(e.target.value!=="__custom__") setDiscount(Number(e.target.value));}}
                  >
                    {discountPresets.map(value=><option key={value} value={value}>{new Intl.NumberFormat("ja-JP").format(value)}円</option>)}
                    <option value="__custom__">手入力</option>
                  </select>
                  <input type="number" min="0" step={storeSettings.priceUnit??100} value={discount} onChange={e=>setDiscount(Math.max(0,Number(e.target.value)))}/>
                </div>
              </label>
              <label>割増
                <div className="moneyPresetControl">
                  <select
                    value={surchargePresets.includes(surcharge)?String(surcharge):"__custom__"}
                    onChange={e=>{if(e.target.value!=="__custom__") setSurcharge(Number(e.target.value));}}
                  >
                    {surchargePresets.map(value=><option key={value} value={value}>{new Intl.NumberFormat("ja-JP").format(value)}円</option>)}
                    <option value="__custom__">手入力</option>
                  </select>
                  <input type="number" min="0" step={storeSettings.priceUnit??100} value={surcharge} onChange={e=>setSurcharge(Math.max(0,Number(e.target.value)))}/>
                </div>
              </label>
            </div>

            <div className="paymentAndTimeGrid">
              <label>支払方法
                <div className="paymentMethodChoices">
                  <button type="button" className={paymentMethod==="cash"?"active":""} onClick={()=>setPaymentMethod("cash")}>現金</button>
                  <button type="button" className={paymentMethod==="card"?"active":""} onClick={()=>setPaymentMethod("card")}>カード</button>
                </div>
              </label>
              <label>開始時間
                <input type="time" value={scheduledStart} onChange={e=>setScheduledStart(e.target.value)}/>
              </label>
            </div>

            {paymentMethod==="card" && <div className="cardFeePreview">
              <span>カード手数料 {storeSettings.cardFeeRate??0}% / {new Intl.NumberFormat("ja-JP").format(storeSettings.priceUnit??100)}円単位</span>
              <strong>＋{formatYen(cardFee)}</strong>
            </div>}

            <label>備考
              <textarea rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="サンプル備考を入力"/>
            </label>

            <div className="driverMailRow">
              <label>ドライバー
                <select value={driverId} onChange={e=>setDriverId(e.target.value)}>
                  <option value="">未設定</option>
                  {driverCandidates.map(row=><option key={row.driver.id} value={row.driver.id}>{row.driver.name}{row.overlap.length?" ⚠時間重複":""}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="driverMailButton"
                onClick={openDriverMail}
                disabled={!selectedDriver?.email}
                title={selectedDriver?.email ? `${selectedDriver.email} 宛てにメールを作成` : "ドライバー登録でメールアドレスを設定してください"}
              >
                メール送信
              </button>
              <span className={selectedDriver?.email ? "driverMailAddress" : "driverMailAddress missing"}>
                {selectedDriver?.email || "メールアドレス未登録"}
              </span>
            </div>

            <div className="workFooter">
              <div className="workTotalSummary"><small>自動計算</small>{paymentMethod==="card" && <span>カード手数料込み</span>}<strong>{formatYen(total)}</strong></div>
              <div className="workButtons">
                {!editingOrderId && !activeFreeHoldId && <button className="freeHoldSaveButton" type="button" onClick={saveCurrentAsFreeHold}>フリー予約を保管</button>}
                <button className="registerBtn" type="submit" disabled={!selectedCast}>{editingOrderId?"変更を保存":"オーダー登録"}</button>
                {(editingOrderId || activeFreeHoldId) && <button type="button" onClick={resetOrderForm}>{editingOrderId?"編集キャンセル":"作成をやめる"}</button>}
              </div>
            </div>
          </form>
        </section>)}
      </main>

      <aside className="deskRight">
        {widgetPortal("freeHolds", <section className={`deskPanel freeHoldPanel dispatchWidget ${widgetAreaClass("freeHolds")}`} style={{order:widgetOrder("freeHolds")}}>
          <div className="panelTitleRow">
            <h2>フリー予約保管</h2>
            <span>{freeReservationHolds.length}件</span>
          </div>
          <div className="freeHoldList">
            {freeReservationHolds
              .slice()
              .sort((a,b)=>(a.serviceDate+a.scheduledStart).localeCompare(b.serviceDate+b.scheduledStart))
              .map(item=><div className={`freeHoldItem ${activeFreeHoldId===item.id?"active":""}`} key={item.id}>
                <div className="freeHoldMain">
                  <div>
                    <strong>{item.serviceDate===date ? item.scheduledStart : `${item.serviceDate} ${item.scheduledStart}`}</strong>
                    <span>{item.courseMinutes+(item.extensionMinutes??0)}分 / フリー</span>
                  </div>
                  <small>{item.locationName || "場所未入力"}{item.room ? ` / ${item.room}号室` : ""}</small>
                  {item.customerPhone && <small>{item.customerPhone}</small>}
                </div>
                <div className="freeHoldActions">
                  <button type="button" className="freeHoldConvert" onClick={()=>loadFreeHoldIntoOrderForm(item)}>オーダー化</button>
                  <button type="button" className="freeHoldDelete" onClick={()=>removeFreeHold(item.id)}>削除</button>
                </div>
              </div>)}
            {!freeReservationHolds.length && <p className="freeHoldEmpty">保管中のフリー予約はありません</p>}
          </div>
        </section>)}

        {widgetPortal("reservations", <section className={`deskPanel dispatchWidget ${widgetAreaClass("reservations")}`} style={{order:widgetOrder("reservations")}}>
          <div className="panelTitleRow">
            <h2>選択日の予約一覧</h2>
            <span>{selectedDateOrders.length}件</span>
          </div>
          <div className="todayOrders">
            {selectedDateOrders
              .slice()
              .sort((a,b)=>a.scheduledStart.localeCompare(b.scheduledStart))
              .slice(0,7)
              .map(order=><Link href="/orders" key={order.id}>
                <div><strong>{order.scheduledStart}</strong><span>{order.castName}</span></div>
                <small>{order.locationName || "場所未入力"} / {orderStatusLabels[order.status]}</small>
              </Link>)}
            {!selectedDateOrders.length && <p>{date} の予約はありません</p>}
          </div>
        </section>)}
      </aside>

    {widgetPortal("board", <section className={`boardSection dispatchWidget ${widgetAreaClass("board")}`} style={{order:widgetOrder("board")}}>
      <div className="boardSectionHead">
        <div><h2>配車ボード</h2><span>{date}</span><span>営業時間 {storeSettings.openTime}〜{storeSettings.closeTime}</span></div>
        <div className="boardHeadRight">
          <label className="boardSortControl">
            <span>並び替え</span>
            <select value={castSortMode} onChange={e=>setCastSortMode(e.target.value as typeof castSortMode)}>
              <option value="default">基本順</option>
              <option value="activity">接客・送迎・予約順</option>
              <option value="countDesc">本数 多い順</option>
              <option value="countAsc">本数 少ない順</option>
              <option value="shiftStart">出勤時間順</option>
              <option value="name">名前順</option>
            </select>
          </label>
          <div className="boardLegend">
            <span><i className="legend beforeDispatch"/>配車前</span>
            <span><i className="legend afterDispatch"/>配車後</span>
            <span><i className="legend inService"/>イン中</span>
            <span><i className="legend out"/>アウト</span>
          </div>
        </div>
      </div>
      <div className="dispatchScroll boardZoomWrap" ref={boardScrollRef}>
        <div
          className="dispatchBoard wideBoard"
          ref={boardGridRef}
          style={{
            gridTemplateColumns:`var(--board-cast-col) var(--board-shift-col) var(--board-count-col) minmax(${timelineMinWidth}px,1fr)`,
            minWidth:`calc(var(--board-fixed-width) + ${timelineMinWidth}px)`
          }}
        >
          <div className="dispatchHeader dispatchNameHead">キャスト</div>
          <div className="dispatchHeader dispatchShiftHead">出勤 / 終了条件</div>
          <div className="dispatchHeader dispatchCountHead">本数</div>
          <div className="timelineHeader longTimeline" style={{gridTemplateColumns:`repeat(${boardHourCount},1fr)`}}>{hourLabels.map(hour=><div key={hour}>{hour}</div>)}</div>
          {globalNowLineLeft!==null && <span className="globalNowLine" style={{left:globalNowLineLeft}}><b>現在</b></span>}

          <div className="dispatchRowContents freeHoldBoardRow">
            <div className="dispatchName freeHoldBoardName" style={{minHeight:freeHoldRowHeight}}>
              <span className="freeHoldBoardDot"/>
              <div>
                <strong>フリー予約</strong>
                <small>キャスト未定</small>
              </div>
            </div>
            <div className="dispatchShift freeHoldBoardShift" style={{minHeight:freeHoldRowHeight}}>
              <strong>一時保管</strong>
              <span>決まり次第オーダー化</span>
            </div>
            <div className="dispatchCount freeHoldBoardCount" style={{minHeight:freeHoldRowHeight}}>
              <strong>{selectedDateFreeHolds.length}</strong><span>件</span>
            </div>
            <div className="timelineCell longCell freeHoldBoardTimeline" style={{...timelineGridStyle,minHeight:freeHoldRowHeight}}>
              {freeHoldBoardLayout.rows.map(({item,lane,overlapCount})=>{
                const pos=freeHoldPosition(item,boardStartMinute,boardMinutes);
                if(!pos) return null;
                return <div
                  key={item.id}
                  className={`timelineFreeHold ${overlapCount>1?"hasOverlap":""}`}
                  style={{...pos,top:7+lane*54,height:48}}
                  title={overlapCount>1 ? `同時間帯に${overlapCount}件のフリー予約があります` : "クリックしてキャストを決めてオーダー化"}
                >
                  <button
                    type="button"
                    className="timelineFreeHoldMain"
                    onClick={()=>loadFreeHoldIntoOrderForm(item)}
                  >
                    <strong>{item.scheduledStart}〜{addMinutes(item.scheduledStart,item.courseMinutes+(item.extensionMinutes??0))}</strong>
                    <span>{item.courseMinutes+(item.extensionMinutes??0)}分 / フリー</span>
                    {overlapCount>1 && <em className="freeHoldOverlapBadge">重複 {overlapCount}件</em>}
                    <small>{item.locationName || "場所未入力"}{item.room ? ` / ${item.room}号室` : ""}</small>
                  </button>
                  <button
                    type="button"
                    className="timelineFreeHoldDelete"
                    onClick={e=>{
                      e.stopPropagation();
                      removeFreeHold(item.id);
                    }}
                    title="フリー予約を削除"
                    aria-label="フリー予約を削除"
                  >×</button>
                </div>;
              })}
              {!selectedDateFreeHolds.length && <span className="freeHoldBoardEmpty">保管中のフリー予約なし</span>}
            </div>
          </div>

          {boardCasts.map(cast=>{
            const castOrders = selectedDateOrders.filter(o=>o.castId===cast.id);
            const activeCastOrderCount = castOrders.filter(o=>o.status!=="cancelled").length;
            const visibleOrders = castOrders.filter(o=>eventPosition(o,boardStartMinute,boardMinutes));
            const shift=castShiftForDate(cast,date);
            const attendance=shift?.attendance;
            const autoOff=castIsAutoOff(cast,date,storeSettings.closeTime,now);
            const unavailable=attendance==="absent" || attendance==="leftEarly" || autoOff;
            const shiftStart=shift?.start ?? cast.shiftStart ?? storeSettings.openTime;
            const endType=shift?.endType ?? "leave";
            const endTime=shift?.endTime ?? cast.shiftEnd ?? storeSettings.closeTime;
            const timelineEnd=endType==="leave" ? endTime : storeSettings.closeTime;
            const availability=shiftAvailabilityPosition(shiftStart,timelineEnd,boardStartMinute,boardMinutes);
            const receptionClosed=endType==="reception"
              ? receptionClosedPosition(endTime,storeSettings.closeTime,boardStartMinute,boardMinutes)
              : null;
            const operationalStatus=castOperationalStatus(cast,selectedDateOrders,date,now,storeSettings.closeTime);
            return <div className={`dispatchRowContents ${unavailable?"isUnavailableCast":""}`} key={cast.id}>
              <div className="dispatchName">
                <span className={`castStateDot ${operationalStatus}`}/>
                <button type="button" className="dispatchCastButton" onClick={()=>setDetailCastId(cast.id)}>
                  <strong>{cast.name}</strong>
                  <span className="dispatchCastMeta">
                    <small>{statusLabels[operationalStatus]}</small>
                    {autoOff
                      ? <em className="attendanceBadge autoOff">退勤済</em>
                      : shift?.attendance
                        ? <em className={`attendanceBadge ${shift.attendance}`}>{attendanceLabels[shift.attendance]}</em>
                        : <em className="attendanceBadge unconfirmed">未確認</em>}
                  </span>
                </button>
              </div>
              <div className="dispatchShift">
                <button type="button" className="dispatchShiftQuick" onClick={()=>openShiftQuickEdit(cast)} title="出勤時間をクイック修正">
                  <span>出勤 <b>{shift?.start ?? cast.shiftStart ?? "--:--"}</b></span>
                  <span>{(shift?.endType ?? "leave")==="reception" ? "受付終了" : "上がり"} <b>{shift?.endTime ?? cast.shiftEnd ?? "--:--"}</b></span>
                </button>
              </div>
              <div className="dispatchCount"><strong>{activeCastOrderCount}</strong><span>本</span></div>
              <div className="timelineCell longCell" style={timelineGridStyle}>
                {visibleOrders.map(order=>{
                  const pos = eventPosition(order,boardStartMinute,boardMinutes)!;
                  const visualState=orderVisualState(order,date,now);
                  return <button
                    type="button"
                    key={order.id}
                    className={`timelineOrder orderVisual-${visualState}`}
                    style={pos}
                    onClick={()=>openOrderMenu(order)}
                    title={visualState==="beforeDispatch"?"配車前":visualState==="afterDispatch"?"配車後":visualState==="in"?"イン中":visualState==="out"?"アウト":"キャンセル"}
                  >
                    <strong>{order.scheduledStart}〜{order.scheduledEnd}</strong>
                    {order.status==="cancelled" && <em className="timelineCancelledBadge">キャンセル</em>}
                    <span>{order.locationName || "場所未入力"}{order.room ? ` / ${order.room}号室` : ""}</span>
                    <small>送り：{order.driverName ?? "未設定"}</small>
                    {order.pickupDriverName && <small>迎え：{order.pickupDriverName}</small>}
                  </button>
                })}
                {!visibleOrders.length && !unavailable && <span className="emptyTimeline">空き</span>}
                {receptionClosed && <div className="receptionClosedBlock" style={receptionClosed} title="受付終了後">
                  <span>受付終了後（事前予約のみ）</span>
                </div>}
                <div className="offShiftBlock before" style={{width:availability.beforeWidth}} title="出勤時間外">
                  <span>出勤前</span>
                </div>
                <div className="offShiftBlock after" style={{left:availability.afterLeft,width:availability.afterWidth}} title="出勤時間外">
                  <span>上り後</span>
                </div>
                {unavailable && <div className="unavailableCastTimelineBlock">
                  <strong>{attendance==="absent"?"当欠":attendance==="leftEarly"?"早退":"退勤"}</strong>
                </div>}
              </div>
            </div>
          })}

          <div className="dispatchName totalCell"><strong>合計</strong></div>
          <div className="dispatchShift totalCell"><strong>{workingCasts.length}人</strong></div>
          <div className="dispatchCount totalCell"><strong>{displayedBoardOrderCount}</strong><span>本</span></div>
          <div className="timelineCell totalTimeline" style={timelineGridStyle}/>
        </div>
      </div>
    </section>)}
    </div>
    </div>

    {optionModalOpen && <div className="optionSelectBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setOptionModalOpen(false);}}>
      <div className="optionSelectModal" role="dialog" aria-modal="true">
        <div className="optionSelectHead">
          <div><span>OPTION</span><h2>オプション選択</h2><small>{selectedCast?.name} が対応可能なものだけ表示</small></div>
          <button type="button" onClick={()=>setOptionModalOpen(false)}>×</button>
        </div>
        <div className="optionSelectBody">
          {selectableOptions.map(option=>{
            const checked=selectedOptionIds.includes(option.id);
            return <button type="button" key={option.id} className={checked?"active":""} onClick={()=>toggleOrderOption(option.id)}>
              <span>{option.name}</span><small>{option.price===0?"無料":formatYen(option.price)}</small><b>{checked?"✓":""}</b>
            </button>
          })}
          {!selectableOptions.length && <p>このキャストに設定されている対応可能オプションはありません</p>}
        </div>
        <div className="optionSelectFooter">
          <span>{selectedOptionIds.length}件 / {formatYen(optionsTotal)}</span>
          <button type="button" className="primaryButton" onClick={()=>setOptionModalOpen(false)}>決定</button>
        </div>
      </div>
    </div>}

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

        {orderMode==="menu" && <>
          <div className="orderDriverDispatch">
            <div className="orderDriverDispatchRow">
              <label>送りドライバー
                <select
                  value={selectedOrder.driverId??""}
                  onChange={e=>changeOrderDriver("send",e.target.value)}
                >
                  <option value="">未設定</option>
                  {availableDrivers.map(driver=><option key={driver.id} value={driver.id}>{driver.name}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="orderDriverMailButton"
                disabled={!selectedOrderSendDriver?.email}
                onClick={()=>sendOrderDriverMail("send")}
              >
                送りメールを送信
              </button>
              <small>{selectedOrderSendDriver?.email || "メールアドレス未登録"}</small>
            </div>

            <div className="orderDriverDispatchRow">
              <label>お迎えドライバー
                <select
                  value={selectedOrder.pickupDriverId??""}
                  onChange={e=>changeOrderDriver("pickup",e.target.value)}
                >
                  <option value="">未設定</option>
                  {availableDrivers.map(driver=><option key={driver.id} value={driver.id}>{driver.name}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="orderDriverMailButton pickup"
                disabled={!selectedOrderPickupDriver?.email}
                onClick={()=>sendOrderDriverMail("pickup")}
              >
                お迎えメールを送信
              </button>
              <small>{selectedOrderPickupDriver?.email || "メールアドレス未登録"}</small>
            </div>
            <div className="orderLineCopyRow">
              <div className="orderLineCopyText">
                <strong>LINE共有</strong>
                <small>グループチャット用</small>
              </div>
              <div className="orderLineCopyActions">
                <button type="button" className="orderLineCopyButton" onClick={()=>void copyOrderForLine("send")}>
                  送りをコピー
                </button>
                <button type="button" className="orderLineCopyButton pickup" onClick={()=>void copyOrderForLine("pickup")}>
                  お迎えをコピー
                </button>
              </div>
            </div>
          </div>

          <div className="orderActionButtons orderActionButtonsSimple">
            <button type="button" className="orderActionIn" onClick={beginInTimeEntry}>
              {selectedOrder.inTime ? `イン ${selectedOrder.inTime}` : "イン時間"}
            </button>
            <button
              type="button"
              className="orderActionExtend"
              onClick={beginExtension}
              disabled={selectedOrder.status==="completed" || selectedOrder.status==="cancelled"}
            >延長</button>
            <button
              type="button"
              className="orderActionChange"
              onClick={beginChange}
              disabled={Boolean(selectedOrder.inTime) || selectedOrder.status==="serving" || selectedOrder.status==="completed" || selectedOrder.status==="cancelled"}
            >チェンジ</button>
            <button
              type="button"
              className="orderActionCancel"
              onClick={beginCancel}
              disabled={Boolean(selectedOrder.inTime) || selectedOrder.status==="serving" || selectedOrder.status==="completed" || selectedOrder.status==="cancelled"}
            >キャンセル</button>
            <button type="button" className="orderActionEdit" onClick={beginOrderEdit}>編集</button>
            <button type="button" className="orderActionClose" onClick={closeOrderMenu}>閉じる</button>
            <button type="button" className="orderActionDelete" onClick={deleteSelectedOrder}>オーダー削除</button>
          </div>
        </>}

        {orderMode==="change" && <div className="orderActionSubpanel">
          <h3>チェンジ処理</h3>
          <div className="changeCancelSummary">
            <span>現在のキャスト</span>
            <strong>{selectedOrder.castName}</strong>
          </div>
          <label className="changeCastSelect">変更後キャスト
            <select value={changeCastId} onChange={e=>setChangeCastId(e.target.value)}>
              <option value="">選択してください</option>
              {selectableCasts.filter(cast=>cast.id!==selectedOrder.castId).map(cast=><option key={cast.id} value={cast.id}>{cast.name}</option>)}
            </select>
          </label>
          <div className="changeCancelFee">
            <span>チェンジ料</span>
            <strong>＋{formatYen(storeSettings.changeFee??0)}</strong>
          </div>
          <small className="changeCancelHelp">確定するとキャストを変更し、オーダー料金へチェンジ料を加算します。</small>
          <div className="orderActionSubButtons">
            <button type="button" onClick={()=>setOrderMode("menu")}>戻る</button>
            <button type="button" className="primary" onClick={applyChange} disabled={!changeCastId}>チェンジ確定</button>
          </div>
        </div>}

        {orderMode==="cancel" && <div className="orderActionSubpanel">
          <h3>キャンセル処理</h3>
          <div className="changeCancelSummary">
            <span>対象</span>
            <strong>{selectedOrder.castName} / {selectedOrder.scheduledStart}〜{selectedOrder.scheduledEnd}</strong>
          </div>
          <div className="changeCancelFee cancel">
            <span>キャンセル料</span>
            <strong>{formatYen(storeSettings.cancelFee??0)}</strong>
          </div>
          <small className="changeCancelHelp">確定するとオーダーは配車ボードから外れ、キャンセル履歴と料金が記録されます。</small>
          <div className="orderActionSubButtons">
            <button type="button" onClick={()=>setOrderMode("menu")}>戻る</button>
            <button type="button" className="primary danger" onClick={applyCancel}>キャンセル確定</button>
          </div>
        </div>}

        {orderMode==="inTime" && <div className="orderActionSubpanel">
          <h3>イン時間入力</h3>
          <div className="inTimeControl">
            <label>イン時間
              <input type="time" value={inTimeDraft} onChange={e=>setInTimeDraft(e.target.value)}/>
            </label>
            <small>実際に入った時刻を手入力して確定してください。</small>
          </div>
          <div className="orderActionSubButtons">
            <button type="button" onClick={()=>setOrderMode("menu")}>戻る</button>
            <button type="button" className="primary" onClick={recordInTime} disabled={!inTimeDraft}>イン時間を確定</button>
          </div>
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
          {extensionHardWarning && <div className="extensionConflictWarning" role="alert">
            <strong>⚠ 延長できません</strong>
            <span>{extensionHardWarning}</span>
          </div>}
          {extensionSoftTimeWarning && <div className="extensionTimeWarning" role="status">
            <strong>⚠ キャストの受付時間を超えます</strong>
            <span>本人が延長OKの場合は確定できます。確定時にもう一度確認します。</span>
          </div>}
          <div className="orderActionSubButtons">
            <button type="button" onClick={()=>setOrderMode("menu")}>戻る</button>
            <button type="button" className="primary danger" onClick={applyExtension} disabled={Boolean(extensionHardWarning)}>延長確定</button>
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
          <div><span>出勤予定</span><strong>{detailShift?.start ?? detailCast.shiftStart ?? "--:--"} / {(detailShift?.endType ?? "leave")==="reception" ? "受付終了" : "上がり"} {detailShift?.endTime ?? detailCast.shiftEnd ?? "--:--"}</strong></div>
          <div><span>現在状態</span><strong>{statusLabels[castOperationalStatus(detailCast,selectedDateOrders,date,now,storeSettings.closeTime)]}</strong></div>
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
          <label>終了条件
            <select value={shiftDraft.endType} onChange={e=>setShiftDraft(current=>({...current,endType:e.target.value as CastShiftEndType}))}>
              <option value="reception">受付終了</option>
              <option value="leave">上がり</option>
            </select>
          </label>
          <label>時刻
            <input type="time" value={shiftDraft.endTime} onChange={e=>setShiftDraft(current=>({...current,endTime:e.target.value}))}/>
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
