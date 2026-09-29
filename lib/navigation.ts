import type { TopNavItem } from "./types";

export const defaultTopNavigation:TopNavItem[]=[
  {id:"dispatch",href:"/",label:"配車管理",visible:true},
  {id:"casts",href:"/casts",label:"キャスト出勤管理",visible:true},
  {id:"settlement",href:"/settlement",label:"キャスト精算",visible:true},
  {id:"orders",href:"/orders",label:"予約一覧",visible:true},
  {id:"settings",href:"/settings",label:"設定",visible:true,locked:true},
];
