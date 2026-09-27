"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { casts as defaultCasts } from "@/lib/mock-data";
import { loadCasts, saveCasts } from "@/lib/storage";
import type { Cast, CastStatus } from "@/lib/types";

const statusLabels:Record<CastStatus,string> = {
  waiting:"待機", moving:"移動中", serving:"接客中", off:"退勤"
};

export default function CastsPage(){
  const [casts,setCasts] = useState<Cast[]>(defaultCasts.map(c=>({...c,scheduledToday:true,visible:true})));
  const [saved,setSaved] = useState(false);

  useEffect(()=>setCasts(loadCasts(defaultCasts)),[]);

  const todayCount = useMemo(()=>casts.filter(c=>c.visible!==false && c.scheduledToday!==false).length,[casts]);
  const waitingCount = useMemo(()=>casts.filter(c=>c.visible!==false && c.scheduledToday!==false && c.status==="waiting").length,[casts]);

  function commit(next:Cast[]){
    setCasts(next);
    saveCasts(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function patch(id:string,changes:Partial<Cast>){
    commit(casts.map(c=>c.id===id?{...c,...changes}:c));
  }

  function addCast(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    if(!name) return;
    const next:Cast[]=[...casts,{
      id:crypto.randomUUID(),
      name,
      status:"waiting",
      shiftStart:String(fd.get("shiftStart")||"18:00"),
      shiftEnd:String(fd.get("shiftEnd")||"04:00"),
      scheduledToday:true,
      visible:true
    }];
    commit(next);
    e.currentTarget.reset();
  }

  return <div>
    <header className="pageHeader">
      <div>
        <p className="eyebrow">CAST MANAGEMENT</p>
        <h1>キャスト管理</h1>
        <p>本日の出勤と状態を変更すると、配車ボードと新規受付へすぐ反映されます。</p>
      </div>
      {saved && <span className="saveToast">保存しました</span>}
    </header>

    <section className="castSummary">
      <div><span>登録</span><strong>{casts.filter(c=>c.visible!==false).length}</strong><small>人</small></div>
      <div><span>本日出勤</span><strong>{todayCount}</strong><small>人</small></div>
      <div><span>待機</span><strong>{waitingCount}</strong><small>人</small></div>
    </section>

    <section className="panel addCastPanel">
      <div>
        <p className="eyebrow">ADD CAST</p>
        <h2>キャスト追加</h2>
      </div>
      <form onSubmit={addCast} className="addCastForm">
        <label>源氏名<input name="name" required placeholder="例：サンプルE"/></label>
        <label>出勤<input name="shiftStart" type="time" defaultValue="18:00"/></label>
        <label>上り<input name="shiftEnd" type="time" defaultValue="04:00"/></label>
        <button className="primaryButton" type="submit">＋ 追加</button>
      </form>
    </section>

    <section className="castList">
      {casts.map(cast=><article key={cast.id} className={`castManageCard ${cast.visible===false?"isHidden":""}`}>
        <div className="castManageMain">
          <div className="castNameEdit">
            <span className={`castStateDot ${cast.status}`}/>
            <input value={cast.name} onChange={e=>patch(cast.id,{name:e.target.value})}/>
          </div>
          <div className="castFlags">
            <label className="switchLabel">
              <input type="checkbox" checked={cast.scheduledToday!==false} onChange={e=>patch(cast.id,{scheduledToday:e.target.checked})}/>
              <span>本日出勤</span>
            </label>
            <label className="switchLabel">
              <input type="checkbox" checked={cast.visible!==false} onChange={e=>patch(cast.id,{visible:e.target.checked})}/>
              <span>表示</span>
            </label>
          </div>
        </div>

        <div className="castEditGrid">
          <label>出勤
            <input type="time" value={cast.shiftStart??"18:00"} onChange={e=>patch(cast.id,{shiftStart:e.target.value})}/>
          </label>
          <label>上り
            <input type="time" value={cast.shiftEnd??"04:00"} onChange={e=>patch(cast.id,{shiftEnd:e.target.value})}/>
          </label>
          <label>現在の状態
            <select value={cast.status} onChange={e=>patch(cast.id,{status:e.target.value as CastStatus})}>
              {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="castQuickActions">
            <span>クイック変更</span>
            <div>
              <button type="button" onClick={()=>patch(cast.id,{status:"waiting"})}>待機</button>
              <button type="button" onClick={()=>patch(cast.id,{status:"moving"})}>移動</button>
              <button type="button" onClick={()=>patch(cast.id,{status:"serving"})}>接客</button>
              <button type="button" onClick={()=>patch(cast.id,{status:"off"})}>退勤</button>
            </div>
          </div>
        </div>
      </article>)}
    </section>
  </div>
}
