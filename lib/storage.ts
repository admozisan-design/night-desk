import type { AuditLog, Cast, CastSettlementAdjustment, Customer, Driver, Hotel, Order, PricingConfig, Staff, StaffPermission, StoreOption, StoreSettings } from "./types";

const ORDER_KEY = "night-desk-orders-sample-v02";
const CAST_KEY = "night-desk-casts-sample-v03";
const HOTEL_KEY = "night-desk-hotels-sample-v01";
const STAFF_KEY = "night-desk-staff-sample-v01";
const DRIVER_KEY = "night-desk-drivers-sample-v01";
const OPTION_KEY = "night-desk-options-sample-v01";
const CUSTOMER_KEY = "night-desk-customers-sample-v01";
const PRICING_KEY = "night-desk-pricing-sample-v01";
const PERMISSION_KEY = "night-desk-permissions-sample-v01";
const LOG_KEY = "night-desk-audit-log-v01";
const STORE_SETTINGS_KEY = "night-desk-store-settings-v01";
const SETTLEMENT_KEY = "night-desk-cast-settlement-v01";

export function loadOrders():Order[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as Order[]; } catch { return []; }
}

export function saveOrder(order:Order){
  const orders=loadOrders();
  localStorage.setItem(ORDER_KEY, JSON.stringify([order,...orders]));
  window.dispatchEvent(new Event("nightdesk:orders"));
  appendAuditLog("受付","オーダー登録",`${order.castName} / ${order.courseMinutes}分 / ${order.customerPhone || "電話番号なし"}`);
}

export function updateOrderStatus(id:string,status:Order["status"]){
  const orders=loadOrders().map(o=>o.id===id?{...o,status}:o);
  localStorage.setItem(ORDER_KEY,JSON.stringify(orders));
  window.dispatchEvent(new Event("nightdesk:orders"));
  const order=orders.find(o=>o.id===id);
  appendAuditLog("受付","ステータス変更",`${order?.castName ?? id} → ${status}`);
  return orders;
}

export function updateOrder(id:string,changes:Partial<Order>){
  const orders=loadOrders().map(order=>order.id===id?{...order,...changes}:order);
  localStorage.setItem(ORDER_KEY,JSON.stringify(orders));
  window.dispatchEvent(new Event("nightdesk:orders"));
  const order=orders.find(order=>order.id===id);
  appendAuditLog("受付","オーダー編集",`${order?.castName ?? id}`);
  return orders;
}

export function deleteOrder(id:string){
  const current=loadOrders();
  const target=current.find(order=>order.id===id);
  const orders=current.filter(order=>order.id!==id);
  localStorage.setItem(ORDER_KEY,JSON.stringify(orders));
  window.dispatchEvent(new Event("nightdesk:orders"));
  appendAuditLog("受付","オーダー削除",`${target?.castName ?? id}`);
  return orders;
}

function normalizeCast(cast:Cast):Cast {
  const legacyNg = (cast as unknown as { ngDetails?: string | string[] }).ngDetails;
  const normalizedNg = Array.isArray(legacyNg)
    ? legacyNg
    : typeof legacyNg === "string" && legacyNg.trim() && legacyNg !== "特になし"
      ? [legacyNg.trim()]
      : [];

  const schedule = Array.isArray(cast.schedule)
    ? cast.schedule.map(shift=>{
        const legacyReception=shift.receptionEnd;
        const legacyLeave=shift.end;
        const inferredReception=Boolean(legacyReception && legacyLeave && legacyReception!==legacyLeave);
        const endType=shift.endType ?? (inferredReception ? "reception" : "leave");
        const endTime=shift.endTime
          ?? (endType==="reception" ? legacyReception : legacyLeave)
          ?? legacyReception
          ?? legacyLeave
          ?? cast.shiftEnd
          ?? "04:00";
        const { receptionEnd:_legacyReception, end:_legacyEnd, ...rest }=shift;
        return {...rest,endType,endTime};
      })
    : [];

  return {
    ...cast,
    scheduledToday: cast.scheduledToday ?? true,
    schedule,
    visible: cast.visible ?? true,
    unitPrice: cast.unitPrice ?? 0,
    freeUnitPrice: cast.freeUnitPrice ?? cast.unitPrice ?? 0,
    photoUnitPrice: cast.photoUnitPrice ?? cast.unitPrice ?? 0,
    repeatUnitPrice: cast.repeatUnitPrice ?? cast.unitPrice ?? 0,
    ngDetails: normalizedNg,
    availableOptions: cast.availableOptions ?? [],
    notes: cast.notes ?? "",
    interviewEvaluation: cast.interviewEvaluation ?? "",
    age: cast.age ?? 0,
    heightCm: cast.heightCm ?? 0,
    bustCm: cast.bustCm ?? 0,
    waistCm: cast.waistCm ?? 0,
    hipCm: cast.hipCm ?? 0,
    cupSize: cast.cupSize ?? "",
  };
}

