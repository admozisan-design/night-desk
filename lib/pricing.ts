import type { Course } from "./types";
export function calculateOrderTotal(params:{
  course?:Course; nominationType:"free"|"photo"|"repeat"; photoNominationFee:number; repeatNominationFee:number;
  optionsTotal:number; travelFee:number; discount:number; adjustment:number;
}) {
  const base = params.course?.price ?? 0;
  const nomination = params.nominationType === "photo" ? params.photoNominationFee : params.nominationType === "repeat" ? params.repeatNominationFee : 0;
  return Math.max(0, base + nomination + params.optionsTotal + params.travelFee - params.discount + params.adjustment);
}
export function formatYen(value:number){ return `${new Intl.NumberFormat("ja-JP").format(value)}円`; }
