import type { Cast, Course, Driver } from "./types";

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
  { id:"d1", name:"ドライバー01", active:true },
  { id:"d2", name:"ドライバー02", active:true },
  { id:"d3", name:"ドライバー03", active:true },
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
