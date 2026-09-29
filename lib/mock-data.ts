import type {
  AuditLog,
  Cast,
  CastSettlementAdjustment,
  CastSettlementDailyConfig,
  Course,
  Customer,
  Driver,
  Hotel,
  Order,
  PricingConfig,
  Staff,
  StaffPermission,
  StoreOption,
  StoreSettings
} from "./types";

function japanDateOffset(days:number){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).formatToParts(new Date());
  const year=Number(parts.find(part=>part.type==="year")?.value);
  const month=Number(parts.find(part=>part.type==="month")?.value);
  const day=Number(parts.find(part=>part.type==="day")?.value);
  const value=new Date(Date.UTC(year,month-1,day+days));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth()+1).padStart(2,"0"),
    String(value.getUTCDate()).padStart(2,"0")
  ].join("-");
}

const yesterday=japanDateOffset(-1);
const today=japanDateOffset(0);
const tomorrow=japanDateOffset(1);
const dayAfter=japanDateOffset(2);
const day3=japanDateOffset(3);

export const defaultStoreSettings: StoreSettings = {
  openTime:"12:00",
  closeTime:"05:00",
  cardFeeRate:10,
  priceUnit:100,
  miscExpenseMode:"percent",
  miscExpenseValue:6
};

export const options: StoreOption[] = [
  { id:"demo-op-costume", name:"コスプレ", price:1000, notes:"衣装は受付時に在庫確認", active:true },
  { id:"demo-op-massage", name:"オイル追加", price:2000, notes:"対応可能キャストのみ", active:true },
  { id:"demo-op-long", name:"濃厚コース追加", price:3000, notes:"事前確認必須", active:true },
  { id:"demo-op-free", name:"写真指名特典", price:0, notes:"写真指名時の無料特典サンプル", active:true },
  { id:"demo-op-shower", name:"シャワー延長", price:1000, notes:"ホテル状況により不可の場合あり", active:true }
];

const schedule=(rows:Array<[string,string,"reception"|"leave",string,boolean,("present"|"late"|"absent"|"leftEarly")?]>)=>
  rows.map(([date,start,endType,endTime,working,attendance])=>({date,start,endType,endTime,working,attendance}));

