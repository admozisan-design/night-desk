import type { Cast, Course, Driver } from "./types";
export const casts: Cast[] = [
  { id:"c1", name:"てぃあ", status:"waiting", shiftStart:"18:00", shiftEnd:"04:00" },
  { id:"c2", name:"あいら", status:"serving", availableAt:"23:30", shiftStart:"19:00", shiftEnd:"03:00" },
  { id:"c3", name:"りつ", status:"moving", availableAt:"22:50", shiftStart:"20:00", shiftEnd:"04:00" },
  { id:"c4", name:"こはく", status:"waiting", shiftStart:"21:00", shiftEnd:"05:00" },
];
export const drivers: Driver[] = [
  { id:"d1", name:"ドライバーA", active:true },
  { id:"d2", name:"ドライバーB", active:true },
  { id:"d3", name:"ドライバーC", active:true },
];
export const courses: Course[] = [
  { id:"60", minutes:60, price:13000 }, { id:"70", minutes:70, price:15000 },
  { id:"80", minutes:80, price:17000 }, { id:"90", minutes:90, price:19000 },
  { id:"100", minutes:100, price:21000 }, { id:"120", minutes:120, price:25000 },
];
export const pricingSettings = { photoNominationFee:2000, repeatNominationFee:2000, defaultTravelFee:2000 };
