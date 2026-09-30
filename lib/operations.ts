import type {Cast, Driver, Order, StoreSettings, CastSettlementAdjustment, Expense} from "./types";

/** A business day may continue after midnight (for example 12:00–05:00). */
export function localDate(date:Date=new Date()){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
}
export function clockMinutes(value:string):number{
  const match=/^(\d{1,2}):(\d{2})$/.exec(value);
  if(!match) return NaN;
  const hour=Number(match[1]),minutes=Number(match[2]);
  return hour<24 && minutes<60 ? hour*60+minutes : NaN;
}
export function businessMinutes(time:string,storeOpen:string):number{
  const value=clockMinutes(time),open=clockMinutes(storeOpen);
  if(!Number.isFinite(value)||!Number.isFinite(open))return NaN;
  return value<open?value+1440:value;
}
export function closingMinutes(settings:StoreSettings):number{
  const end=businessMinutes(settings.closeTime,settings.openTime);
  const start=clockMinutes(settings.openTime);
  return end<=start?end+1440:end;
}
export function addBusinessMinutes(value:number,amount:number){
  const adjusted=((value+amount)%1440+1440)%1440;
  return `${String(Math.floor(adjusted/60)).padStart(2,"0")}:${String(adjusted%60).padStart(2,"0")}`;
}
export function orderDate(order:Order):string{
  return order.serviceDate||localDate(new Date(order.createdAt));
}
export function orderDuration(order:Order):number{
  return Math.max(1,(Number(order.courseMinutes)||0)+(Number(order.extensionMinutes)||0));
}
export function orderInterval(order:Order,settings:StoreSettings){
  const start=businessMinutes(order.scheduledStart,settings.openTime);
  const fromEnd=businessMinutes(order.scheduledEnd,settings.openTime);
  const duration=orderDuration(order);
  // The stored end time can be stale after a course extension; duration wins.
  const end=Number.isFinite(duration)&&duration>0?start+duration:
    (fromEnd>start?fromEnd:fromEnd+1440);
  return {start,end};
}
export type Availability={ok:boolean;message:string;conflicts:Order[];nextSlots:string[]};
export function checkCastAvailability(args:{
  cast:Cast; date:string; start:string; minutes:number; orders:Order[];
  settings:StoreSettings; ignoreOrderId?:string; includeSlots?:boolean; bookingTakenAt?:Date;
}):Availability{
  const {cast,date,start,minutes,orders,settings,ignoreOrderId}=args;
  const from=businessMinutes(start,settings.openTime);
  const to=from+minutes;
  const open=clockMinutes(settings.openTime);
  const close=closingMinutes(settings);
  const shift=cast.schedule?.find(x=>x.date===date);
  let message="";
  if(!Number.isFinite(from)||!Number.isFinite(minutes)||minutes<=0)message="開始時間・コースを確認してください";
  else if(cast.visible===false)message="非表示のキャストです";
  else if(shift && (!shift.working||shift.attendance==="absent"||shift.attendance==="leftEarly"))message="この日はお休み・欠勤です";
  else if(!shift && cast.schedule?.length && !cast.schedule.find(s=>s.date===date))message="この日の出勤予定が登録されていません";
  else if(from<open||from>=close || to>close)message="店舗の営業時間外です";
  else if(shift){
    const shiftStart=businessMinutes(shift.start,settings.openTime);
    const shiftEnd=businessMinutes(shift.endTime,settings.openTime);
    if(from<shiftStart)message="出勤開始前です";
    else if(shift.endType==="reception"){
      // 受付終了は予約の受付締切。確定済み予約の開始・退勤時刻ではない。
      const taken=args.bookingTakenAt??new Date();
      const takenTime=String(taken.getHours()).padStart(2,"0")+":"+String(taken.getMinutes()).padStart(2,"0");
      const takenBizDate=new Date(taken);
      if(clockMinutes(takenTime)<clockMinutes(settings.openTime))takenBizDate.setDate(takenBizDate.getDate()-1);
      if(localDate(takenBizDate)===date &&
        businessMinutes(takenTime,settings.openTime)>shiftEnd)
        message="キャストの受付終了後です";
    }
    else if(shift.endType==="leave" && to>shiftEnd)message="キャストの上がり時間を超えます";
  }else{
    // Legacy cast fields; saved weekly shifts take precedence.
    if(cast.shiftStart && from<businessMinutes(cast.shiftStart,settings.openTime))
      message="出勤開始前です";
    else if(cast.shiftEnd && to>businessMinutes(cast.shiftEnd,settings.openTime))
      message="キャストの上がり時間を超えます";
  }
  const buffer=Math.min(180,Math.max(0,settings.bookingBufferMinutes??15));
  const conflicts=Number.isFinite(from)?orders.filter(order=>{
    if(order.id===ignoreOrderId||order.castId!==cast.id||orderDate(order)!==date||
      order.status==="cancelled")return false;
    const other=orderInterval(order,settings);
    return from<other.end+buffer && to>other.start-buffer;
  }):[];
  if(!message && conflicts.length)message=`ほかの予約と重複しています（前後${buffer}分の移動余裕を含む）`;
  const nextSlots:string[]=[];
  if(args.includeSlots && Number.isFinite(from) && Number.isFinite(minutes) && minutes>0){
    const first=Math.max(open,Math.ceil(from/10)*10);
    for(let at=first;at+minutes<=close && nextSlots.length<5;at+=10){
      const choice=checkCastAvailability({
        ...args,start:addBusinessMinutes(0,at),includeSlots:false
      });
      if(choice.ok)nextSlots.push(addBusinessMinutes(0,at));
    }
  }
  return {ok:!message,message,conflicts,nextSlots};
}
export function availableCastsAt(args:{casts:Cast[];orders:Order[];date:string;start:string;minutes:number;settings:StoreSettings}){
  return args.casts
    .map(cast=>({cast,result:checkCastAvailability({...args,cast})}))
    .filter(row=>row.result.ok);
}
type DriverTask={order:Order;type:"send"|"pickup";start:number;end:number};
export function driverTasks(date:string,orders:Order[],settings:StoreSettings):DriverTask[]{
  const duration=Math.min(180,Math.max(5,settings.dispatchBufferMinutes??30));
  return orders.flatMap(order=>{
    if(orderDate(order)!==date||order.status==="cancelled")return [];
    const {start,end}=orderInterval(order,settings);
    const tasks:DriverTask[]=[];
    if(order.driverId)tasks.push({order,type:"send",start:start-duration,end:start});
    if(order.pickupDriverId)tasks.push({order,type:"pickup",start:end,end:end+duration});
    return tasks;
  });
}
export function suggestDrivers(args:{
  drivers:Driver[];orders:Order[];date:string;start:string;settings:StoreSettings;ignoreOrderId?:string
}){
  const slot=businessMinutes(args.start,args.settings.openTime);
  const interval=Math.min(180,Math.max(5,args.settings.dispatchBufferMinutes??30));
  const tasks=driverTasks(args.date,args.orders,args.settings);
  return args.drivers.filter(driver=>driver.active!==false).map(driver=>{
    const own=tasks.filter(task=>task.order.id!==args.ignoreOrderId &&
      (task.type==="send"?task.order.driverId:task.order.pickupDriverId)===driver.id);
    const overlap=own.filter(task=>slot-interval<task.end && slot>task.start);
    return {driver,overlap,load:own.length,
      next:own.filter(task=>task.start>=slot).sort((a,b)=>a.start-b.start)[0]||null};
  }).sort((a,b)=>Number(a.overlap.length>0)-Number(b.overlap.length>0)||a.load-b.load||a.driver.name.localeCompare(b.driver.name));
}
export function backForOrder(order:Order,cast?:Cast, adjustment?:CastSettlementAdjustment):number{
  const base=order.nominationType==="photo" ? cast?.photoUnitPrice??cast?.unitPrice??0:
    order.nominationType==="repeat" ? cast?.repeatUnitPrice??cast?.unitPrice??0:
      cast?.freeUnitPrice??cast?.unitPrice??0;
  return base+(adjustment?.optionBack??0)+(adjustment?.extensionBack??0)+(adjustment?.adjustment??0);
}
export function buildPerformance(args:{
  orders:Order[];casts:Cast[];expenses:Expense[];settlements:Record<string,CastSettlementAdjustment>;
  dateFrom:string;dateTo:string;
}){
  const orders=args.orders.filter(x=>orderDate(x)>=args.dateFrom&&orderDate(x)<=args.dateTo);
  const completed=orders.filter(x=>x.status==="completed");
  const pipeline=orders.filter(x=>x.status!=="completed"&&x.status!=="cancelled");
  const cancelled=orders.filter(x=>x.status==="cancelled");
  const turnover=completed.reduce((n,x)=>n+x.total,0)+
    cancelled.reduce((n,x)=>n+(x.cancelFee??0),0);
  const expected=pipeline.reduce((n,x)=>n+x.total,0);
  const payout=completed.reduce((n,x)=>n+backForOrder(x,args.casts.find(c=>c.id===x.castId),args.settlements[x.id]),0);
  const expenses=args.expenses.filter(x=>x.date>=args.dateFrom&&x.date<=args.dateTo)
    .reduce((n,x)=>n+Math.max(0,x.amount),0);
  const nominated=completed.filter(x=>x.nominationType!=="free").length;
  const customerPhones=new Set(completed.map(x=>x.customerPhone.replace(/\D/g,"")).filter(Boolean));
  return {orders,completed,pipeline,cancelled,turnover,expected,payout,expenses,
    grossProfit:turnover-payout-expenses,
    nominated,nominationRate:completed.length?nominated/completed.length:0,
    uniqueCustomers:customerPhones.size,
    average:completed.length?Math.round(completed.reduce((n,x)=>n+x.total,0)/completed.length):0
  };
}