export const casts: Cast[] = [
  {
    id:"demo-cast-hinata", name:"ひなた", status:"waiting", shiftStart:"12:00", shiftEnd:"00:00",
    freeUnitPrice:6000, photoUnitPrice:7000, repeatUnitPrice:8000,
    ngDetails:["泥酔NG","自宅NG"], availableOptions:["コスプレ","オイル追加","写真指名特典"],
    notes:"明るめ。初回客との相性◎。受付時に自宅利用か確認。",
    interviewEvaluation:"受け答えが明るく、会話テンポも良好。昼〜夕方の主力想定。",
    age:23, heightCm:158, bustCm:84, waistCm:57, hipCm:84, cupSize:"D",
    schedule:schedule([
      [yesterday,"12:00","reception","23:00",true,"present"],
      [today,"12:00","reception","00:00",true,"present"],
      [tomorrow,"13:00","leave","01:00",true],
      [dayAfter,"12:00","leave","22:00",true],
      [day3,"12:00","leave","22:00",false]
    ])
  },
  {
    id:"demo-cast-mio", name:"みお", status:"waiting", shiftStart:"14:00", shiftEnd:"23:00",
    freeUnitPrice:6500, photoUnitPrice:7500, repeatUnitPrice:8500,
    ngDetails:["強い香水NG"], availableOptions:["コスプレ","濃厚コース追加","シャワー延長"],
    notes:"リピーター多め。連続ロングは間30分確保。",
    interviewEvaluation:"落ち着いた接客。説明理解が早く、本指名化を狙いやすいタイプ。",
    age:26, heightCm:162, bustCm:87, waistCm:59, hipCm:86, cupSize:"E",
    schedule:schedule([
      [yesterday,"14:00","leave","23:00",true,"present"],
      [today,"14:00","leave","23:00",true,"present"],
      [tomorrow,"14:00","reception","23:30",true],
      [dayAfter,"15:00","leave","00:30",true],
      [day3,"14:00","leave","23:00",true]
    ])
  },
  {
    id:"demo-cast-rena", name:"れな", status:"serving", availableAt:"21:10", shiftStart:"17:00", shiftEnd:"02:00",
    freeUnitPrice:6500, photoUnitPrice:7500, repeatUnitPrice:8500,
    ngDetails:["泥酔NG","乱暴な言動NG"], availableOptions:["オイル追加","濃厚コース追加","写真指名特典"],
    notes:"夜帯の主力。ホテル利用中心。NG確認を受付で徹底。",
    interviewEvaluation:"会話力が高く、夜帯向け。新規・本指ともに安定。",
    age:24, heightCm:160, bustCm:86, waistCm:58, hipCm:85, cupSize:"D",
    schedule:schedule([
      [yesterday,"17:00","reception","01:00",true,"present"],
      [today,"17:00","reception","02:00",true,"present"],
      [tomorrow,"18:00","leave","03:00",true],
      [dayAfter,"17:00","leave","02:00",false],
      [day3,"17:00","leave","02:00",true]
    ])
  },
  {
    id:"demo-cast-sakura", name:"さくら", status:"moving", availableAt:"22:00", shiftStart:"18:00", shiftEnd:"04:00",
    freeUnitPrice:7000, photoUnitPrice:8000, repeatUnitPrice:9000,
    ngDetails:[], availableOptions:["コスプレ","オイル追加","濃厚コース追加","写真指名特典","シャワー延長"],
    notes:"ロング対応可。深夜帯まで受付可能。",
    interviewEvaluation:"対応幅が広く、オプション対応も多い。深夜帯の軸。",
    age:28, heightCm:164, bustCm:89, waistCm:60, hipCm:88, cupSize:"F",
    schedule:schedule([
      [yesterday,"18:00","leave","03:00",true,"present"],
      [today,"18:00","leave","04:00",true,"late"],
      [tomorrow,"18:00","leave","04:00",true],
      [dayAfter,"18:00","leave","04:00",true],
      [day3,"19:00","leave","04:00",true]
    ])
  },
  {
    id:"demo-cast-ema", name:"えま", status:"waiting", shiftStart:"20:00", shiftEnd:"05:00",
    freeUnitPrice:6000, photoUnitPrice:7000, repeatUnitPrice:8000,
    ngDetails:["自宅NG"], availableOptions:["コスプレ","写真指名特典"],
    notes:"深夜帯。自宅不可。ホテルのみ案内。",
    interviewEvaluation:"小柄系。短時間コースの回転が良い想定。",
    age:21, heightCm:153, bustCm:82, waistCm:56, hipCm:82, cupSize:"C",
    schedule:schedule([
      [yesterday,"20:00","leave","04:00",true,"present"],
      [today,"20:00","leave","05:00",true,"present"],
      [tomorrow,"20:00","leave","05:00",true],
      [dayAfter,"20:00","leave","05:00",true],
      [day3,"20:00","leave","05:00",false]
    ])
  },
  {
    id:"demo-cast-aoi", name:"あおい", status:"off", shiftStart:"13:00", shiftEnd:"22:00",
    freeUnitPrice:6000, photoUnitPrice:7000, repeatUnitPrice:8000,
    ngDetails:["喫煙直後NG"], availableOptions:["オイル追加","シャワー延長"],
    notes:"本日は休み。翌日出勤サンプル用。",
    interviewEvaluation:"丁寧な接客。翌日予約のデモ確認用。",
    age:25, heightCm:161, bustCm:85, waistCm:59, hipCm:86, cupSize:"D",
    schedule:schedule([
      [yesterday,"13:00","leave","22:00",true,"present"],
      [today,"13:00","leave","22:00",false],
      [tomorrow,"13:00","leave","22:00",true],
      [dayAfter,"13:00","leave","22:00",true],
      [day3,"13:00","leave","22:00",true]
    ])
  }
];

export const drivers: Driver[] = [
  { id:"demo-driver-01", name:"佐々木", phone:"090-0000-2001", vehicle:"プリウス / 白", plate:"札幌 500 あ 12-34", notes:"昼〜深夜。ホテル同行可。", active:true },
  { id:"demo-driver-02", name:"高橋", phone:"090-0000-2002", vehicle:"アクア / 黒", plate:"札幌 530 い 56-78", notes:"夜帯メイン。23時以降優先。", active:true },
  { id:"demo-driver-03", name:"山本", phone:"090-0000-2003", vehicle:"ノート / シルバー", plate:"札幌 501 う 90-12", notes:"自宅送迎対応。", active:true },
  { id:"demo-driver-04", name:"鈴木", phone:"090-0000-2004", vehicle:"フィット / 紺", plate:"札幌 502 え 34-56", notes:"予備稼働。", active:false }
];

