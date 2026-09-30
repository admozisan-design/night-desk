const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ts=require("typescript");
process.env.TZ="Asia/Tokyo";
const source=fs.readFileSync("lib/operations.ts","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const mod={exports:{}};
vm.runInNewContext(compiled.outputText,{module:mod,exports:mod.exports,Date,Intl,console});
const op=mod.exports;
const settings={openTime:"12:00",closeTime:"05:00",bookingBufferMinutes:15,dispatchBufferMinutes:30};
const working=(endType,endTime)=>({id:"cast-1",name:"テスト",visible:true,
  schedule:[{date:"2026-10-01",start:"18:00",endType,endTime,working:true}]});
function booking(start,minutes,id="order-1",castId="cast-1",serviceDate="2026-10-01"){
 const at=op.businessMinutes(start,"12:00");
 return {id,createdAt:"2026-10-01T12:00:00+09:00",serviceDate,scheduledStart:start,
  scheduledEnd:op.addBusinessMinutes(at,minutes),courseMinutes:minutes,nominationType:"free",
  status:"accepted",castId};
}
const takenBefore=new Date("2026-10-01T23:00:00+09:00");

test("overnight business day closes at next-day 05:00",()=>{
 assert.equal(op.closingMinutes(settings),1740);
 assert.equal(op.businessMinutes("01:00","12:00"),1500);
});
test("leave is hard end of service, not just last reservation",()=>{
 const result=op.checkCastAvailability({cast:working("leave","00:00"),date:"2026-10-01",
  start:"23:30",minutes:60,orders:[],settings,bookingTakenAt:takenBefore});
 assert.equal(result.ok,false);
 assert.match(result.message,/上がり/);
});
test("reception means last time to take calls, not forced service end",()=>{
 const result=op.checkCastAvailability({cast:working("reception","00:00"),
  date:"2026-10-01",start:"00:30",minutes:60,orders:[],settings,bookingTakenAt:takenBefore});
 assert.equal(result.ok,true);
});
test("reception rejects calls after cutoff on the same business date",()=>{
 const result=op.checkCastAvailability({cast:working("reception","00:00"),
  date:"2026-10-01",start:"01:00",minutes:60,orders:[],settings,
  bookingTakenAt:new Date("2026-10-02T00:10:00+09:00")});
 assert.equal(result.ok,false);
 assert.match(result.message,/受付終了/);
});
test("cross-midnight overlaps are detected, including travel buffer",()=>{
 const existing=[booking("23:50",80)];
 const result=op.checkCastAvailability({cast:working("reception","02:00"),
  date:"2026-10-01",start:"00:30",minutes:60,orders:existing,settings,bookingTakenAt:takenBefore});
 assert.equal(result.ok,false);
 assert.equal(result.conflicts.length,1);
});
test("orders on different business days never conflict",()=>{
 const existing=[booking("23:50",80,"o1","cast-1","2026-09-30")];
 const result=op.checkCastAvailability({cast:working("reception","02:00"),
  date:"2026-10-01",start:"00:30",minutes:60,orders:existing,settings,bookingTakenAt:takenBefore});
 assert.equal(result.ok,true);
});
test("driver candidate with no overlapping send is suggested first",()=>{
 const orders=[{...booking("19:00",60),driverId:"d1"}];
 const drivers=[{id:"d1",name:"A",active:true},{id:"d2",name:"B",active:true}];
 const ranked=op.suggestDrivers({drivers,orders,date:"2026-10-01",start:"19:00",settings});
 assert.equal(ranked[0].driver.id,"d2");
 assert.equal(ranked[1].overlap.length,1);
});
test("profit separates completed sales from pending, expenses and payout",()=>{
 const orders=[{...booking("18:00",60,"1"),status:"completed",total:18000},
   {...booking("22:00",60,"2"),status:"accepted",total:22000}];
 const casts=[{id:"cast-1",name:"テスト",freeUnitPrice:8000}];
 const expenses=[{id:"e",date:"2026-10-01",category:"その他",description:"経費",amount:3000}];
 const p=op.buildPerformance({orders,casts,expenses,settlements:{},
   dateFrom:"2026-10-01",dateTo:"2026-10-01"});
 assert.equal(p.turnover,18000);
 assert.equal(p.expected,22000);
 assert.equal(p.grossProfit,7000);
});
