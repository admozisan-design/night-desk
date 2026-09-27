export type CastStatus = "waiting" | "moving" | "serving" | "off";
export type OrderStatus = "accepted" | "dispatching" | "serving" | "completed" | "cancelled";
export type Cast = {
  id:string;
  name:string;
  status:CastStatus;
  availableAt?:string;
  shiftStart?:string;
  shiftEnd?:string;
  scheduledToday?:boolean;
  visible?:boolean;
};
export type Driver = { id:string; name:string; active:boolean; };
export type Course = { id:string; minutes:number; price:number; };
export type Order = {
  id:string; createdAt:string; customerPhone:string; locationType:"hotel"|"home";
  locationName:string; room?:string; castId:string; castName:string; driverId?:string; driverName?:string;
  courseMinutes:number; nominationType:"free"|"photo"|"repeat"; optionsTotal:number; travelFee:number;
  discount:number; adjustment:number; total:number; status:OrderStatus; scheduledStart:string; scheduledEnd:string; note?:string;
};
