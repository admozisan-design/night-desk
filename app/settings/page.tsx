"use client";

import Link from "next/link";
import {cloudConfigured,cloudRole} from "@/lib/cloud";

type SettingsItem={
  title:string;
  description:string;
  href:string;
};

const groups:{
  title:string;
  description:string;
  countLabel:string;
  items:SettingsItem[];
}[]=[
  {
    title:"店舗・料金",
    description:"営業時間、利用場所、料金、オプション",
    countLabel:"4項目",
    items:[
      {title:"店舗設定",description:"営業時間・カード手数料・雑費ルールなど",href:"/store"},
      {title:"ホテル・利用場所",description:"ビジネスホテル・ラブホテル・自宅、交通費を管理",href:"/hotels"},
      {title:"料金登録",description:"コース料金・指名料・延長料金を設定",href:"/pricing"},
      {title:"オプション管理",description:"オプション名・料金・有効状態を管理",href:"/options"},
    ]
  },
  {
    title:"人員管理",
    description:"キャスト、スタッフ、ドライバー",
    countLabel:"3項目",
    items:[
      {title:"キャスト登録",description:"単価・スペック・NG・可能OP・広告URL・備考",href:"/casts/manage"},
      {title:"スタッフ登録",description:"スタッフ名・表示名・ログインIDを管理",href:"/staff"},
      {title:"ドライバー登録",description:"電話番号・車両・ナンバー・備考を管理",href:"/drivers"},
    ]
  },
  {
    title:"営業管理",
    description:"顧客情報、売上、終業時の締め処理",
    countLabel:"3項目",
    items:[
      {title:"顧客管理",description:"電話番号・利用履歴・注意事項・NG情報を確認",href:"/customers"},
      {title:"売上管理",description:"日別・キャスト別の売上と本数を集計",href:"/sales"},
      {title:"締め作業",description:"営業日の集計確認とExcel・PDF保存",href:"/closing"},
    ]
  },
  {
    title:"システム",
    description:"画面、メニュー、クラウド、権限、操作履歴",
    countLabel:"7項目",
    items:[
      {title:"クラウド・ログイン管理",description:"ログインできるスタッフの追加・削除",href:"/settings/team"},
      {title:"自動バックアップ",description:"日次保存履歴とデータ復元",href:"/settings/backups"},
      {title:"CSVデータ管理",description:"キャスト・ドライバー・ホテル・顧客・オーダーをCSV出力・入力",href:"/settings/data"},
      {title:"配車管理レイアウト",description:"配車管理のウィジェットをドラッグして配置・表示を変更",href:"/settings/dispatch"},
      {title:"上部メニュー設定",description:"ヘッダーの表示・順番・名称をカスタマイズ",href:"/settings/menu"},
      {title:"スタッフ権限",description:"受付・売上・設定変更などの権限を管理",href:"/permissions"},
      {title:"操作履歴",description:"誰がいつ何を変更したかを確認",href:"/logs"},
    ]
  }
];

export default function SettingsPage(){
  return <div className="settingsHub settingsHubCompact">
    <header className="settingsHubHeader">
      <div>
        <p className="eyebrow">SETTINGS</p>
        <h1>設定・管理</h1>
        <p>必要なカテゴリを開いて設定してください。</p>
      </div>
    </header>

    <section className="settingsAccordionList">
      {groups.map(group=><details className="settingsAccordion" key={group.title}>
        <summary>
          <div className="settingsAccordionTitle">
            <strong>{group.title}</strong>
            <span>{group.description}</span>
          </div>
          <div className="settingsAccordionMeta">
            <small>{group.countLabel}</small>
            <b aria-hidden="true">＋</b>
          </div>
        </summary>

        <div className="settingsAccordionBody">
          {group.items.filter(item=>!cloudConfigured || cloudRole()==="admin" || ![
            "/store","/pricing","/permissions","/staff","/settings/team",
            "/settings/backups","/settings/menu","/settings/dispatch","/settings/data"
          ].includes(item.href)).map(item=><Link href={item.href} className="settingsCompactItem" key={item.href}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </div>
            <span>開く →</span>
          </Link>)}
        </div>
      </details>)}
    </section>
  </div>;
}
