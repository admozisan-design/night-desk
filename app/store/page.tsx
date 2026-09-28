"use client";

import { useEffect, useState } from "react";
import { defaultStoreSettings } from "@/lib/mock-data";
import { loadStoreSettings, saveStoreSettings } from "@/lib/storage";

export default function StoreSettingsPage(){
  const [openTime,setOpenTime]=useState(defaultStoreSettings.openTime);
  const [closeTime,setCloseTime]=useState(defaultStoreSettings.closeTime);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    const settings=loadStoreSettings(defaultStoreSettings);
    setOpenTime(settings.openTime);
    setCloseTime(settings.closeTime);
  },[]);

  function save(){
    saveStoreSettings({openTime,closeTime});
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
    </section>
  </div>;
}
