import type { Cast, Course, Driver, Hotel, PricingConfig, Staff, StoreOption, StoreSettings } from "./types";

export const defaultStoreSettings: StoreSettings = { openTime:"10:00", closeTime:"05:00" };

export const casts: Cast[] = [
  {
    id:"c1", name:"サンプルA", status:"waiting", shiftStart:"12:00", shiftEnd:"20:00",
    freeUnitPrice:5000, photoUnitPrice:6000, repeatUnitPrice:7000,
    ngDetails:["キスNG","自宅NG"], availableOptions:["オプションA","オプションC"], notes:"サンプル備考",
    interviewEvaluation:"明るく受け答えが丁寧。接客向きの印象。",
    age:24, heightCm:158, bustCm:86, waistCm:58, hipCm:85, cupSize:"D"
  },
  {
    id:"c2", name:"サンプルB", status:"serving", availableAt:"15:30", shiftStart:"14:00", shiftEnd:"22:00",
    freeUnitPrice:5500, photoUnitPrice:6500, repeatUnitPrice:7500,
    ngDetails:[], availableOptions:["オプションA","オプションB"], notes:"受付時に確認事項あり",
    interviewEvaluation:"落ち着いた雰囲気。説明理解が早い。",
    age:27, heightCm:162, bustCm:88, waistCm:60, hipCm:87, cupSize:"E"
  },
  {
    id:"c3", name:"サンプルC", status:"moving", availableAt:"18:00", shiftStart:"17:00", shiftEnd:"01:00",
    freeUnitPrice:6000, photoUnitPrice:7000, repeatUnitPrice:8000,
    ngDetails:["酔客NG"], availableOptions:["オプションB"], notes:"サンプル備考",
    interviewEvaluation:"会話が得意。接客経験あり。",
    age:22, heightCm:155, bustCm:84, waistCm:57, hipCm:83, cupSize:"C"
  },
  {
    id:"c4", name:"サンプルD", status:"waiting", shiftStart:"20:00", shiftEnd:"04:00",
    freeUnitPrice:6500, photoUnitPrice:7500, repeatUnitPrice:8500,
    ngDetails:[], availableOptions:["オプションA","オプションB","オプションC"], notes:"",
    interviewEvaluation:"物腰が柔らかく、受け答え良好。",
    age:29, heightCm:165, bustCm:90, waistCm:62, hipCm:89, cupSize:"F"
  },
];

export const drivers: Driver[] = [
  { id:"d1", name:"ドライバー01", phone:"090-0000-0001", vehicle:"サンプル車A", plate:"00-01", notes:"", active:true },
  { id:"d2", name:"ドライバー02", phone:"090-0000-0002", vehicle:"サンプル車B", plate:"00-02", notes:"夜帯メイン", active:true },
  { id:"d3", name:"ドライバー03", phone:"090-0000-0003", vehicle:"サンプル車C", plate:"00-03", notes:"", active:true },
];

export const courses: Course[] = [
  { id:"60", minutes:60, price:10000 },
  { id:"90", minutes:90, price:15000 },
  { id:"120", minutes:120, price:20000 },
];

export const pricingSettings = {
  photoNominationFee:1000,
  repeatNominationFee:1000,
  defaultTravelFee:1000
};

export const defaultPricingConfig: PricingConfig = {
  courses,
  photoNominationFee:1000,
  repeatNominationFee:1000,
  defaultTravelFee:1000,
  extensionMinutes:10,
  extensionPrice:2000
};


export const hotels: Hotel[] = [
  { id:"h1", name:"サンプルホテルA", travelFee:1000, visible:true },
  { id:"h2", name:"サンプルホテルB", travelFee:1500, visible:true },
  { id:"h3", name:"サンプルホテルC", travelFee:2000, visible:true },
  { id:"h4", name:"サンプルホテルD", travelFee:2500, visible:true },
];


export const staff: Staff[] = [
  { id:"s1", name:"スタッフA", displayName:"フロントA", loginId:"staff-a", notes:"サンプル備考", active:true },
  { id:"s2", name:"スタッフB", displayName:"フロントB", loginId:"staff-b", notes:"", active:true },
  { id:"s3", name:"スタッフC", displayName:"フロントC", loginId:"staff-c", notes:"夜帯メイン", active:true },
];


export const options: StoreOption[] = [
  { id:"op1", name:"オプションA", price:1000, notes:"サンプルオプション", active:true },
  { id:"op2", name:"オプションB", price:2000, notes:"", active:true },
  { id:"op3", name:"オプションC", price:3000, notes:"", active:true },
  { id:"op4", name:"オプションD", price:0, notes:"無料設定のサンプル", active:true },
];
