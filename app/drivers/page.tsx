"use client";

import { FormEvent, useEffect, useState } from "react";
import { drivers as defaultDrivers } from "@/lib/mock-data";
import { loadDrivers, saveDrivers } from "@/lib/storage";
import type { Driver } from "@/lib/types";

function cloneDriver(driver:Driver):Driver{
  return {...driver};
}

export default function DriversPage(){
  const [drivers,setDrivers]=useState<Driver[]>(defaultDrivers);
  const [isEditing,setIsEditing]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,Driver>>({});
  const [addOpen,setAddOpen]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>setDrivers(loadDrivers(defaultDrivers)),[]);

  function commit(next:Driver[]){
    setDrivers(next);
    saveDrivers(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function startEdit(){
    setDrafts(Object.fromEntries(drivers.map(driver=>[driver.id,cloneDriver(driver)])));
    setIsEditing(true);
  }

  function updateDraft(id:string,changes:Partial<Driver>){
    setDrafts(prev=>{
      const base=prev[id] ?? cloneDriver(drivers.find(d=>d.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=drivers.map(driver=>drafts[driver.id]?cloneDriver(drafts[driver.id]):driver);
    commit(next);
    setIsEditing(false);
    setDrafts({});
  }

  function addDriver(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    if(!name) return;

    const driver:Driver={
      id:crypto.randomUUID(),
      name,
      phone:String(fd.get("phone")||"").trim(),
      email:String(fd.get("email")||"").trim(),
      lineUrl:String(fd.get("lineUrl")||"").trim(),
      vehicle:String(fd.get("vehicle")||"").trim(),
      plate:String(fd.get("plate")||"").trim(),
      notes:String(fd.get("notes")||"").trim(),
      active:true
    };

    commit([...drivers,driver]);
    e.currentTarget.reset();
    setAddOpen(false);
  }

  return <div className="driverManagementPage">
    <header className="pageHeader driverRegistryHeader">
      <div>
        <p className="eyebrow">DRIVER MANAGEMENT</p>
        <h1>ドライバー登録</h1>
        <p>送迎ドライバーの基本情報と、メール・LINEの連絡先を管理します。</p>
      </div>
      <div className="driverHeaderActions masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
        <button className="primaryButton" type="button" onClick={()=>setAddOpen(true)}>＋ ドライバー追加</button>
      </div>
    </header>

    <section className="driverSummary">
      <div><span>登録</span><strong>{drivers.length}</strong><small>人</small></div>
      <div><span>有効</span><strong>{drivers.filter(d=>d.active!==false).length}</strong><small>人</small></div>
    </section>

    <section className="driverCardGrid">
      {drivers.map(driver=>{
        const current=isEditing ? (drafts[driver.id]??driver) : driver;

        return <article key={driver.id} className={`driverCard ${current.active===false?"isInactive":""} ${isEditing?"isEditing":""}`}>
          <div className="driverCardHeader">
            <strong>{current.name}</strong>
            <label className="switchLabel">
              <input
                type="checkbox"
                checked={current.active!==false}
                disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{active:e.target.checked})}
              />
              <span>有効</span>
            </label>
          </div>

          <div className="driverCardBody">
            <label>ドライバー名
              <input value={current.name} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{name:e.target.value})}/>
            </label>

            <label>電話番号
              <input value={current.phone??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{phone:e.target.value})}
                placeholder="090-0000-0000"/>
            </label>

            <label>メールアドレス
              <input type="email" value={current.email??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{email:e.target.value})}
                placeholder="driver@example.com"/>
            </label>

            <label>LINEリンク
              <input type="url" value={current.lineUrl??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{lineUrl:e.target.value})}
                placeholder="https://line.me/..."/>
            </label>

            <label>車両名
              <input value={current.vehicle??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{vehicle:e.target.value})}
                placeholder="例：プリウス"/>
            </label>

            <label>ナンバー
              <input value={current.plate??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{plate:e.target.value})}
                placeholder="例：12-34"/>
            </label>

            <label>備考
              <textarea rows={4} value={current.notes??""} disabled={!isEditing}
                onChange={e=>updateDraft(driver.id,{notes:e.target.value})}
                placeholder="ドライバーに関するメモ"/>
            </label>
          </div>

        </article>
      })}
    </section>

    {addOpen && <div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false);}}>
      <div className="driverAddModal" role="dialog" aria-modal="true" aria-labelledby="driver-add-title">
        <div className="castAddModalHeader">
          <div>
            <p className="eyebrow">ADD DRIVER</p>
            <h2 id="driver-add-title">ドライバー追加</h2>
          </div>
          <button className="castModalClose" type="button" onClick={()=>setAddOpen(false)}>×</button>
        </div>

        <form className="driverAddForm" onSubmit={addDriver}>
          <label>ドライバー名
            <input name="name" required autoFocus placeholder="例：ドライバー04"/>
          </label>

          <label>電話番号
            <input name="phone" inputMode="tel" placeholder="090-0000-0000"/>
          </label>

          <label>メールアドレス
            <input name="email" type="email" placeholder="driver@example.com"/>
          </label>

          <label>LINEリンク
            <input name="lineUrl" type="url" placeholder="https://line.me/..."/>
          </label>

          <label>車両名
            <input name="vehicle" placeholder="例：プリウス"/>
          </label>

          <label>ナンバー
            <input name="plate" placeholder="例：12-34"/>
          </label>

          <label>備考
            <textarea name="notes" rows={4} placeholder="ドライバーに関するメモ"/>
          </label>

          <div className="castAddModalActions">
            <button type="button" className="secondaryButton" onClick={()=>setAddOpen(false)}>キャンセル</button>
            <button type="submit" className="primaryButton">ドライバーを登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
