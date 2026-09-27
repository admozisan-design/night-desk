"use client";

import { FormEvent, useEffect, useState } from "react";
import { hotels as defaultHotels } from "@/lib/mock-data";
import { loadHotels, saveHotels } from "@/lib/storage";
import type { Hotel } from "@/lib/types";

export default function HotelsPage(){
  const [hotels,setHotels]=useState<Hotel[]>(defaultHotels);
  const [isEditing,setIsEditing]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,Hotel>>({});
  const [addOpen,setAddOpen]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>setHotels(loadHotels(defaultHotels)),[]);

  function commit(next:Hotel[]){
    setHotels(next);
    saveHotels(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function startEdit(){
    setDrafts(Object.fromEntries(hotels.map(hotel=>[hotel.id,cloneHotel(hotel)])));
    setIsEditing(true);
  }

  function updateDraft(id:string,changes:Partial<Hotel>){
    setDrafts(prev=>{
      const base=prev[id] ?? {...hotels.find(h=>h.id===id)!};
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=hotels.map(hotel=>drafts[hotel.id]?cloneHotel(drafts[hotel.id]):hotel);
    commit(next);
    setIsEditing(false);
    setDrafts({});
  }

  function addHotel(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    if(!name) return;

    const hotel:Hotel={
      id:crypto.randomUUID(),
      name,
      travelFee:Number(fd.get("travelFee")||0),
      visible:true
    };

    commit([...hotels,hotel]);
    e.currentTarget.reset();
    setAddOpen(false);
  }

  return <div className="hotelManagementPage">
    <header className="pageHeader hotelRegistryHeader">
      <div>
        <p className="eyebrow">HOTEL MANAGEMENT</p>
        <h1>ホテル登録</h1>
        <p>ホテル名と交通費を登録します。</p>
      </div>
      <div className="hotelHeaderActions masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
        <button className="primaryButton" type="button" onClick={()=>setAddOpen(true)}>＋ ホテル追加</button>
      </div>
    </header>

    <section className="hotelSummary">
      <div><span>登録</span><strong>{hotels.length}</strong><small>件</small></div>
      <div><span>表示中</span><strong>{hotels.filter(h=>h.visible!==false).length}</strong><small>件</small></div>
    </section>

    <section className="hotelCardGrid">
      {hotels.map(hotel=>{
        const current=isEditing ? (drafts[hotel.id]??hotel) : hotel;

        return <article key={hotel.id} className={`hotelCard ${current.visible===false?"isHidden":""} ${isEditing?"isEditing":""}`}>
          <div className="hotelCardHeader">
            <strong>{current.name}</strong>
            <label className="switchLabel">
              <input
                type="checkbox"
                checked={current.visible!==false}
                disabled={!isEditing}
                onChange={e=>updateDraft(hotel.id,{visible:e.target.checked})}
              />
              <span>表示</span>
            </label>
          </div>

          <div className="hotelCardBody">
            <label>ホテル名
              <input
                value={current.name}
                disabled={!isEditing}
                onChange={e=>updateDraft(hotel.id,{name:e.target.value})}
              />
            </label>

            <label>交通費
              <div className="hotelFeeInput">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={current.travelFee}
                  disabled={!isEditing}
                  onChange={e=>updateDraft(hotel.id,{travelFee:Number(e.target.value)})}
                />
                <span>円</span>
              </div>
            </label>
          </div>

        </article>
      })}
    </section>

    {addOpen && <div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false);}}>
      <div className="hotelAddModal" role="dialog" aria-modal="true" aria-labelledby="hotel-add-title">
        <div className="castAddModalHeader">
          <div>
            <p className="eyebrow">ADD HOTEL</p>
            <h2 id="hotel-add-title">ホテル追加</h2>
          </div>
          <button className="castModalClose" type="button" onClick={()=>setAddOpen(false)}>×</button>
        </div>

        <form className="hotelAddForm" onSubmit={addHotel}>
          <label>ホテル名
            <input name="name" required autoFocus placeholder="例：サンプルホテルE"/>
          </label>          <label>交通費
            <input name="travelFee" type="number" min="0" step="500" defaultValue="1000"/>
          </label>

          <div className="castAddModalActions">
            <button type="button" className="secondaryButton" onClick={()=>setAddOpen(false)}>キャンセル</button>
            <button type="submit" className="primaryButton">ホテルを登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
