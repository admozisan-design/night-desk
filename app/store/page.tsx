"use client";

import { useEffect, useState } from "react";
import { defaultStoreSettings } from "@/lib/mock-data";
import { loadStoreSettings, saveStoreSettings } from "@/lib/storage";

export default function StoreSettingsPage(){
  const [openTime,setOpenTime]=useState(defaultStoreSettings.openTime);
  const [closeTime,setCloseTime]=useState(defaultStoreSettings.closeTime);
  const [cardFeeRate,setCardFeeRate]=useState(defaultStoreSettings.cardFeeRate);
  const [priceUnit,setPriceUnit]=useState(defaultStoreSettings.priceUnit);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const settings=loadStoreSettings(defaultStoreSettings);
    setOpenTime(settings.openTime);
    setCloseTime(settings.closeTime);
    setCardFeeRate(settings.cardFeeRate ?? 0);
    setPriceUnit(settings.priceUnit ?? 100);
  },[]);

  function save(){
    saveStoreSettings({openTime,closeTime,cardFeeRate,priceUnit});
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
    </section>
  </div>;
}
