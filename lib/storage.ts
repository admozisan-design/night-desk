import type { Cast, Order } from "./types";

const ORDER_KEY = "night-desk-orders-sample-v02";
const CAST_KEY = "night-desk-casts-sample-v03";

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
