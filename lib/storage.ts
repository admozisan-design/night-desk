import type { Cast, Driver, Hotel, Order, Staff } from "./types";

const ORDER_KEY = "night-desk-orders-sample-v02";
const CAST_KEY = "night-desk-casts-sample-v03";
const HOTEL_KEY = "night-desk-hotels-sample-v01";
const STAFF_KEY = "night-desk-staff-sample-v01";
const DRIVER_KEY = "night-desk-drivers-sample-v01";

export function loadOrders():Order[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]") as Order[]; } catch { return []; }
}

export function saveOrder(order:Order){
  const orders=loadOrders();
  localStorage.setItem(ORDER_KEY, JSON.stringify([order,...orders]));
}

export function updateOrderStatus(id:string,status:Order["status"]){
  const orders=loadOrders().map(o=>o.id===id?{...o,status}:o);
  localStorage.setItem(ORDER_KEY,JSON.stringify(orders));
  return orders;
}

function normalizeCast(cast:Cast):Cast {
  const legacyNg = (cast as unknown as { ngDetails?: string | string[] }).ngDetails;
  const normalizedNg = Array.isArray(legacyNg)
    ? legacyNg
    : typeof legacyNg === "string" && legacyNg.trim() && legacyNg !== "特になし"
      ? [legacyNg.trim()]
      : [];

  return {
    ...cast,
    scheduledToday: cast.scheduledToday ?? true,
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
}
