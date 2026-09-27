"use client";

import { FormEvent, useEffect, useState } from "react";
import { options as defaultOptions } from "@/lib/mock-data";
import { loadOptions, saveOptions } from "@/lib/storage";
import type { StoreOption } from "@/lib/types";

function cloneOption(option:StoreOption):StoreOption{
  return {...option};
}

export default function OptionsPage(){
  const [options,setOptions]=useState<StoreOption[]>(defaultOptions);
  const [isEditing,setIsEditing]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,StoreOption>>({});
  const [addOpen,setAddOpen]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>setOptions(loadOptions(defaultOptions)),[]);

  function commit(next:StoreOption[]){
    setOptions(next);
    saveOptions(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function startEdit(){
    setDrafts(Object.fromEntries(options.map(option=>[option.id,cloneOption(option)])));
    setIsEditing(true);
  }

  function updateDraft(id:string,changes:Partial<StoreOption>){
    setDrafts(prev=>{
      const base=prev[id] ?? cloneOption(options.find(o=>o.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=options.map(option=>drafts[option.id]?cloneOption(drafts[option.id]):option);
    commit(next);
    setIsEditing(false);
    setDrafts({});
  }

  function addOption(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    if(!name) return;

    const option:StoreOption={
      id:crypto.randomUUID(),
      name,
      price:Number(fd.get("price")||0),
      notes:String(fd.get("notes")||"").trim(),
      active:true
    };

    commit([...options,option]);
    e.currentTarget.reset();
    setAddOpen(false);
  }

  return <div className="optionManagementPage">
    <header className="pageHeader optionRegistryHeader">
      <div>
        <p className="eyebrow">OPTION MANAGEMENT</p>
        <h1>オプション管理</h1>
        <p>受付で使用するオプション名と料金を管理します。料金0円で無料オプションとして登録できます。</p>
      </div>
      <div className="optionHeaderActions masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
        <button className="primaryButton" type="button" onClick={()=>setAddOpen(true)}>＋ オプション追加</button>
      </div>
    </header>

    <section className="optionSummary">
      <div><span>登録</span><strong>{options.length}</strong><small>件</small></div>
      <div><span>有効</span><strong>{options.filter(o=>o.active!==false).length}</strong><small>件</small></div>
      <div><span>無料</span><strong>{options.filter(o=>o.active!==false && o.price===0).length}</strong><small>件</small></div>
    </section>

    <section className="optionCardGrid">
      {options.map(option=>{
        const current=isEditing ? (drafts[option.id]??option) : option;

        return <article key={option.id} className={`optionCard ${current.active===false?"isInactive":""} ${isEditing?"isEditing":""}`}>
          <div className="optionCardHeader">
            <div>
              <strong>{current.name}</strong>
              <small>{current.price===0?"無料":new Intl.NumberFormat("ja-JP").format(current.price)+"円"}</small>
            </div>
            <label className="switchLabel">
              <input
                type="checkbox"
                checked={current.active!==false}
                disabled={!isEditing}
                onChange={e=>updateDraft(option.id,{active:e.target.checked})}
              />
              <span>有効</span>
            </label>
          </div>

          <div className="optionCardBody">
            <label>オプション名
              <input value={current.name} disabled={!isEditing}
                onChange={e=>updateDraft(option.id,{name:e.target.value})}/>
            </label>

            <label>料金
              <div className="optionPriceInput">
                <input type="number" min="0" step="500" value={current.price} disabled={!isEditing}
                  onChange={e=>updateDraft(option.id,{price:Number(e.target.value)})}/>
                <span>円</span>
              </div>
            </label>

            <label>備考
              <textarea rows={4} value={current.notes??""} disabled={!isEditing}
                onChange={e=>updateDraft(option.id,{notes:e.target.value})}
                placeholder="オプションに関するメモ"/>
            </label>
          </div>

        </article>
      })}
    </section>

    {addOpen && <div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setAddOpen(false);}}>
      <div className="optionAddModal" role="dialog" aria-modal="true" aria-labelledby="option-add-title">
        <div className="castAddModalHeader">
          <div>
            <p className="eyebrow">ADD OPTION</p>
            <h2 id="option-add-title">オプション追加</h2>
          </div>
          <button className="castModalClose" type="button" onClick={()=>setAddOpen(false)}>×</button>
        </div>

        <form className="optionAddForm" onSubmit={addOption}>
          <label>オプション名
            <input name="name" required autoFocus placeholder="例：オプションE"/>
          </label>

          <label>料金
            <input name="price" type="number" min="0" step="500" defaultValue="1000"/>
          </label>

          <label>備考
            <textarea name="notes" rows={4} placeholder="オプションに関するメモ"/>
          </label>

          <div className="optionFreeHint">無料オプションにする場合は料金を「0円」にしてください。</div>

          <div className="castAddModalActions">
            <button type="button" className="secondaryButton" onClick={()=>setAddOpen(false)}>キャンセル</button>
            <button type="submit" className="primaryButton">オプションを登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
