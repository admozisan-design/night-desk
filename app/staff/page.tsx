"use client";

import { FormEvent, useEffect, useState } from "react";
import { staff as defaultStaff } from "@/lib/mock-data";
import { loadStaff, saveStaff } from "@/lib/storage";
import type { Staff } from "@/lib/types";

const areas=["エリアA","エリアB","エリアC","エリアD","エリアE","エリアF"];
const shops=["サンプル店舗A","サンプル店舗B","サンプル店舗C"];

function cloneStaff(staff:Staff):Staff{
  return {...staff};
}

export default function StaffPage(){
  const [staff,setStaff]=useState<Staff[]>(defaultStaff);
  const [editing,setEditing]=useState<Record<string,boolean>>({});
  const [drafts,setDrafts]=useState<Record<string,Staff>>({});
  const [addOpen,setAddOpen]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>setStaff(loadStaff(defaultStaff)),[]);

  function commit(next:Staff[]){
    setStaff(next);
    saveStaff(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function startEdit(item:Staff){
    setDrafts(prev=>({...prev,[item.id]:cloneStaff(item)}));
    setEditing(prev=>({...prev,[item.id]:true}));
  }

  function updateDraft(id:string,changes:Partial<Staff>){
    setDrafts(prev=>{
      const base=prev[id] ?? cloneStaff(staff.find(s=>s.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveCard(id:string){
    const draft=drafts[id];
    if(!draft) return;
    commit(staff.map(item=>item.id===id?cloneStaff(draft):item));
    setEditing(prev=>({...prev,[id]:false}));
    setDrafts(prev=>{
      const next={...prev};
      delete next[id];
      return next;
    });
  }

  function addStaff(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    const displayName=String(fd.get("displayName")||"").trim();
    const loginId=String(fd.get("loginId")||"").trim();
    if(!name || !displayName || !loginId) return;

    const item:Staff={
      id:crypto.randomUUID(),
      name,
      displayName,
      loginId,
      shop:String(fd.get("shop")||"サンプル店舗A"),
      area:String(fd.get("area")||"エリアA"),
      notes:String(fd.get("notes")||"").trim(),
      active:true
    };

    commit([...staff,item]);
    e.currentTarget.reset();
    setAddOpen(false);
  }

  return <div className="staffManagementPage">
    <header className="pageHeader staffRegistryHeader">
      <div>
        <p className="eyebrow">STAFF MANAGEMENT</p>
        <h1>スタッフ登録</h1>
        <p>フロントスタッフの基本情報を管理します。</p>
      </div>
      <div className="staffHeaderActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button className="primaryButton" type="button" onClick={()=>setAddOpen(true)}>＋ スタッフ追加</button>
      </div>
    </header>

    <section className="staffSummary">
      <div><span>登録</span><strong>{staff.length}</strong><small>人</small></div>
      <div><span>有効</span><strong>{staff.filter(s=>s.active!==false).length}</strong><small>人</small></div>
    </section>

    <section className="staffCardGrid">
      {staff.map(item=>{
        const isEditing=!!editing[item.id];
        const current=isEditing ? (drafts[item.id]??item) : item;

        return <article key={item.id} className={`staffCard ${current.active===false?"isInactive":""} ${isEditing?"isEditing":""}`}>
          <div className="staffCardHeader">
            <div>
              <strong>{current.displayName || current.name}</strong>
              <small>{current.name}</small>
            </div>
            <label className="switchLabel">
              <input
                type="checkbox"
                checked={current.active!==false}
                disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{active:e.target.checked})}
              />
              <span>有効</span>
            </label>
          </div>

          <div className="staffCardBody">
            <label>スタッフ名
              <input value={current.name} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{name:e.target.value})}/>
            </label>

            <label>フロント表示名
              <input value={current.displayName} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{displayName:e.target.value})}/>
            </label>

            <label>ログインID
              <input value={current.loginId} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{loginId:e.target.value})}/>
            </label>

            <label>所属店舗
              <select value={current.shop} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{shop:e.target.value})}>
                {shops.map(shop=><option key={shop}>{shop}</option>)}
              </select>
            </label>

            <label>担当エリア
              <select value={current.area} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{area:e.target.value})}>
                {areas.map(area=><option key={area}>{area}</option>)}
              </select>
            </label>

            <label>備考
              <textarea rows={4} value={current.notes??""} disabled={!isEditing}
                onChange={e=>updateDraft(item.id,{notes:e.target.value})}
                placeholder="スタッフに関するメモ"/>
            </label>
          </div>

          <div className="staffCardActions">
            <button type="button" className="castEditButton" disabled={isEditing} onClick={()=>startEdit(item)}>編集</button>
            <button type="button" className="castSaveButton" disabled={!isEditing} onClick={()=>saveCard(item.id)}>保存</button>
          </div>
        </article>
      })}
    </section>

    {addOpen && <div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false);}}>
      <div className="staffAddModal" role="dialog" aria-modal="true" aria-labelledby="staff-add-title">
        <div className="castAddModalHeader">
          <div>
            <p className="eyebrow">ADD STAFF</p>
            <h2 id="staff-add-title">スタッフ追加</h2>
          </div>
          <button className="castModalClose" type="button" onClick={()=>setAddOpen(false)}>×</button>
        </div>

        <form className="staffAddForm" onSubmit={addStaff}>
          <label>スタッフ名
            <input name="name" required autoFocus placeholder="例：スタッフD"/>
          </label>

          <label>フロント表示名
            <input name="displayName" required placeholder="例：フロントD"/>
          </label>

          <label>ログインID
            <input name="loginId" required placeholder="例：staff-d"/>
          </label>

          <label>所属店舗
            <select name="shop" defaultValue="サンプル店舗A">
              {shops.map(shop=><option key={shop}>{shop}</option>)}
            </select>
          </label>

          <label>担当エリア
            <select name="area" defaultValue="エリアA">
              {areas.map(area=><option key={area}>{area}</option>)}
            </select>
          </label>

          <label>備考
            <textarea name="notes" rows={4} placeholder="スタッフに関するメモ"/>
          </label>

          <div className="castAddModalActions">
            <button type="button" className="secondaryButton" onClick={()=>setAddOpen(false)}>キャンセル</button>
            <button type="submit" className="primaryButton">スタッフを登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
