import type { Cast, Course, Driver } from "./types";

export const casts: Cast[] = [
  {
    id:"c1", name:"サンプルA", status:"waiting", shiftStart:"12:00", shiftEnd:"20:00",
    unitPrice:5000, ngDetails:"サンプルNG内容", availableOptions:["オプションA","オプションC"], notes:"サンプル備考"
  },
  {
    id:"c2", name:"サンプルB", status:"serving", availableAt:"15:30", shiftStart:"14:00", shiftEnd:"22:00",
    unitPrice:6000, ngDetails:"特になし", availableOptions:["オプションA","オプションB"], notes:"受付時に確認事項あり"
  },
  {
    id:"c3", name:"サンプルC", status:"moving", availableAt:"18:00", shiftStart:"17:00", shiftEnd:"01:00",
    unitPrice:5500, ngDetails:"サンプルNG", availableOptions:["オプションB"], notes:"サンプル備考"
  },
  {
    id:"c4", name:"サンプルD", status:"waiting", shiftStart:"20:00", shiftEnd:"04:00",
    unitPrice:7000, ngDetails:"特になし", availableOptions:["オプションA","オプションB","オプションC"], notes:""
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