export const courses: Course[] = [
  { id:"60", minutes:60, price:13000 },
  { id:"70", minutes:70, price:15000 },
  { id:"80", minutes:80, price:17000 },
  { id:"90", minutes:90, price:19000 },
  { id:"100", minutes:100, price:21000 },
  { id:"120", minutes:120, price:25000 }
];

export const pricingSettings = {
  photoNominationFee:2000,
  repeatNominationFee:2000,
  defaultTravelFee:1000
};

export const defaultPricingConfig: PricingConfig = {
  courses,
  photoNominationFee:2000,
  repeatNominationFee:2000,
  defaultTravelFee:1000,
  extensionMinutes:10,
  extensionPrice:2000
};

export const hotels: Hotel[] = [
  { id:"demo-hotel-lumiere", name:"ホテル ルミエール", travelFee:1000, visible:true },
  { id:"demo-hotel-north", name:"ノースゲート", travelFee:1000, visible:true },
  { id:"demo-hotel-river", name:"リバーサイド", travelFee:1500, visible:true },
  { id:"demo-hotel-grand", name:"グランパレス", travelFee:2000, visible:true },
  { id:"demo-hotel-moon", name:"ムーンテラス", travelFee:2500, visible:true },
  { id:"demo-hotel-away", name:"郊外サンプルホテル", travelFee:3000, visible:false }
];

export const staff: Staff[] = [
  { id:"demo-staff-manager", name:"田中 太郎", displayName:"店長", loginId:"manager-demo", notes:"管理者。設定変更・精算確認担当。", active:true },
  { id:"demo-staff-front-a", name:"佐藤 健", displayName:"フロント佐藤", loginId:"front-sato", notes:"18:00〜翌4:00メイン。", active:true },
  { id:"demo-staff-front-b", name:"鈴木 海", displayName:"フロント鈴木", loginId:"front-suzuki", notes:"昼帯・予約対応。", active:true },
  { id:"demo-staff-help", name:"高橋 翔", displayName:"ヘルプ高橋", loginId:"help-taka", notes:"週末ヘルプ。設定権限なし想定。", active:true }
];

export const demoPermissions: StaffPermission[] = [
  {staffId:"demo-staff-manager",reception:true,orders:true,sales:true,settings:true},
  {staffId:"demo-staff-front-a",reception:true,orders:true,sales:true,settings:false},
  {staffId:"demo-staff-front-b",reception:true,orders:true,sales:true,settings:false},
  {staffId:"demo-staff-help",reception:true,orders:true,sales:false,settings:false}
];

export const demoCustomers: Customer[] = [
  {id:"demo-customer-01",phone:"090-0000-1001",name:"田中様",notes:"ホテル利用中心。静かな部屋希望。",ngInfo:"NGキャスト：れな",active:true},
  {id:"demo-customer-02",phone:"090-0000-1002",name:"佐藤様",notes:"本指名でみお利用多め。到着10分前連絡希望。",ngInfo:"",active:true},
  {id:"demo-customer-03",phone:"090-0000-1003",name:"山田様",notes:"カード決済。領収書不要。",ngInfo:"",active:true},
  {id:"demo-customer-04",phone:"090-0000-1004",name:"伊藤様",notes:"自宅利用。駐車位置を毎回確認。",ngInfo:"NGキャスト：ひなた",active:true},
  {id:"demo-customer-05",phone:"090-0000-1005",name:"中村様",notes:"深夜利用。延長希望が多い。",ngInfo:"",active:true},
  {id:"demo-customer-06",phone:"090-0000-1006",name:"小林様",notes:"ホテル変更が多いので確定後に配車。",ngInfo:"",active:true},
  {id:"demo-customer-07",phone:"090-0000-1007",name:"加藤様",notes:"過去トラブルあり。受付時は店長確認。",ngInfo:"利用不可 / 料金トラブル履歴あり",active:false},
  {id:"demo-customer-08",phone:"090-0000-1008",name:"吉田様",notes:"翌日予約デモ用。",ngInfo:"",active:true}
];

