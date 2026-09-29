"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { casts as defaultCasts, options as defaultOptions } from "@/lib/mock-data";
import { loadCasts, loadOptions, saveCasts } from "@/lib/storage";
import type { Cast, StoreOption } from "@/lib/types";

function cloneCast(cast:Cast):Cast{
  return {
    ...cast,
    ngDetails:[...(cast.ngDetails??[])],
    availableOptions:[...(cast.availableOptions??[])]
  };
}

export default function CastsPage(){
  const [casts,setCasts] = useState<Cast[]>(
    defaultCasts.map(c=>({
      ...c,
      visible:true,
      freeUnitPrice:c.freeUnitPrice??c.unitPrice??0,
      photoUnitPrice:c.photoUnitPrice??c.unitPrice??0,
      repeatUnitPrice:c.repeatUnitPrice??c.unitPrice??0,
      ngDetails:c.ngDetails??[],
      availableOptions:c.availableOptions??[],
      notes:c.notes??"",
      advertisingUrl:c.advertisingUrl??"",
      interviewEvaluation:c.interviewEvaluation??"",
      age:c.age??0,
      heightCm:c.heightCm??0,
      bustCm:c.bustCm??0,
      waistCm:c.waistCm??0,
      hipCm:c.hipCm??0,
      cupSize:c.cupSize??""
    }))
  );
  const [optionList,setOptionList] = useState<StoreOption[]>(defaultOptions);
  const [isEditing,setIsEditing] = useState(false);
  const [drafts,setDrafts] = useState<Record<string,Cast>>({});
  const [ngDrafts,setNgDrafts] = useState<Record<string,string>>({});
  const [saved,setSaved] = useState(false);
  const [addOpen,setAddOpen] = useState(false);
  const [newNgDraft,setNewNgDraft] = useState("");
  const [newNgItems,setNewNgItems] = useState<string[]>([]);
  const [newOptions,setNewOptions] = useState<string[]>([]);
  const [expandedCastIds,setExpandedCastIds] = useState<string[]>([]);

  useEffect(()=>{
    const refresh=()=>{
      setCasts(loadCasts(defaultCasts));
      setOptionList(loadOptions(defaultOptions));
    };
    refresh();
    window.addEventListener("nightdesk:options",refresh);
    return ()=>window.removeEventListener("nightdesk:options",refresh);
  },[]);

  const optionChoices=optionList.filter(option=>option.active!==false).map(option=>option.name);

  function commit(next:Cast[]){
    setCasts(next);
    saveCasts(next);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function startEdit(){
    setDrafts(Object.fromEntries(casts.map(cast=>[cast.id,cloneCast(cast)])));
    setIsEditing(true);
  }

  function updateDraft(id:string,changes:Partial<Cast>){
    setDrafts(prev=>{
      const base=prev[id] ?? cloneCast(casts.find(c=>c.id===id)!);
      return {...prev,[id]:{...base,...changes}};
    });
  }

  function saveAll(){
    const next=casts.map(cast=>drafts[cast.id]?cloneCast(drafts[cast.id]):cast);
    commit(next);
    setIsEditing(false);
    setDrafts({});
    setNgDrafts({});
  }

  function toggleOption(cast:Cast, option:string){
    if(!isEditing) return;
    const current = cast.availableOptions ?? [];
    const next = current.includes(option)
      ? current.filter(item=>item!==option)
      : [...current,option];
    updateDraft(cast.id,{availableOptions:next});
  }

  function addNg(cast:Cast){
    if(!isEditing) return;
    const value=(ngDrafts[cast.id]??"").trim();
    if(!value) return;
    const current=cast.ngDetails??[];
    if(current.includes(value)){
      setNgDrafts(prev=>({...prev,[cast.id]:""}));
      return;
    }
    updateDraft(cast.id,{ngDetails:[...current,value]});
    setNgDrafts(prev=>({...prev,[cast.id]:""}));
  }

  function removeNg(cast:Cast, item:string){
    if(!isEditing) return;
    updateDraft(cast.id,{ngDetails:(cast.ngDetails??[]).filter(value=>value!==item)});
  }

  function handleNgKeyDown(e:KeyboardEvent<HTMLInputElement>,cast:Cast){
    if(e.key==="Enter"){
      e.preventDefault();
      addNg(cast);
    }
  }

  function addNewNg(){
    const value=newNgDraft.trim();
    if(!value || newNgItems.includes(value)) {
      setNewNgDraft("");
      return;
    }
    setNewNgItems(prev=>[...prev,value]);
    setNewNgDraft("");
  }

  function toggleNewOption(option:string){
    setNewOptions(prev=>prev.includes(option)
      ? prev.filter(item=>item!==option)
      : [...prev,option]
    );
  }

  function closeAddModal(){
    setAddOpen(false);
    setNewNgDraft("");
    setNewNgItems([]);
    setNewOptions([]);
  }

  function toggleCastExpanded(id:string){
    setExpandedCastIds(current=>current.includes(id)
      ? current.filter(value=>value!==id)
      : [...current,id]
    );
  }

  function addCast(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const name=String(fd.get("name")||"").trim();
    if(!name) return;

    const next:Cast[]=[...casts,{
      id:crypto.randomUUID(),
      name,
      status:"off",
      shiftStart:"18:00",
      shiftEnd:"04:00",
      scheduledToday:false,
      visible:true,
      freeUnitPrice:Number(fd.get("freeUnitPrice")||0),
      photoUnitPrice:Number(fd.get("photoUnitPrice")||0),
      repeatUnitPrice:Number(fd.get("repeatUnitPrice")||0),
      ngDetails:newNgItems,
      availableOptions:newOptions,
      notes:String(fd.get("notes")||"").trim(),
      advertisingUrl:String(fd.get("advertisingUrl")||"").trim(),
      interviewEvaluation:String(fd.get("interviewEvaluation")||"").trim(),
      age:Number(fd.get("age")||0),
      heightCm:Number(fd.get("heightCm")||0),
      bustCm:Number(fd.get("bustCm")||0),
      waistCm:Number(fd.get("waistCm")||0),
      hipCm:Number(fd.get("hipCm")||0),
      cupSize:String(fd.get("cupSize")||"").trim()
    }];

    commit(next);
    e.currentTarget.reset();
    closeAddModal();
  }

  return <div className="castManagementPage">
    <header className="pageHeader castRegistryHeader">
      <div>
        <p className="eyebrow">CAST MANAGEMENT</p>
        <h1>キャスト登録</h1>
        <p>キャストごとの単価、広告サイトURL、スペック、面接評価、NG内容、可能オプション、備考を管理します。</p>
      </div>
      <div className="castHeaderActions masterPageActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
        <button className="primaryButton castAddTrigger" type="button" onClick={()=>setAddOpen(true)}>＋ キャスト追加</button>
      </div>
    </header>

    <section className="castSummary">
      <div><span>登録</span><strong>{casts.length}</strong><small>人</small></div>
      <div><span>表示中</span><strong>{casts.filter(c=>c.visible!==false).length}</strong><small>人</small></div>
    </section>

    <section className="castCardGrid">
      {casts.map(cast=>{
        const current=isEditing ? (drafts[cast.id] ?? cloneCast(cast)) : cast;
        const isExpanded=expandedCastIds.includes(cast.id);

        return <article key={cast.id} className={`castVerticalCard castCompactCard ${isExpanded?"isExpanded":""} ${current.visible===false?"isHidden":""} ${isEditing?"isEditing":""}`}>
          <div className="castVerticalHeader">
            <input
              className="castVerticalName"
              value={current.name}
              disabled={!isEditing}
              onChange={e=>updateDraft(cast.id,{name:e.target.value})}
            />
            <div className="castCardHeaderRight">
              <label className="switchLabel">
                <input
                  type="checkbox"
                  checked={current.visible!==false}
                  disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{visible:e.target.checked})}
                />
                <span>表示</span>
              </label>
              <button type="button" className="castExpandButton" onClick={()=>toggleCastExpanded(cast.id)}>
                {isExpanded?"閉じる":"詳細"}
              </button>
            </div>
          </div>

          <button type="button" className="castCompactSummary" onClick={()=>toggleCastExpanded(cast.id)}>
            <span><small>フリー</small><strong>{new Intl.NumberFormat("ja-JP").format(current.freeUnitPrice??0)}円</strong></span>
            <span><small>写指</small><strong>{new Intl.NumberFormat("ja-JP").format(current.photoUnitPrice??0)}円</strong></span>
            <span><small>本指</small><strong>{new Intl.NumberFormat("ja-JP").format(current.repeatUnitPrice??0)}円</strong></span>
            <span><small>スペック</small><strong>{current.age||"—"}歳 / {current.heightCm||"—"}cm / {current.cupSize||"—"}cup</strong></span>
            <span className={(current.ngDetails??[]).length?"hasAlert":""}><small>NG</small><strong>{(current.ngDetails??[]).length}件</strong></span>
            <span><small>OP</small><strong>{(current.availableOptions??[]).length}件</strong></span>
            <span className={current.advertisingUrl?"hasLink":""}><small>広告</small><strong>{current.advertisingUrl?"登録済":"未登録"}</strong></span>
            <b>{isExpanded?"▲":"▼"}</b>
          </button>

          {isExpanded && <>
          <div className="castVerticalSection">
            <div className="castVerticalSectionTitle">単価設定</div>
            <div className="castVerticalRates">
              <label>フリー
                <input type="number" min="0" step="500" value={current.freeUnitPrice??0} disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{freeUnitPrice:Number(e.target.value)})}/>
              </label>
              <label>写真指名
                <input type="number" min="0" step="500" value={current.photoUnitPrice??0} disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{photoUnitPrice:Number(e.target.value)})}/>
              </label>
              <label>本指名
                <input type="number" min="0" step="500" value={current.repeatUnitPrice??0} disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{repeatUnitPrice:Number(e.target.value)})}/>
              </label>
            </div>
          </div>

          <div className="castVerticalSection">
            <div className="castVerticalSectionTitle">スペック</div>
            <div className="castSpecGrid">
              <label>年齢
                <input type="number" min="18" value={current.age || ""} placeholder="例：26" disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{age:e.target.value===""?0:Number(e.target.value)})}/>
              </label>
              <label>身長
                <div className="castSpecInputUnit"><input type="number" min="0" value={current.heightCm || ""} placeholder="例：158" disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{heightCm:e.target.value===""?0:Number(e.target.value)})}/><span>cm</span></div>
              </label>
              <label>B
                <div className="castSpecInputUnit"><input type="number" min="0" value={current.bustCm || ""} placeholder="例：86" disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{bustCm:e.target.value===""?0:Number(e.target.value)})}/><span>cm</span></div>
              </label>
              <label>W
                <div className="castSpecInputUnit"><input type="number" min="0" value={current.waistCm || ""} placeholder="例：58" disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{waistCm:e.target.value===""?0:Number(e.target.value)})}/><span>cm</span></div>
              </label>
              <label>H
                <div className="castSpecInputUnit"><input type="number" min="0" value={current.hipCm || ""} placeholder="例：85" disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{hipCm:e.target.value===""?0:Number(e.target.value)})}/><span>cm</span></div>
              </label>
              <label>カップ
                <input value={current.cupSize??""} disabled={!isEditing}
                  onChange={e=>updateDraft(cast.id,{cupSize:e.target.value})} placeholder="例：D"/>
              </label>
            </div>
          </div>

          <div className="castVerticalSection">
            <label className="castVerticalField">面接評価
              <textarea rows={4} value={current.interviewEvaluation??""} disabled={!isEditing}
                onChange={e=>updateDraft(cast.id,{interviewEvaluation:e.target.value})}
                placeholder="面接時の印象・接客適性など"/>
            </label>
          </div>

          <div className="castVerticalSection">
            <div className="castVerticalFieldLabel">NG内容</div>
            <div className="castNgTags">
              {(current.ngDetails??[]).map(item=><span key={item} className="castNgTag">
                {item}
                {isEditing && <button type="button" onClick={()=>removeNg(current,item)} aria-label={`${item}を削除`}>×</button>}
              </span>)}
              {(current.ngDetails??[]).length===0 && <span className="castNgEmpty">NG登録なし</span>}
            </div>
            {isEditing && <div className="castNgAddRow">
              <input
                value={ngDrafts[cast.id]??""}
                onChange={e=>setNgDrafts(prev=>({...prev,[cast.id]:e.target.value}))}
                onKeyDown={e=>handleNgKeyDown(e,current)}
                placeholder="NG内容を入力"
              />
              <button type="button" onClick={()=>addNg(current)}>追加</button>
            </div>}
          </div>

          <div className="castVerticalSection">
            <div className="castVerticalFieldLabel">可能オプション</div>
            <div className="castVerticalOptions">
              {optionChoices.map(option=>{
                const checked=(current.availableOptions??[]).includes(option);
                return <label key={option} className={`castOptionChip ${checked?"active":""} ${!isEditing?"isLocked":""}`}>
                  <input type="checkbox" checked={checked} disabled={!isEditing} onChange={()=>toggleOption(current,option)}/>
                  <span>{option}</span>
                </label>
              })}
            </div>
          </div>

          <div className="castVerticalSection">
            <label className="castVerticalField">広告サイトURL
              <input
                type="url"
                value={current.advertisingUrl??""}
                disabled={!isEditing}
                onChange={e=>updateDraft(cast.id,{advertisingUrl:e.target.value})}
                placeholder="https://..."
              />
            </label>
            {!isEditing && current.advertisingUrl && <a className="castAdPreviewLink" href={current.advertisingUrl} target="_blank" rel="noreferrer">広告ページを開く ↗</a>}
          </div>

          <div className="castVerticalSection">
            <label className="castVerticalField">備考
              <textarea rows={4} value={current.notes??""} disabled={!isEditing}
                onChange={e=>updateDraft(cast.id,{notes:e.target.value})}
                placeholder="受付時に共有したい内容"/>
            </label>
          </div>
          </>}
        </article>
      })}
    </section>

    {addOpen && <div className="castModalBackdrop" onMouseDown={e=>{if(e.currentTarget===e.target) closeAddModal();}}>
      <div className="castAddModal" role="dialog" aria-modal="true" aria-labelledby="cast-add-title">
        <div className="castAddModalHeader">
          <div>
            <p className="eyebrow">ADD CAST</p>
            <h2 id="cast-add-title">キャスト追加</h2>
          </div>
          <button type="button" className="castModalClose" onClick={closeAddModal} aria-label="閉じる">×</button>
        </div>

        <form onSubmit={addCast} className="castAddModalForm">
          <label className="castAddFull">源氏名
            <input name="name" required autoFocus placeholder="例：サンプルE"/>
          </label>

          <div className="castAddRates">
            <label>フリー単価
              <input name="freeUnitPrice" type="number" min="0" step="500" defaultValue="5000"/>
            </label>
            <label>写真指名単価
              <input name="photoUnitPrice" type="number" min="0" step="500" defaultValue="6000"/>
            </label>
            <label>本指名単価
              <input name="repeatUnitPrice" type="number" min="0" step="500" defaultValue="7000"/>
            </label>
          </div>

          <div className="castAddField">
            <span>スペック</span>
            <div className="castAddSpecGrid">
              <label>年齢<input name="age" type="number" min="18" placeholder="24"/></label>
              <label>身長<input name="heightCm" type="number" min="0" placeholder="158"/></label>
              <label>B<input name="bustCm" type="number" min="0" placeholder="86"/></label>
              <label>W<input name="waistCm" type="number" min="0" placeholder="58"/></label>
              <label>H<input name="hipCm" type="number" min="0" placeholder="85"/></label>
              <label>カップ<input name="cupSize" placeholder="D"/></label>
            </div>
          </div>

          <label className="castAddFull">面接評価
            <textarea name="interviewEvaluation" rows={4} placeholder="面接時の印象・接客適性など"/>
          </label>

          <div className="castAddField">
            <span>NG内容</span>
            <div className="castNgTags castAddNgTags">
              {newNgItems.map(item=><span key={item} className="castNgTag">
                {item}
                <button type="button" onClick={()=>setNewNgItems(prev=>prev.filter(value=>value!==item))}>×</button>
              </span>)}
              {newNgItems.length===0 && <span className="castNgEmpty">NG登録なし</span>}
            </div>
            <div className="castNgAddRow">
              <input
                value={newNgDraft}
                onChange={e=>setNewNgDraft(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addNewNg();}}}
                placeholder="NG内容を入力"
              />
              <button type="button" onClick={addNewNg}>追加</button>
            </div>
          </div>

          <div className="castAddField">
            <span>可能オプション</span>
            <div className="castVerticalOptions castAddOptions">
              {optionChoices.map(option=>{
                const checked=newOptions.includes(option);
                return <label key={option} className={`castOptionChip ${checked?"active":""}`}>
                  <input type="checkbox" checked={checked} onChange={()=>toggleNewOption(option)}/>
                  <span>{option}</span>
                </label>
              })}
            </div>
          </div>

          <label className="castAddFull">広告サイトURL
            <input name="advertisingUrl" type="url" placeholder="https://..."/>
          </label>

          <label className="castAddFull">備考
            <textarea name="notes" rows={4} placeholder="受付時に共有したい内容"/>
          </label>

          <div className="castAddModalActions">
            <button type="button" className="secondaryButton" onClick={closeAddModal}>キャンセル</button>
            <button type="submit" className="primaryButton">キャストを登録</button>
          </div>
        </form>
      </div>
    </div>}
  </div>
}
