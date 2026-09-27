import { courses,pricingSettings } from "@/lib/mock-data";
import { formatYen } from "@/lib/pricing";
export default function SettingsPage(){
  return <div>
    <header className="pageHeader"><div><p className="eyebrow">SETTINGS</p><h1>店舗・料金設定</h1><p>v0.1では表示のみ。次版でDB保存と編集をつなぎます。</p></div></header>
    <section className="twoCol">
      <div className="panel"><h2>コース料金</h2><div className="settingsList">{courses.map(c=><div key={c.id}><span>{c.minutes}分</span><strong>{formatYen(c.price)}</strong></div>)}</div></div>
      <div className="panel"><h2>加算料金</h2><div className="settingsList">
        <div><span>写真指名</span><strong>{formatYen(pricingSettings.photoNominationFee)}</strong></div>
        <div><span>本指名</span><strong>{formatYen(pricingSettings.repeatNominationFee)}</strong></div>
        <div><span>標準交通費</span><strong>{formatYen(pricingSettings.defaultTravelFee)}</strong></div>
      </div></div>
    </section>
  </div>
}
