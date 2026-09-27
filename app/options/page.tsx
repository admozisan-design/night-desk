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
  const [editing,setEditing]=useState<Record<string,boolean>>({});
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

  function startEdit(option:StoreOption){
    setDrafts(prev=>({...prev,[option.id]:cloneOption(option)}));
    setEditing(prev=>({...prev,[option.id]:true}));
  }

  function updateDraft(id:string,changes:Partial<StoreOption>){
    setDrafts(prev=>{
      const base=prev[id] ?? cloneOption(options.find(o=>o.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveCard(id:string){
    const draft=drafts[id];
    if(!draft) return;
    commit(options.map(option=>option.id===id?cloneOption(draft):option));
    setEditing(prev=>({...prev,[id]:false}));
    setDrafts(prev=>{
      const next={...prev};
      delete next[id];
      return next;
    });
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
      <div className="optionHeaderActions">
        {saved && <span className="saveToast">保存しました</span>}
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
        const isEditing=!!editing[option.id];
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

          <div className="optionCardActions">
            <button type="button" className="castEditButton" disabled={isEditing} onClick={()=>startEdit(option)}>編集</button>
            <button type="button" className="castSaveButton" disabled={!isEditing} onClick={()=>saveCard(option.id)}>保存</button>
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
