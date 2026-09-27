"use client";

import { useEffect, useState } from "react";
import { defaultPricingConfig } from "@/lib/mock-data";
import { loadPricing, savePricing } from "@/lib/storage";
import type { PricingConfig } from "@/lib/types";

function clonePricing(pricing:PricingConfig):PricingConfig{
  return {...pricing,courses:pricing.courses.map(course=>({...course}))};
}

export default function PricingPage(){
  const [pricing,setPricing]=useState<PricingConfig>(defaultPricingConfig);
  const [draft,setDraft]=useState<PricingConfig>(clonePricing(defaultPricingConfig));
  const [isEditing,setIsEditing]=useState(false);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const loaded=loadPricing(defaultPricingConfig);
    setPricing(loaded);
    setDraft(clonePricing(loaded));
  },[]);

  function startEdit(){
    setDraft(clonePricing(pricing));
    setIsEditing(true);
  }

  function saveAll(){
    savePricing(draft);
    setPricing(clonePricing(draft));
    setIsEditing(false);
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1200);
  }

  function patch(changes:Partial<PricingConfig>){
    setDraft(current=>({...current,...changes}));
  }

  function patchCourse(id:string,changes:{minutes?:number;price?:number}){
    setDraft(current=>({
      ...current,
      courses:current.courses.map(course=>course.id===id?{...course,...changes}:course)
    }));
  }

  function addCourse(){
    if(!isEditing) return;
    const max=Math.max(0,...draft.courses.map(course=>course.minutes));
    const minutes=max?max+30:60;
    setDraft(current=>({
      ...current,
      courses:[...current.courses,{id:crypto.randomUUID(),minutes,price:0}]
    }));
  }

  function removeCourse(id:string){
    if(!isEditing) return;
    setDraft(current=>({...current,courses:current.courses.filter(course=>course.id!==id)}));
  }

  const current=isEditing?draft:pricing;

  return <div className="pricingManagementPage">
    <header className="pageHeader pricingRegistryHeader">
      <div>
        <p className="eyebrow">PRICING</p>
        <h1>料金登録</h1>
        <p>コース料金、指名料、交通費、延長料金を設定します。</p>
      </div>
      <div className="pricingHeaderActions masterPageActions">
        {saved&&<span className="saveToast">保存しました</span>}
        <button className="masterEditButton" type="button" disabled={isEditing} onClick={startEdit}>編集</button>
        <button className="masterSaveButton" type="button" disabled={!isEditing} onClick={saveAll}>保存</button>
      </div>
    </header>

    <section className="pricingSection panel">
      <div className="pricingSectionHead">
        <div><h2>コース料金</h2><p>受付で選択する基本コース</p></div>
        <button className="secondaryButton" type="button" disabled={!isEditing} onClick={addCourse}>＋ コース追加</button>
      </div>

      <div className="pricingCourseGrid">
        {current.courses.map(course=><article className={`pricingCourseCard ${isEditing?"isEditing":""}`} key={course.id}>
          <label>時間
            <div className="pricingUnitInput">
              <input type="number" min="10" step="10" disabled={!isEditing} value={course.minutes}
                onChange={e=>patchCourse(course.id,{minutes:Number(e.target.value)})}/>
              <span>分</span>
            </div>
          </label>
          <label>料金
            <div className="pricingUnitInput">
              <input type="number" min="0" step="500" disabled={!isEditing} value={course.price}
                onChange={e=>patchCourse(course.id,{price:Number(e.target.value)})}/>
              <span>円</span>
            </div>
          </label>
          {isEditing&&current.courses.length>1&&<button className="pricingRemoveButton" type="button" onClick={()=>removeCourse(course.id)}>削除</button>}
        </article>)}
      </div>
    </section>

    <section className="pricingSection panel">
      <div className="pricingSectionHead"><div><h2>追加料金</h2><p>指名・交通費・延長の初期設定</p></div></div>
      <div className="pricingSettingsGrid">
        <label>写真指名料
          <div className="pricingUnitInput"><input type="number" min="0" step="500" disabled={!isEditing} value={current.photoNominationFee}
            onChange={e=>patch({photoNominationFee:Number(e.target.value)})}/><span>円</span></div>
        </label>
        <label>本指名料
          <div className="pricingUnitInput"><input type="number" min="0" step="500" disabled={!isEditing} value={current.repeatNominationFee}
            onChange={e=>patch({repeatNominationFee:Number(e.target.value)})}/><span>円</span></div>
        </label>
        <label>基本交通費
          <div className="pricingUnitInput"><input type="number" min="0" step="500" disabled={!isEditing} value={current.defaultTravelFee}
            onChange={e=>patch({defaultTravelFee:Number(e.target.value)})}/><span>円</span></div>
        </label>
        <label>延長時間
          <div className="pricingUnitInput"><input type="number" min="1" step="5" disabled={!isEditing} value={current.extensionMinutes}
            onChange={e=>patch({extensionMinutes:Number(e.target.value)})}/><span>分</span></div>
        </label>
        <label>延長料金
          <div className="pricingUnitInput"><input type="number" min="0" step="500" disabled={!isEditing} value={current.extensionPrice}
            onChange={e=>patch({extensionPrice:Number(e.target.value)})}/><span>円</span></div>
        </label>
      </div>
    </section>
  </div>
}