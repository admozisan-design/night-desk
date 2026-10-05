"use client";

import { useEffect, useState } from "react";
import { defaultStoreSettings } from "@/lib/mock-data";
import { loadStoreSettings, saveStoreSettings } from "@/lib/storage";

export default function StoreSettingsPage(){
  const [openTime,setOpenTime]=useState(defaultStoreSettings.openTime);
  const [closeTime,setCloseTime]=useState(defaultStoreSettings.closeTime);
  const [cardFeeRate,setCardFeeRate]=useState(defaultStoreSettings.cardFeeRate);
  const [priceUnit,setPriceUnit]=useState(defaultStoreSettings.priceUnit);
  const [miscExpenseMode,setMiscExpenseMode]=useState<"fixed"|"percent">(defaultStoreSettings.miscExpenseMode);
  const [miscExpenseValue,setMiscExpenseValue]=useState(defaultStoreSettings.miscExpenseValue);
  const [changeFee,setChangeFee]=useState(defaultStoreSettings.changeFee);
  const [cancelFee,setCancelFee]=useState(defaultStoreSettings.cancelFee);
  const [bookingBufferMinutes,setBookingBufferMinutes]=useState(defaultStoreSettings.bookingBufferMinutes??15);
  const [dispatchBufferMinutes,setDispatchBufferMinutes]=useState(defaultStoreSettings.dispatchBufferMinutes??30);
  const [discountPresets,setDiscountPresets]=useState<number[]>(defaultStoreSettings.discountPresets??[0]);
  const [surchargePresets,setSurchargePresets]=useState<number[]>(defaultStoreSettings.surchargePresets??[0]);
  const [discountPresetDraft,setDiscountPresetDraft]=useState("");
  const [surchargePresetDraft,setSurchargePresetDraft]=useState("");
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const settings=loadStoreSettings(defaultStoreSettings);
    setOpenTime(settings.openTime);
    setCloseTime(settings.closeTime);
    setCardFeeRate(settings.cardFeeRate ?? 0);
    setPriceUnit(settings.priceUnit ?? 100);
    setMiscExpenseMode(settings.miscExpenseMode ?? "fixed");
    setMiscExpenseValue(settings.miscExpenseValue ?? 0);
    setChangeFee(settings.changeFee ?? 0);
    setCancelFee(settings.cancelFee ?? 0);
    setBookingBufferMinutes(settings.bookingBufferMinutes??15);
    setDispatchBufferMinutes(settings.dispatchBufferMinutes??30);
    setDiscountPresets(settings.discountPresets??[0]);
    setSurchargePresets(settings.surchargePresets??[0]);
  },[]);

  function normalizePresetList(values:number[]){
    return Array.from(new Set([0,...values.map(value=>Math.max(0,Math.round(value)))]))
      .sort((a,b)=>a-b);
  }

  function addPreset(kind:"discount"|"surcharge"){
    const raw=kind==="discount" ? discountPresetDraft : surchargePresetDraft;
    if(raw.trim()==="") return;
    const value=Math.max(0,Number(raw));
    if(!Number.isFinite(value)) return;
    if(kind==="discount"){
      setDiscountPresets(current=>normalizePresetList([...current,value]));
      setDiscountPresetDraft("");
    }else{
      setSurchargePresets(current=>normalizePresetList([...current,value]));
      setSurchargePresetDraft("");
    }
  }

  function removePreset(kind:"discount"|"surcharge",value:number){
    if(value===0) return;
    if(kind==="discount") setDiscountPresets(current=>current.filter(item=>item!==value));
    else setSurchargePresets(current=>current.filter(item=>item!==value));
  }

  function save(){
    saveStoreSettings({
      openTime,closeTime,cardFeeRate,priceUnit,miscExpenseMode,miscExpenseValue,changeFee,cancelFee,
      bookingBufferMinutes,dispatchBufferMinutes,
      discountPresets:normalizePresetList(discountPresets),
      surchargePresets:normalizePresetList(surchargePresets)
    });
    setSaved(true);
    window.setTimeout(()=>setSaved(false),1400);
  }

  return <div className="storeSettingsPage">
    <header className="pageHeader">
      <div>
        <p className="eyebrow">STORE SETTINGS</p>
        <h1>店舗設定</h1>
        <p>店舗全体の営業時間を設定します。</p>
      </div>
      <div className="castScheduleHeaderActions">
        {saved && <span className="saveToast">保存しました</span>}
        <button type="button" className="primaryButton" onClick={save}>保存</button>
      </div>
    </header>

    <section className="deskPanel storeHoursPanel">
      <h2>営業時間</h2>
      <div className="storeHoursGrid">
        <label>営業開始
          <input type="time" value={openTime} onChange={e=>setOpenTime(e.target.value)}/>
        </label>
        <label>営業終了
          <input type="time" value={closeTime} onChange={e=>setCloseTime(e.target.value)}/>
        </label>
      </div>
      <div className="storeHoursNote">
        <strong>キャストの時間とは別設定です</strong>
        <p>店舗営業時間は店全体の営業枠です。キャストごとの「出勤・受付終了・上がり」はキャスト出勤管理から日別に設定できます。</p>
      </div>

      <div className="storePaymentSettings">
        <h3>予約・配車の自動判定</h3>
        <div className="storeChangeCancelGrid">
          <label>予約の前後に確保する移動・準備時間（分）
            <input type="number" min="0" max="180" step="5" value={bookingBufferMinutes}
              onChange={e=>setBookingBufferMinutes(Math.min(180,Math.max(0,Number(e.target.value))))}/>
          </label>
          <label>ドライバーの送迎1件の目安時間（分）
            <input type="number" min="5" max="180" step="5" value={dispatchBufferMinutes}
              onChange={e=>setDispatchBufferMinutes(Math.min(180,Math.max(5,Number(e.target.value))))}/>
          </label>
        </div>
        <p>予約の重複防止と配車候補の判定に使用します。移動時間は目安なので、道路状況や実際の送迎距離も確認してください。</p>
      </div>
      <div className="storePaymentSettings">
        <h3>カード決済</h3>
        <label>カード手数料
          <div className="storePercentInput">
            <input type="number" min="0" step="0.1" value={cardFeeRate} onChange={e=>setCardFeeRate(Math.max(0,Number(e.target.value)))}/>
            <span>%</span>
          </div>
        </label>
        <p>仕事登録で「カード」を選択した場合、この料率で手数料を自動加算します。</p>
      </div>

      <div className="storePaymentSettings">
        <h3>金額単位</h3>
        <label>店舗の金額刻み
          <select value={priceUnit} onChange={e=>setPriceUnit(Number(e.target.value) as 10|100|500|1000)}>
            <option value={10}>10円単位</option>
            <option value={100}>100円単位</option>
            <option value={500}>500円単位</option>
            <option value={1000}>1,000円単位</option>
          </select>
        </label>
        <p>割引・割増などの入力刻みと、カード手数料の端数処理に使用します。</p>
      </div>

      <div className="storePaymentSettings storePresetSettings">
        <h3>割引・割増プリセット</h3>
        <p>仕事登録でよく使う金額を登録しておくと、プルダウンからすぐ選べます。0円は常に表示されます。</p>
        <div className="storePresetGrid">
          <div className="storePresetBox">
            <strong>割引</strong>
            <div className="storePresetAdd">
              <input type="number" min="0" step={priceUnit} value={discountPresetDraft}
                onChange={e=>setDiscountPresetDraft(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addPreset("discount");}}}
                placeholder="例：3000"/>
              <button type="button" onClick={()=>addPreset("discount")}>追加</button>
            </div>
            <div className="storePresetChips">
              {discountPresets.map(value=><span key={value}>
                {new Intl.NumberFormat("ja-JP").format(value)}円
                {value!==0 && <button type="button" onClick={()=>removePreset("discount",value)} aria-label={value+"円の割引プリセットを削除"}>×</button>}
              </span>)}
            </div>
          </div>
          <div className="storePresetBox">
            <strong>割増</strong>
            <div className="storePresetAdd">
              <input type="number" min="0" step={priceUnit} value={surchargePresetDraft}
                onChange={e=>setSurchargePresetDraft(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addPreset("surcharge");}}}
                placeholder="例：2000"/>
              <button type="button" onClick={()=>addPreset("surcharge")}>追加</button>
            </div>
            <div className="storePresetChips">
              {surchargePresets.map(value=><span key={value}>
                {new Intl.NumberFormat("ja-JP").format(value)}円
                {value!==0 && <button type="button" onClick={()=>removePreset("surcharge",value)} aria-label={value+"円の割増プリセットを削除"}>×</button>}
              </span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="storePaymentSettings storeMiscExpenseSettings">
        <h3>キャスト精算・雑費</h3>
        <div className="storeMiscExpenseMode">
          <button type="button" className={miscExpenseMode==="fixed"?"active":""} onClick={()=>setMiscExpenseMode("fixed")}>金額指定</button>
          <button type="button" className={miscExpenseMode==="percent"?"active":""} onClick={()=>setMiscExpenseMode("percent")}>パーセント</button>
        </div>
        <label>{miscExpenseMode==="fixed" ? "雑費金額" : "雑費率"}
          <div className="storePercentInput">
            <input
              type="number"
              min="0"
              step={miscExpenseMode==="fixed" ? priceUnit : 0.1}
              value={miscExpenseValue}
              onChange={e=>setMiscExpenseValue(Math.max(0,Number(e.target.value)))}
            />
            <span>{miscExpenseMode==="fixed" ? "円" : "%"}</span>
          </div>
        </label>
        <p>{miscExpenseMode==="fixed"
          ? "キャスト精算で「雑費あり」を選ぶと、この金額を支給額から控除します。"
          : "キャスト精算で「雑費あり」を選ぶと、雑費控除前の支給額にこの割合を掛けて自動計算します。"}</p>
      </div>

      <div className="storePaymentSettings storeChangeCancelSettings">
        <h3>チェンジ・キャンセル</h3>
        <div className="storeChangeCancelGrid">
          <label>チェンジ料
            <div className="storePercentInput">
              <input type="number" min="0" step={priceUnit} value={changeFee}
                onChange={e=>setChangeFee(Math.max(0,Number(e.target.value)))}/>
              <span>円</span>
            </div>
          </label>
          <label>キャンセル料
            <div className="storePercentInput">
              <input type="number" min="0" step={priceUnit} value={cancelFee}
                onChange={e=>setCancelFee(Math.max(0,Number(e.target.value)))}/>
              <span>円</span>
            </div>
          </label>
        </div>
        <p>配車管理のオーダー操作からチェンジ・キャンセル処理をした時に自動適用します。</p>
      </div>
    </section>
  </div>;
}
