import Link from "next/link";

const masterItems = [
  { title:"キャスト登録", description:"キャスト情報、単価、スペック、NG、可能OPを管理", href:"/casts", action:"管理する" },
  { title:"スタッフ登録", description:"スタッフ名、表示名、ログインIDを管理", href:"/staff", action:"管理する" },
  { title:"ドライバー登録", description:"ドライバー名、電話番号、車両、ナンバーを管理", href:"/drivers", action:"管理する" },
  { title:"ホテル登録", description:"ホテル名と交通費を管理", href:"/hotels", action:"管理する" },
];

const operationItems = [
  { title:"顧客管理", description:"電話番号、利用履歴、注意事項、NG情報を確認", href:"/customers", action:"管理する" },
  { title:"売上管理", description:"日別・キャスト別の売上と本数を集計", href:"/sales", action:"管理する" },
  { title:"料金登録", description:"コース料金、指名料、交通費、延長料金を設定", href:"/pricing", action:"管理する" },
  { title:"オプション管理", description:"オプション名、料金、有効状態を管理", href:"/options", action:"管理する" },
];

const systemItems = [
  { title:"スタッフ権限", description:"閲覧・受付・売上・設定変更などの権限を管理", href:"/permissions", action:"管理する" },
  { title:"操作履歴", description:"誰がいつ何を変更したかを確認", href:"/logs", action:"管理する" },
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
