"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { casts as defaultCasts } from "@/lib/mock-data";
import { loadCasts, saveCasts } from "@/lib/storage";
import type { Cast, CastShift } from "@/lib/types";

const dayNames = ["日","月","火","水","木","金","土"];

function dateValue(date:Date){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,"0");
  const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function addDays(value:string,days:number){
  const date=new Date(value+"T12:00:00");
  date.setDate(date.getDate()+days);
  return dateValue(date);
}

function startOfWeek(date=new Date()){
  const copy=new Date(date);
  const day=copy.getDay();
  const diff=day===0?-6:1-day;
  copy.setDate(copy.getDate()+diff);
  return dateValue(copy);
}

function labelForDate(value:string){
  const date=new Date(value+"T12:00:00");
  return `${date.getMonth()+1}/${date.getDate()}（${dayNames[date.getDay()]}）`;
}

export default function CastSchedulePage(){
  const [casts,setCasts]=useState<Cast[]>(defaultCasts);
  const [selectedId,setSelectedId]=useState("");
  const [weekStart,setWeekStart]=useState(()=>startOfWeek());
  const [drafts,setDrafts]=useState<Record<string,CastShift>>({});
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const loaded=loadCasts(defaultCasts);
    setCasts(loaded);
    setSelectedId(current=>current || loaded.find(c=>c.visible!==false)?.id || loaded[0]?.id || "");
  },[]);

  const selected=casts.find(c=>c.id===selectedId);
  const weekDates=useMemo(()=>Array.from({length:7},(_,index)=>addDays(weekStart,index)),[weekStart]);

  useEffect(()=>{
    if(!selected) return;
    const next:Record<string,CastShift>={};
    for(const date of weekDates){
      const existing=selected.schedule?.find(item=>item.date===date);
      next[date]=existing ?? {
        date,
        start:selected.shiftStart ?? "18:00",
        end:selected.shiftEnd ?? "04:00",
        working:false
      };
    }
    setDrafts(next);
  },[selectedId,weekStart,casts]);

  function updateShift(date:string,changes:Partial<CastShift>){
    setDrafts(current=>({
      ...current,
      [date]:{...current[date],...changes}
    }));
  }

  function saveSchedule(){
    if(!selected) return;
    const weekSet=new Set(weekDates);
    const existing=(selected.schedule??[]).filter(item=>!weekSet.has(item.date));
    const schedule=[...existing,...weekDates.map(date=>drafts[date])].sort((a,b)=>a.date.localeCompare(b.date));
    const next=casts.map(cast=>cast.id===selected.id?{...cast,schedule}:cast);
    setCasts(next);
    saveCasts(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1400);
  }

  const workingDays=weekDates.filter(date=>drafts[date]?.working).length;

  return <div className="castSchedulePage">
    <header className="pageHeader castScheduleHeader">
      <div>
        <p className="eyebrow">CAST SCHEDULE</p>
        <h1>キャスト出勤管理</h1>
        <p>キャストを1人選び、日ごとの出勤・休みと出勤時間を設定します。</p>
      </div>
      <div className="castScheduleHeaderActions">
        {saved && <span className="saveToast">保存しました</span>}
        <Link href="/casts/manage" className="secondaryButton">キャスト登録情報</Link>
        <button type="button" className="primaryButton" onClick={saveSchedule} disabled={!selected}>保存</button>
      </div>
    </header>

    <div className="castScheduleLayout">
      <aside className="castScheduleCastList">
        <div className="castScheduleCastListHead">
          <strong>キャスト</strong>
          <span>{casts.filter(c=>c.visible!==false).length}人</span>
        </div>
        <div className="castScheduleCastButtons">
          {casts.filter(c=>c.visible!==false).map(cast=><button
            type="button"
            key={cast.id}
            className={cast.id===selectedId?"active":""}
            onClick={()=>setSelectedId(cast.id)}
          >
            <span>{cast.name}</span>
            <small>{cast.id===selectedId?"編集中":"選択"}</small>
          </button>)}
          {!casts.length && <p className="masterEmpty compact">キャストが登録されていません</p>}
        </div>
      </aside>

      <section className="castSchedulePanel">
        <div className="castScheduleToolbar">
          <div>
            <span>対象キャスト</span>
            <strong>{selected?.name ?? "未選択"}</strong>
          </div>
          <div className="castScheduleWeekNav">
            <button type="button" onClick={()=>setWeekStart(value=>addDays(value,-7))}>← 前週</button>
            <button type="button" onClick={()=>setWeekStart(startOfWeek())}>今週</button>
            <button type="button" onClick={()=>setWeekStart(value=>addDays(value,7))}>翌週 →</button>
          </div>
        </div>

        <div className="castScheduleWeekSummary">
          <div><span>期間</span><strong>{labelForDate(weekDates[0])} 〜 {labelForDate(weekDates[6])}</strong></div>
          <div><span>出勤予定</span><strong>{workingDays}日</strong></div>
        </div>

        <div className="castScheduleTable">
          <div className="castScheduleRow castScheduleTableHead">
            <span>日付</span><span>予定</span><span>出勤</span><span>上り</span>
          </div>
          {weekDates.map(date=>{
            const shift=drafts[date];
            if(!shift) return null;
            return <div className={`castScheduleRow ${shift.working?"isWorking":"isOff"}`} key={date}>
              <strong>{labelForDate(date)}</strong>
              <label className="castScheduleToggle">
                <input type="checkbox" checked={shift.working} onChange={e=>updateShift(date,{working:e.target.checked})}/>
                <span>{shift.working?"出勤":"休み"}</span>
              </label>
              <input type="time" value={shift.start} disabled={!shift.working} onChange={e=>updateShift(date,{start:e.target.value})}/>
              <input type="time" value={shift.end} disabled={!shift.working} onChange={e=>updateShift(date,{end:e.target.value})}/>
            </div>
          })}
        </div>
      </section>
    </div>
  </div>;
}