export function loadCasts(defaultCasts:Cast[]):Cast[] {
  if (typeof window === "undefined") return defaultCasts.map(normalizeCast);
  try {
    const raw = localStorage.getItem(CAST_KEY);
    if (!raw) return defaultCasts.map(normalizeCast);
    const parsed = JSON.parse(raw) as Cast[];
    return parsed.map(normalizeCast);
  } catch {
    return defaultCasts.map(normalizeCast);
  }
}

export function saveCasts(casts:Cast[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CAST_KEY, JSON.stringify(casts.map(normalizeCast)));
  window.dispatchEvent(new Event("nightdesk:casts"));
  appendAuditLog("キャスト","キャスト情報を保存",`${casts.length}件`);
}

function normalizeHotel(hotel:Hotel):Hotel {
  return {
    ...hotel,
    name: hotel.name ?? "",
    travelFee: hotel.travelFee ?? 0,
    visible: hotel.visible ?? true,
  };
}

export function loadHotels(defaultHotels:Hotel[]):Hotel[] {
  if (typeof window === "undefined") return defaultHotels.map(normalizeHotel);
  try {
    const raw = localStorage.getItem(HOTEL_KEY);
    if (!raw) return defaultHotels.map(normalizeHotel);
    const parsed = JSON.parse(raw) as Hotel[];
    return parsed.map(normalizeHotel);
  } catch {
    return defaultHotels.map(normalizeHotel);
  }
}

export function saveHotels(hotels:Hotel[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HOTEL_KEY, JSON.stringify(hotels.map(normalizeHotel)));
  window.dispatchEvent(new Event("nightdesk:hotels"));
  appendAuditLog("ホテル","ホテル情報を保存",`${hotels.length}件`);
}

function normalizeStaff(staff:Staff):Staff {
  return {
    ...staff,
    name: staff.name ?? "",
    displayName: staff.displayName ?? staff.name ?? "",
    loginId: staff.loginId ?? "",
    notes: staff.notes ?? "",
    active: staff.active ?? true,
  };
}

export function loadStaff(defaultStaff:Staff[]):Staff[] {
  if (typeof window === "undefined") return defaultStaff.map(normalizeStaff);
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    if (!raw) return defaultStaff.map(normalizeStaff);
    const parsed = JSON.parse(raw) as Staff[];
    return parsed.map(normalizeStaff);
  } catch {
    return defaultStaff.map(normalizeStaff);
  }
}

export function saveStaff(staff:Staff[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff.map(normalizeStaff)));
  window.dispatchEvent(new Event("nightdesk:staff"));
  appendAuditLog("スタッフ","スタッフ情報を保存",`${staff.length}件`);
}

function normalizeDriver(driver:Driver):Driver {
  return {
    ...driver,
    name: driver.name ?? "",
    phone: driver.phone ?? "",
    vehicle: driver.vehicle ?? "",
    plate: driver.plate ?? "",
    notes: driver.notes ?? "",
    active: driver.active ?? true,
  };
}

export function loadDrivers(defaultDrivers:Driver[]):Driver[] {
  if (typeof window === "undefined") return defaultDrivers.map(normalizeDriver);
  try {
    const raw = localStorage.getItem(DRIVER_KEY);
    if (!raw) return defaultDrivers.map(normalizeDriver);
    const parsed = JSON.parse(raw) as Driver[];
    return parsed.map(normalizeDriver);
  } catch {
    return defaultDrivers.map(normalizeDriver);
  }
}

export function saveDrivers(drivers:Driver[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRIVER_KEY, JSON.stringify(drivers.map(normalizeDriver)));
  window.dispatchEvent(new Event("nightdesk:drivers"));
  appendAuditLog("ドライバー","ドライバー情報を保存",`${drivers.length}件`);
}

function normalizeOption(option:StoreOption):StoreOption {
  return {
    ...option,
    name: option.name ?? "",
    price: option.price ?? 0,
    notes: option.notes ?? "",
    active: option.active ?? true,
  };
}

export function loadOptions(defaultOptions:StoreOption[]):StoreOption[] {
  if (typeof window === "undefined") return defaultOptions.map(normalizeOption);
  try {
    const raw = localStorage.getItem(OPTION_KEY);
    if (!raw) return defaultOptions.map(normalizeOption);
    const parsed = JSON.parse(raw) as StoreOption[];
    return parsed.map(normalizeOption);
  } catch {
    return defaultOptions.map(normalizeOption);
  }
}

export function saveOptions(options:StoreOption[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPTION_KEY, JSON.stringify(options.map(normalizeOption)));
  window.dispatchEvent(new Event("nightdesk:options"));
  appendAuditLog("オプション","オプション情報を保存",`${options.length}件`);
}

function normalizeCustomer(customer:Customer):Customer {
  return {
    ...customer,
    phone: customer.phone ?? "",
    name: customer.name ?? "",
    notes: customer.notes ?? "",
    ngInfo: customer.ngInfo ?? "",
    active: customer.active ?? true,
  };
}

function derivedCustomersFromOrders():Customer[] {
  const map=new Map<string,Customer>();
  for(const order of loadOrders()){
    const phone=(order.customerPhone??"").trim();
    if(!phone || map.has(phone)) continue;
    map.set(phone,{id:`customer-${phone}`,phone,name:"",notes:"",ngInfo:"",active:true});
  }
  return [...map.values()];
}

