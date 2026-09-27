"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { casts as defaultCasts } from "@/lib/mock-data";
import { loadCasts, saveCasts } from "@/lib/storage";
import type { Cast, CastStatus } from "@/lib/types";

const statusLabels:Record<CastStatus,string> = {
  waiting:"待機", moving:"移動中", serving:"接客中", off:"退勤"
};

const optionChoices = ["オプションA","オプションB","オプションC","オプションD"];

function formatPrice(value:number){
  return new Intl.NumberFormat("ja-JP").format(value);
}

export default function CastsPage(){
  const [casts,setCasts] = useState<Cast[]>(
    defaultCasts.map(c=>({
      ...c,
      scheduledToday:true,
      visible:true,
      unitPrice:c.unitPrice??0,
      ngDetails:c.ngDetails??"",
      availableOptions:c.availableOptions??[],
      notes:c.notes??""
    }))
  );
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

  function toggleOption(cast:Cast, option:string){
    const current = cast.availableOptions ?? [];
    const next = current.includes(option)
      ? current.filter(item=>item!==option)
      : [...current,option];
    patch(cast.id,{availableOptions:next});
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
      unitPrice:Number(fd.get("unitPrice")||0),
      ngDetails:"",
      availableOptions:[],
      notes:"",
      scheduledToday:true,
      visible:true
    }];
    commit(next);
    e.currentTarget.reset();
  }

  return <div className="castManagementPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">CAST MANAGEMENT</p>
        <h1>キャスト登録</h1>
        <p>出勤情報だけでなく、受付時に必要な単価・NG・可能オプション・備考までキャストごとに管理します。</p>
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
      <form onSubmit={addCast} className="addCastForm addCastFormWide">
        <label>源氏名<input name="name" required placeholder="例：サンプルE"/></label>
        <label>単価<input name="unitPrice" type="number" min="0" step="500" defaultValue="5000"/></label>
        <label>出勤<input name="shiftStart" type="time" defaultValue="18:00"/></label>
        <label>上り<input name="shiftEnd" type="time" defaultValue="04:00"/></label>
        <button className="primaryButton" type="submit">＋ 追加</button>
      </form>
    </section>

    <section className="castList">
      {casts.map(cast=><article key={cast.id} className={`castManageCard castProfileCard ${cast.visible===false?"isHidden":""}`}>
        <div className="castManageMain">
          <div className="castNameEdit">
            <span className={`castStateDot ${cast.status}`}/>
            <input value={cast.name} onChange={e=>patch(cast.id,{name:e.target.value})}/>
          </div>

          <div className="castPriceBox">
            <small>単価</small>
            <strong>{formatPrice(cast.unitPrice??0)}円</strong>
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

        <div className="castEditGrid castBasicGrid">
          <label>単価
            <input
              type="number"
              min="0"
              step="500"
              value={cast.unitPrice??0}
              onChange={e=>patch(cast.id,{unitPrice:Number(e.target.value)})}
            />
          </label>
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

        <div className="castOperationalSection">
          <div className="castOperationalHeading">
            <strong>受付用情報</strong>
            <span>受付時に確認する内容</span>
          </div>

          <div className="castOperationalGrid">
            <label className="castNgField">NG内容
              <textarea
                rows={4}
                value={cast.ngDetails??""}
                onChange={e=>patch(cast.id,{ngDetails:e.target.value})}
                placeholder="例：サンプルNG内容"
              />
            </label>

            <div className="castOptionField">
              <span>可能オプション</span>
              <div className="castOptionChoices">
                {optionChoices.map(option=>{
                  const checked=(cast.availableOptions??[]).includes(option);
                  return <label key={option} className={`castOptionChip ${checked?"active":""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={()=>toggleOption(cast,option)}
                    />
                    <span>{option}</span>
                  </label>
                })}
              </div>
            </div>

            <label className="castNotesField">備考
              <textarea
                rows={4}
                value={cast.notes??""}
                onChange={e=>patch(cast.id,{notes:e.target.value})}
                placeholder="受付・配車時に共有したい内容"
              />
            </label>
          </div>
        </div>
      </article>)}
    </section>
  </div>
}