export const demoOrders: Order[] = [
  {
    id:"demo-order-yesterday-01",createdAt:yesterday+"T18:00:00+09:00",serviceDate:yesterday,
    customerPhone:"090-0000-1001",locationType:"hotel",locationName:"ホテル ルミエール",room:"305",
    castId:"demo-cast-rena",castName:"れな",driverId:"demo-driver-02",driverName:"高橋",
    courseId:"90",courseMinutes:90,extensionMinutes:0,extensionTotal:0,nominationType:"photo",
    selectedOptions:["オイル追加"],optionsTotal:2000,travelFee:1000,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:24000,status:"completed",scheduledStart:"19:00",scheduledEnd:"20:30",inTime:"19:05",
    note:"初回。NG確認済み。",handoffNote:"次回はれなNG。別キャスト案内。"
  },
  {
    id:"demo-order-today-01",createdAt:today+"T12:30:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1002",locationType:"hotel",locationName:"ノースゲート",room:"602",
    castId:"demo-cast-hinata",castName:"ひなた",driverId:"demo-driver-01",driverName:"佐々木",
    courseId:"60",courseMinutes:60,extensionMinutes:0,extensionTotal:0,nominationType:"free",
    selectedOptions:[],optionsTotal:0,travelFee:1000,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:14000,status:"completed",scheduledStart:"13:00",scheduledEnd:"14:00",inTime:"13:02",
    note:"ネット予約。",handoffNote:"対応問題なし。"
  },
  {
    id:"demo-order-today-02",createdAt:today+"T14:40:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1002",locationType:"hotel",locationName:"ホテル ルミエール",room:"408",
    castId:"demo-cast-mio",castName:"みお",driverId:"demo-driver-01",driverName:"佐々木",
    courseId:"90",courseMinutes:90,extensionMinutes:10,extensionTotal:2000,nominationType:"repeat",
    selectedOptions:["コスプレ"],optionsTotal:1000,travelFee:1000,discount:1000,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:24000,status:"completed",scheduledStart:"15:30",scheduledEnd:"17:10",inTime:"15:30",
    note:"本指名。10分延長。",handoffNote:"次回もみお希望。"
  },
  {
    id:"demo-order-today-03",createdAt:today+"T18:00:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1003",locationType:"hotel",locationName:"リバーサイド",room:"711",
    castId:"demo-cast-rena",castName:"れな",driverId:"demo-driver-02",driverName:"高橋",
    courseId:"100",courseMinutes:100,extensionMinutes:0,extensionTotal:0,nominationType:"photo",
    selectedOptions:["オイル追加"],optionsTotal:2000,travelFee:1500,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"card",cardFee:2750,total:30250,status:"serving",scheduledStart:"19:20",scheduledEnd:"21:00",inTime:"19:20",
    note:"カード決済。",handoffNote:"終了後そのまま次送迎。"
  },
  {
    id:"demo-order-today-04",createdAt:today+"T19:10:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1004",locationType:"hotel",locationName:"グランパレス",room:"506",
    castId:"demo-cast-sakura",castName:"さくら",driverId:"demo-driver-03",driverName:"山本",
    courseId:"80",courseMinutes:80,extensionMinutes:0,extensionTotal:0,nominationType:"free",
    selectedOptions:["写真指名特典"],optionsTotal:0,travelFee:2000,discount:0,surcharge:1000,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:20000,status:"dispatching",scheduledStart:"21:00",scheduledEnd:"22:20",
    note:"部屋番号確認済み。",handoffNote:"20:35出発予定。"
  },
  {
    id:"demo-order-today-05",createdAt:today+"T19:40:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1005",locationType:"hotel",locationName:"ムーンテラス",room:"303",
    castId:"demo-cast-ema",castName:"えま",driverId:"demo-driver-02",driverName:"高橋",
    courseId:"60",courseMinutes:60,extensionMinutes:0,extensionTotal:0,nominationType:"photo",
    selectedOptions:["コスプレ"],optionsTotal:1000,travelFee:2500,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:19500,status:"accepted",scheduledStart:"22:30",scheduledEnd:"23:30",
    note:"写真指名。",handoffNote:"ホテルのみ。自宅変更不可。"
  },
  {
    id:"demo-order-today-06",createdAt:today+"T20:00:00+09:00",serviceDate:today,
    customerPhone:"090-0000-1006",locationType:"hotel",locationName:"ノースゲート",room:"805",
    castId:"demo-cast-hinata",castName:"ひなた",driverId:"demo-driver-03",driverName:"山本",
    courseId:"120",courseMinutes:120,extensionMinutes:0,extensionTotal:0,nominationType:"repeat",
    selectedOptions:["オイル追加"],optionsTotal:2000,travelFee:1000,discount:1000,surcharge:0,adjustment:0,
    paymentMethod:"card",cardFee:2900,total:31900,status:"accepted",scheduledStart:"23:30",scheduledEnd:"01:30",
    note:"事前予約。",handoffNote:"受付終了後スタートの予約サンプル。"
  },
  {
    id:"demo-order-tomorrow-01",createdAt:today+"T20:10:00+09:00",serviceDate:tomorrow,
    customerPhone:"090-0000-1008",locationType:"hotel",locationName:"ホテル ルミエール",room:"未定",
    castId:"demo-cast-aoi",castName:"あおい",driverId:"demo-driver-01",driverName:"佐々木",
    courseId:"90",courseMinutes:90,extensionMinutes:0,extensionTotal:0,nominationType:"photo",
    selectedOptions:["オイル追加"],optionsTotal:2000,travelFee:1000,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:24000,status:"accepted",scheduledStart:"14:00",scheduledEnd:"15:30",
    note:"翌日予約。部屋番号は当日連絡。",handoffNote:"12時以降に部屋番号確認TEL。"
  },
  {
    id:"demo-order-tomorrow-02",createdAt:today+"T20:20:00+09:00",serviceDate:tomorrow,
    customerPhone:"090-0000-1003",locationType:"hotel",locationName:"グランパレス",room:"1204",
    castId:"demo-cast-mio",castName:"みお",driverId:"demo-driver-02",driverName:"高橋",
    courseId:"120",courseMinutes:120,extensionMinutes:0,extensionTotal:0,nominationType:"repeat",
    selectedOptions:["コスプレ","濃厚コース追加"],optionsTotal:4000,travelFee:2000,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"card",cardFee:3300,total:36300,status:"accepted",scheduledStart:"20:00",scheduledEnd:"22:00",
    note:"翌日ロング予約。",handoffNote:"カード決済予定。"
  },
  {
    id:"demo-order-dayafter-01",createdAt:today+"T20:30:00+09:00",serviceDate:dayAfter,
    customerPhone:"090-0000-1001",locationType:"hotel",locationName:"リバーサイド",room:"未定",
    castId:"demo-cast-sakura",castName:"さくら",driverId:"demo-driver-03",driverName:"山本",
    courseId:"100",courseMinutes:100,extensionMinutes:0,extensionTotal:0,nominationType:"photo",
    selectedOptions:["シャワー延長"],optionsTotal:1000,travelFee:1500,discount:0,surcharge:0,adjustment:0,
    paymentMethod:"cash",cardFee:0,total:25500,status:"accepted",scheduledStart:"21:30",scheduledEnd:"23:10",
    note:"2日後予約。",handoffNote:"れなNG客。さくらで確定。"
  }
];

