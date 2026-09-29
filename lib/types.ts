export type CastStatus = "waiting" | "moving" | "serving" | "off";
export type CastAttendanceStatus = "present" | "late" | "absent" | "leftEarly";
export type CastShiftEndType = "reception" | "leave";
export type CastShift = {
  date:string;
  start:string;
  endType:CastShiftEndType;
  endTime:string;
  working:boolean;
  attendance?:CastAttendanceStatus;
  /** Legacy fields kept only so previously saved browser data can be migrated. */
  receptionEnd?:string;
  end?:string;
};
export type OrderStatus = "accepted" | "dispatching" | "serving" | "completed" | "cancelled";
export type Cast = {
  id:string;
  name:string;
  status:CastStatus;
  availableAt?:string;
  shiftStart?:string;
  shiftEnd?:string;
  scheduledToday?:boolean;
  schedule?:CastShift[];
  visible?:boolean;
  unitPrice?:number;
  freeUnitPrice?:number;
  photoUnitPrice?:number;
  repeatUnitPrice?:number;
  ngDetails?:string[];
  availableOptions?:string[];
  notes?:string;
  advertisingUrl?:string;
  interviewEvaluation?:string;
  age?:number;
  heightCm?:number;
  bustCm?:number;
  waistCm?:number;
  hipCm?:number;
  cupSize?:string;
};
export type Driver = { id:string; name:string; phone?:string; email?:string; vehicle?:string; plate?:string; notes?:string; active:boolean; };
export type Course = { id:string; minutes:number; price:number; };
export type Hotel = { id:string; name:string; travelFee:number; visible?:boolean; kind?:"business"|"love"|"home"; address?:string; };
export type Staff = { id:string; name:string; displayName:string; loginId:string; notes?:string; active?:boolean; };
export type StoreOption = { id:string; name:string; price:number; notes?:string; active?:boolean; };
export type StoreSettings = { openTime:string; closeTime:string; cardFeeRate:number; priceUnit:10|100|500|1000; miscExpenseMode:"fixed"|"percent"; miscExpenseValue:number; changeFee:number; cancelFee:number; };
export type CastSettlementAdjustment = {
  orderId:string;
  optionBack:number;
  extensionBack:number;
  adjustment:number;
  memo?:string;
};
export type CastSettlementDailyConfig = {
  key:string;
  date:string;
  castId:string;
  miscExpenseEnabled:boolean;
  /** Legacy value kept for previously saved browser data. The current amount is calculated from StoreSettings. */
  miscExpense?:number;
};
export type Customer = { id:string; phone:string; name?:string; notes?:string; ngInfo?:string; active?:boolean; };
export type PricingConfig = {
  courses:Course[];
  photoNominationFee:number;
  repeatNominationFee:number;
  defaultTravelFee:number;
  extensionMinutes:number;
  extensionPrice:number;
};
export type StaffPermission = {
  staffId:string;
  reception:boolean;
  orders:boolean;
  sales:boolean;
  settings:boolean;
};
export type AuditLog = {
  id:string;
  createdAt:string;
  actor:string;
  category:string;
  action:string;
  detail?:string;
};
export type Order = {
  id:string; createdAt:string; customerPhone:string; locationType:"hotel"|"home";
  locationName:string; room?:string; address?:string; castId:string; castName:string; driverId?:string; driverName?:string; pickupDriverId?:string; pickupDriverName?:string;
  courseId?:string; courseMinutes:number; extensionMinutes?:number; extensionTotal?:number; nominationType:"free"|"photo"|"repeat"; selectedOptions?:string[]; optionsTotal:number; travelFee:number;
  discount:number; surcharge?:number; adjustment:number; paymentMethod?:"cash"|"card"; cardFee?:number; changeFee?:number; cancelFee?:number; changeCount?:number; changeHistory?:Array<{fromCastId:string;fromCastName:string;toCastId:string;toCastName:string;fee:number;changedAt:string}>; cancelledAt?:string; total:number; status:OrderStatus; serviceDate?:string; scheduledStart:string; scheduledEnd:string; inTime?:string; note?:string; handoffNote?:string;
};

export type TopNavItem = {
  id:string;
  href:string;
  label:string;
  visible:boolean;
  locked?:boolean;
  inMenu?:boolean;
};


export type DispatchWidgetArea = "left" | "center" | "right" | "bottom";
export type DispatchWidgetId = "date" | "sharedMemo" | "orderRegister" | "reservations" | "board";
export type DispatchWidgetSetting = {
  id:DispatchWidgetId;
  label:string;
  area:DispatchWidgetArea;
  order:number;
  visible:boolean;
};
