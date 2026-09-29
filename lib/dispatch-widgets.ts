import type { DispatchWidgetSetting } from "./types";

export const defaultDispatchWidgets:DispatchWidgetSetting[]=[
  {id:"date",label:"日付",area:"left",order:0,visible:true},
  {id:"sharedMemo",label:"共有メモ",area:"left",order:1,visible:true},
  {id:"orderRegister",label:"オーダー登録",area:"center",order:0,visible:true},
  {id:"reservations",label:"選択日の予約一覧",area:"right",order:0,visible:true},
  {id:"board",label:"配車ボード",area:"bottom",order:0,visible:true},
];