export const demoSettlementAdjustments: Record<string,CastSettlementAdjustment> = {
  "demo-order-today-01":{orderId:"demo-order-today-01",optionBack:0,extensionBack:0,adjustment:0,memo:""},
  "demo-order-today-02":{orderId:"demo-order-today-02",optionBack:500,extensionBack:1000,adjustment:0,memo:"OP・延長バック確認済"},
  "demo-order-today-03":{orderId:"demo-order-today-03",optionBack:1000,extensionBack:0,adjustment:500,memo:"カード対応手当"},
  "demo-order-today-04":{orderId:"demo-order-today-04",optionBack:0,extensionBack:0,adjustment:0,memo:""}
};

export const demoSettlementDailyConfigs: Record<string,CastSettlementDailyConfig> = {
  [today+":demo-cast-hinata"]:{key:today+":demo-cast-hinata",date:today,castId:"demo-cast-hinata",miscExpenseEnabled:true},
  [today+":demo-cast-mio"]:{key:today+":demo-cast-mio",date:today,castId:"demo-cast-mio",miscExpenseEnabled:false},
  [today+":demo-cast-rena"]:{key:today+":demo-cast-rena",date:today,castId:"demo-cast-rena",miscExpenseEnabled:true}
};

export const demoAuditLogs: AuditLog[] = [
  {id:"demo-log-01",createdAt:today+"T20:35:00+09:00",actor:"フロント佐藤",category:"受付",action:"翌日予約を登録",detail:"あおい / 90分 / 090-0000-1008"},
  {id:"demo-log-02",createdAt:today+"T20:05:00+09:00",actor:"フロント佐藤",category:"受付",action:"配車済みに変更",detail:"さくら / グランパレス"},
  {id:"demo-log-03",createdAt:today+"T19:20:00+09:00",actor:"フロント鈴木",category:"受付",action:"イン時間を記録",detail:"れな / 19:20"},
  {id:"demo-log-04",createdAt:today+"T18:45:00+09:00",actor:"店長",category:"顧客",action:"NG情報を確認",detail:"090-0000-1001 / れなNG"},
  {id:"demo-log-05",createdAt:yesterday+"T23:10:00+09:00",actor:"店長",category:"精算",action:"精算内容を保存",detail:"みお"}
];
