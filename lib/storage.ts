import type { Order } from "./types";
const KEY = "night-desk-orders-v01";
export function loadOrders():Order[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Order[]; } catch { return []; }
}
export function saveOrder(order:Order){ const orders=loadOrders(); localStorage.setItem(KEY, JSON.stringify([order,...orders])); }
export function updateOrderStatus(id:string,status:Order["status"]){
  const orders=loadOrders().map(o=>o.id===id?{...o,status}:o); localStorage.setItem(KEY,JSON.stringify(orders)); return orders;
}
