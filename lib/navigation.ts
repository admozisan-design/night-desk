import type { TopNavItem } from "./types";

export const defaultTopNavigation:TopNavItem[]=[
  {id:"dispatch",href:"/",label:"配車管理",visible:true,inMenu:true},
  {id:"board",href:"/board",label:"配車ボード",visible:true,inMenu:true},
  {id:"operations",href:"/operations",label:"業務統合",visible:true,inMenu:true},
  {id:"analytics",href:"/analytics",label:"分析",visible:true,inMenu:true},
  {id:"casts",href:"/casts",label:"キャスト出勤管理",visible:true,inMenu:true},
  {id:"settlement",href:"/settlement",label:"キャスト精算",visible:true,inMenu:true},
  {id:"orders",href:"/orders",label:"予約一覧",visible:true,inMenu:true},
  {id:"settings",href:"/settings",label:"設定",visible:true,locked:true,inMenu:true},
];

export const settingsNavigationCatalog:TopNavItem[]=[
  {id:"nav-team",href:"/settings/team",label:"ログイン管理",visible:true,inMenu:false},
  {id:"nav-backups",href:"/settings/backups",label:"バックアップ",visible:true,inMenu:false},
  {id:"nav-csv-data",href:"/settings/data",label:"CSVデータ管理",visible:true,inMenu:false},
  {id:"nav-dispatch-layout",href:"/settings/dispatch",label:"配車管理レイアウト",visible:true,inMenu:false},
  {id:"nav-menu-settings",href:"/settings/menu",label:"上部メニュー設定",visible:true,inMenu:false},
  {id:"nav-store",href:"/store",label:"店舗設定",visible:true,inMenu:false},
  {id:"nav-cast-manage",href:"/casts/manage",label:"キャスト登録",visible:true,inMenu:false},
  {id:"nav-staff",href:"/staff",label:"スタッフ登録",visible:true,inMenu:false},
  {id:"nav-drivers",href:"/drivers",label:"ドライバー登録",visible:true,inMenu:false},
  {id:"nav-hotels",href:"/hotels",label:"ホテル・利用場所",visible:true,inMenu:false},
  {id:"nav-customers",href:"/customers",label:"顧客管理",visible:true,inMenu:false},
  {id:"nav-sales",href:"/sales",label:"売上管理",visible:true,inMenu:false},
  {id:"nav-expenses",href:"/expenses",label:"経費管理",visible:true,inMenu:false},
  {id:"nav-analytics",href:"/analytics",label:"経営・稼働分析",visible:true,inMenu:false},
  {id:"nav-operations",href:"/operations",label:"業務統合パネル",visible:true,inMenu:false},
  {id:"nav-closing",href:"/closing",label:"締め作業",visible:true,inMenu:false},
  {id:"nav-pricing",href:"/pricing",label:"料金登録",visible:true,inMenu:false},
  {id:"nav-options",href:"/options",label:"オプション管理",visible:true,inMenu:false},
  {id:"nav-permissions",href:"/permissions",label:"スタッフ権限",visible:true,inMenu:false},
  {id:"nav-logs",href:"/logs",label:"操作履歴",visible:true,inMenu:false},
];
