import Link from "next/link";

const masterItems = [
  { title:"キャスト登録", description:"在籍キャスト、源氏名、出勤、表示状態を管理", href:"/casts", action:"管理する" },
  { title:"スタッフ登録", description:"フロントスタッフのアカウント・所属店舗を管理", href:"#staff", action:"準備中" },
  { title:"ドライバー登録", description:"送迎ドライバー、稼働状態、担当エリアを管理", href:"#drivers", action:"準備中" },
  { title:"店舗登録", description:"店舗名、営業時間、電話番号、所属エリアを管理", href:"#shops", action:"準備中" },
  { title:"エリア登録", description:"営業エリアと店舗・ホテルの紐付けを管理", href:"#areas", action:"準備中" },
  { title:"ホテル登録", description:"ホテル名、住所、交通費、入館メモを管理", href:"#hotels", action:"準備中" },
];

const operationItems = [
  { title:"顧客管理", description:"電話番号、利用履歴、注意事項、NG情報を確認", href:"#customers", action:"準備中" },
  { title:"売上管理", description:"日別・店舗別・キャスト別の売上と本数を集計", href:"#sales", action:"準備中" },
  { title:"料金登録", description:"コース料金、指名料、交通費、延長料金を設定", href:"#pricing", action:"準備中" },
  { title:"オプション・割引", description:"有料OP、無料OP、キャンペーン、割引ルールを設定", href:"#options", action:"準備中" },
];

const systemItems = [
  { title:"スタッフ権限", description:"閲覧・受付・売上・設定変更などの権限を管理", href:"#permissions", action:"準備中" },
  { title:"操作履歴", description:"誰がいつ何を変更したかを確認", href:"#logs", action:"準備中" },
];

function SettingsCard({item}:{item:{title:string;description:string;href:string;action:string}}){
  const active = item.href.startsWith("/");
  return <Link href={item.href} className={`settingsHubCard ${active?"isActive":""}`}>
    <div>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
    </div>
    <span>{item.action} →</span>
  </Link>
}

export default function SettingsPage(){
  return <div className="settingsHub">
    <header className="settingsHubHeader">
      <div>
        <p className="eyebrow">SETTINGS</p>
        <h1>設定・管理</h1>
        <p>店舗運営で使う基本データや権限、売上情報をここから管理します。</p>
      </div>
    </header>

    <section className="settingsGroup">
      <div className="settingsGroupTitle">
        <h2>基本マスタ</h2>
        <span>日々の受付で使用する登録情報</span>
      </div>
      <div className="settingsHubGrid">
        {masterItems.map(item=><SettingsCard key={item.title} item={item}/>)}
      </div>
    </section>

    <section className="settingsGroup">
      <div className="settingsGroupTitle">
        <h2>営業・会計</h2>
        <span>顧客・料金・売上に関する設定</span>
      </div>
      <div className="settingsHubGrid">
        {operationItems.map(item=><SettingsCard key={item.title} item={item}/>)}
      </div>
    </section>

    <section className="settingsGroup">
      <div className="settingsGroupTitle">
        <h2>システム管理</h2>
        <span>権限と操作履歴</span>
      </div>
      <div className="settingsHubGrid">
        {systemItems.map(item=><SettingsCard key={item.title} item={item}/>)}
      </div>
    </section>
  </div>
}