export function loadCustomers(defaultCustomers:Customer[]=[]):Customer[] {
  if (typeof window === "undefined") return defaultCustomers.map(normalizeCustomer);
  let saved:Customer[]=[];
  try {
    saved=JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "[]") as Customer[];
  } catch {
    saved=[];
  }
  const base=(saved.length?saved:defaultCustomers).map(normalizeCustomer);
  const byPhone=new Map(base.map(customer=>[customer.phone,customer]));
  for(const customer of derivedCustomersFromOrders()){
    if(!byPhone.has(customer.phone)) byPhone.set(customer.phone,customer);
  }
  return [...byPhone.values()];
}

export function saveCustomers(customers:Customer[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customers.map(normalizeCustomer)));
  window.dispatchEvent(new Event("nightdesk:customers"));
  appendAuditLog("顧客","顧客情報を保存",`${customers.length}件`);
}

export function loadPricing(defaultPricing:PricingConfig):PricingConfig {
  if (typeof window === "undefined") return defaultPricing;
  try {
    const raw=localStorage.getItem(PRICING_KEY);
    if(!raw) return defaultPricing;
    const parsed=JSON.parse(raw) as PricingConfig;
    return {
      courses:Array.isArray(parsed.courses)&&parsed.courses.length?parsed.courses:defaultPricing.courses,
      photoNominationFee:parsed.photoNominationFee ?? defaultPricing.photoNominationFee,
      repeatNominationFee:parsed.repeatNominationFee ?? defaultPricing.repeatNominationFee,
      defaultTravelFee:parsed.defaultTravelFee ?? defaultPricing.defaultTravelFee,
      extensionMinutes:parsed.extensionMinutes ?? defaultPricing.extensionMinutes,
      extensionPrice:parsed.extensionPrice ?? defaultPricing.extensionPrice,
    };
  } catch {
    return defaultPricing;
  }
}

export function savePricing(pricing:PricingConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRICING_KEY, JSON.stringify(pricing));
  window.dispatchEvent(new Event("nightdesk:pricing"));
  appendAuditLog("料金","料金設定を保存",`${pricing.courses.length}コース`);
}

export function loadPermissions(defaultPermissions:StaffPermission[]):StaffPermission[] {
  if (typeof window === "undefined") return defaultPermissions;
  try {
    const raw=localStorage.getItem(PERMISSION_KEY);
    if(!raw) return defaultPermissions;
    return JSON.parse(raw) as StaffPermission[];
  } catch {
    return defaultPermissions;
  }
}

export function savePermissions(permissions:StaffPermission[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERMISSION_KEY, JSON.stringify(permissions));
  window.dispatchEvent(new Event("nightdesk:permissions"));
  appendAuditLog("権限","スタッフ権限を保存",`${permissions.length}名`);
}

export function appendAuditLog(category:string,action:string,detail="",actor="フロント") {
  if (typeof window === "undefined") return;
  let logs:AuditLog[]=[];
  try {
    logs=JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as AuditLog[];
  } catch {
    logs=[];
  }
  const log:AuditLog={
    id:crypto.randomUUID(),
    createdAt:new Date().toISOString(),
    actor,
    category,
    action,
    detail
  };
  localStorage.setItem(LOG_KEY, JSON.stringify([log,...logs].slice(0,300)));
  window.dispatchEvent(new Event("nightdesk:logs"));
}

export function loadAuditLogs():AuditLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as AuditLog[];
  } catch {
    return [];
  }
}

export function loadStoreSettings(defaultSettings:StoreSettings):StoreSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw=localStorage.getItem(STORE_SETTINGS_KEY);
    if(!raw) return defaultSettings;
    const parsed=JSON.parse(raw) as Partial<StoreSettings>;
    return {
      openTime:parsed.openTime ?? defaultSettings.openTime,
      closeTime:parsed.closeTime ?? defaultSettings.closeTime,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveStoreSettings(settings:StoreSettings){
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_SETTINGS_KEY,JSON.stringify(settings));
  window.dispatchEvent(new Event("nightdesk:store-settings"));
  appendAuditLog("店舗設定","営業時間を保存",`${settings.openTime}〜${settings.closeTime}`);
}


export function loadCastSettlementAdjustments():Record<string,CastSettlementAdjustment> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SETTLEMENT_KEY) ?? "{}") as Record<string,CastSettlementAdjustment>;
  } catch {
    return {};
  }
}

export function saveCastSettlementAdjustment(adjustment:CastSettlementAdjustment){
  if (typeof window === "undefined") return;
  const current=loadCastSettlementAdjustments();
  const next={...current,[adjustment.orderId]:adjustment};
  localStorage.setItem(SETTLEMENT_KEY,JSON.stringify(next));
  window.dispatchEvent(new Event("nightdesk:settlement"));
  appendAuditLog("精算","キャスト精算を保存",adjustment.orderId);
  return next;
}
