"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { casts, courses, drivers, pricingSettings } from "@/lib/mock-data";
import { calculateOrderTotal, formatYen } from "@/lib/pricing";
import { saveOrder } from "@/lib/storage";
import type { Order } from "@/lib/types";

function addMinutes(time:string, minutes:number){
  const [h,m] = time.split(":").map(Number);
  const total = h*60+m+minutes;
  return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}

export default function NewOrderPage(){
  const router = useRouter();
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const [courseId,setCourseId] = useState("60");
  const [nominationType,setNominationType] = useState<"free"|"photo"|"repeat">("free");
  const [optionsTotal,setOptionsTotal] = useState(0);
  const [travelFee,setTravelFee] = useState(pricingSettings.defaultTravelFee);
  const [discount,setDiscount] = useState(0);
  const [adjustment,setAdjustment] = useState(0);
  const [castId,setCastId] = useState(casts[0].id);
  const [driverId,setDriverId] = useState(drivers[0].id);
  const [scheduledStart,setScheduledStart] = useState(defaultTime);
  const course = courses.find(c=>c.id===courseId);
  const total = useMemo(()=>calculateOrderTotal({course,nominationType,...pricingSettings,optionsTotal,travelFee,discount,adjustment}),[course,nominationType,optionsTotal,travelFee,discount,adjustment]);

  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cast = casts.find(c=>c.id===castId)!;
    const driver = drivers.find(d=>d.id===driverId);
    const order:Order = {
      id:crypto.randomUUID(), createdAt:new Date().toISOString(),
      customerPhone:String(fd.get("phone")||""), locationType:fd.get("locationType") as "hotel"|"home",
      locationName:String(fd.get("locationName")||""), room:String(fd.get("room")||""),
      castId, castName:cast.name, driverId:driver?.id, driverName:driver?.name,
      courseMinutes:course?.minutes??60, nominationType, optionsTotal, travelFee, discount, adjustment, total,
      status:"accepted", scheduledStart, scheduledEnd:addMinutes(scheduledStart,course?.minutes??60),
      note:String(fd.get("note")||"")
    };
    saveOrder(order);
    router.push("/orders");
  }

  return <div>
    <header className="pageHeader"><div><p className="eyebrow">NEW ORDER</p><h1>新規受付</h1><p>上から順番に入力すれば料金まで自動計算します。</p></div></header>
    <form onSubmit={submit} className="orderLayout">
      <section className="panel formPanel">
        <h2>受付情報</h2>
        <div className="formGrid">
          <label>電話番号<input name="phone" inputMode="tel" placeholder="090-0000-0000"/></label>
          <label>開始予定<input type="time" value={scheduledStart} onChange={e=>setScheduledStart(e.target.value)}/></label>
          <label>利用場所<select name="locationType"><option value="hotel">ホテル</option><option value="home">自宅</option></select></label>
          <label>ホテル / 場所<input name="locationName" required placeholder="ホテル名・住所"/></label>
          <label>部屋番号<input name="room" placeholder="501"/></label>
          <label>キャスト<select value={castId} onChange={e=>setCastId(e.target.value)}>{casts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>コース<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.minutes}分 / {formatYen(c.price)}</option>)}</select></label>
          <label>指名<select value={nominationType} onChange={e=>setNominationType(e.target.value as typeof nominationType)}><option value="free">フリー</option><option value="photo">写真指名</option><option value="repeat">本指名</option></select></label>
          <label>ドライバー<select value={driverId} onChange={e=>setDriverId(e.target.value)}>{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>オプション合計<input type="number" value={optionsTotal} onChange={e=>setOptionsTotal(Number(e.target.value))} min="0" step="500"/></label>
          <label>交通費<input type="number" value={travelFee} onChange={e=>setTravelFee(Number(e.target.value))} min="0" step="500"/></label>
          <label>割引<input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value))} min="0" step="500"/></label>
          <label>手動調整<input type="number" value={adjustment} onChange={e=>setAdjustment(Number(e.target.value))} step="500"/></label>
        </div>
        <label className="fullLabel">備考<textarea name="note" rows={4} placeholder="入館方法、注意事項、引継ぎなど"/></label>
      </section>
      <aside className="panel summaryPanel">
        <p className="eyebrow">PRICE</p><h2>料金確認</h2>
        <dl className="priceList">
          <div><dt>基本料金</dt><dd>{formatYen(course?.price??0)}</dd></div>
          <div><dt>指名料</dt><dd>{formatYen(nominationType==="photo"?pricingSettings.photoNominationFee:nominationType==="repeat"?pricingSettings.repeatNominationFee:0)}</dd></div>
          <div><dt>オプション</dt><dd>{formatYen(optionsTotal)}</dd></div>
          <div><dt>交通費</dt><dd>{formatYen(travelFee)}</dd></div>
          <div><dt>割引</dt><dd>-{formatYen(discount)}</dd></div>
          <div><dt>調整</dt><dd>{formatYen(adjustment)}</dd></div>
        </dl>
        <div className="totalBox"><span>お客様料金</span><strong>{formatYen(total)}</strong></div>
        <button className="primaryButton wide" type="submit">受付を確定する</button>
      </aside>
    </form>
  </div>
}
