import { cloudConfigured, writeCloudManaged } from "./cloud";
import type { AuditLog, Cast, CastSettlementAdjustment, CastSettlementDailyConfig, Customer, DispatchWidgetSetting, Driver, Hotel, Order, PricingConfig, Staff, StaffPermission, StoreOption, StoreSettings, TopNavItem } from "./types";
import {
  casts as demoCasts,
  defaultPricingConfig as demoPricing,
  defaultStoreSettings as demoStoreSettings,
  demoAuditLogs,
  demoCustomers,
  demoOrders,
  demoPermissions,
  demoSettlementAdjustments,
  demoSettlementDailyConfigs,
  drivers as demoDrivers,
  hotels as demoHotels,
  options as demoOptions,
  staff as demoStaff
} from "./mock-data";

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
const SETTLEMENT_DAILY_KEY = "night-desk-cast-settlement-daily-v01";
const SHARED_MEMO_KEY = "night-desk-shared-memo-v01";
const TOP_NAV_KEY = "night-desk-top-nav-v01";
const DISPATCH_WIDGET_KEY = "night-desk-dispatch-widgets-v01";
const DEMO_SEED_KEY = "night-desk-demo-seed-version";
const DEMO_SEED_VERSION = "2026-09-full-demo-v2";

function safeJson<T>(raw:string|null,fallback:T):T{
  if(!raw) return fallback;
  try{return JSON.parse(raw) as T;}catch{return fallback;}
}

function seedArray<T extends {id:string}>(key:string,demo:T[],legacyIds:string[]=[]){
  const raw=localStorage.getItem(key);
  const current=safeJson<T[]>(raw,[]);
  const legacySet=new Set(legacyIds);
  const onlyLegacy=current.length>0 && legacySet.size>0 && current.every(item=>legacySet.has(item.id));

  if(!raw || current.length===0 || onlyLegacy){
    localStorage.setItem(key,JSON.stringify(demo));
    return;
  }

  const byId=new Map(current.map(item=>[item.id,item]));
  for(const item of demo){
    if(!byId.has(item.id)) byId.set(item.id,item);
  }
  localStorage.setItem(key,JSON.stringify([...byId.values()]));
}

function seedRecord<T>(key:string,demo:Record<string,T>){
  const current=safeJson<Record<string,T>>(localStorage.getItem(key),{});
  localStorage.setItem(key,JSON.stringify({...demo,...current}));
}

function ensureDemoDataSeeded(){
  if(typeof window==="undefined" || cloudConfigured) return;
  if(localStorage.getItem(DEMO_SEED_KEY)===DEMO_SEED_VERSION) return;

  seedArray(CAST_KEY,demoCasts,["c1","c2","c3","c4"]);
  seedArray(DRIVER_KEY,demoDrivers,["d1","d2","d3"]);
  const demoDriverEmailMigration=new Map(demoDrivers.map(driver=>[driver.id,driver.email??""]));
  const savedDrivers=safeJson<Driver[]>(localStorage.getItem(DRIVER_KEY),[]);
  const migratedDrivers=savedDrivers.map(driver=>
    driver.email===undefined && demoDriverEmailMigration.has(driver.id)
      ? {...driver,email:demoDriverEmailMigration.get(driver.id)??""}
      : driver
  );
  localStorage.setItem(DRIVER_KEY,JSON.stringify(migratedDrivers));
  seedArray(HOTEL_KEY,demoHotels,["h1","h2","h3","h4"]);
  seedArray(STAFF_KEY,demoStaff,["s1","s2","s3"]);
  seedArray(OPTION_KEY,demoOptions,["op1","op2","op3","op4"]);
  seedArray(ORDER_KEY,demoOrders);
  seedArray(CUSTOMER_KEY,demoCustomers);

  if(!localStorage.getItem(PRICING_KEY)) localStorage.setItem(PRICING_KEY,JSON.stringify(demoPricing));
  if(!localStorage.getItem(STORE_SETTINGS_KEY)) localStorage.setItem(STORE_SETTINGS_KEY,JSON.stringify(demoStoreSettings));
  if(!localStorage.getItem(PERMISSION_KEY)) localStorage.setItem(PERMISSION_KEY,JSON.stringify(demoPermissions));

  seedRecord(SETTLEMENT_KEY,demoSettlementAdjustments);
  seedRecord(SETTLEMENT_DAILY_KEY,demoSettlementDailyConfigs);

  const currentLogs=safeJson<AuditLog[]>(localStorage.getItem(LOG_KEY),[]);
  if(currentLogs.length===0){
    localStorage.setItem(LOG_KEY,JSON.stringify(demoAuditLogs));
  }else{
    const ids=new Set(currentLogs.map(log=>log.id));
    localStorage.setItem(LOG_KEY,JSON.stringify([...currentLogs,...demoAuditLogs.filter(log=>!ids.has(log.id))].slice(0,300)));
  }

  localStorage.setItem(DEMO_SEED_KEY,DEMO_SEED_VERSION);
}


