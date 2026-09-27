"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { formatYen } from "@/lib/pricing";
import { loadOrders,updateOrderStatus } from "@/lib/storage";
import type { Order,OrderStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";

const nextStatus:Partial<Record<OrderStatus,OrderStatus>>={accepted:"dispatching",dispatching:"serving",serving:"completed"};
const nextLabel:Partial<Record<OrderStatus,string>>={accepted:"配車へ",dispatching:"接客開始",serving:"完了"};

export default function OrdersPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  useEffect(()=>setOrders(loadOrders()),[]);
  function advance(order:Order){const status=nextStatus[order.status]; if(status)setOrders(updateOrderStatus(order.id,status));}
  return <div>
    <header className="pageHeader"><div><p className="eyebrow">ORDERS</p><h1>オーダー一覧</h1><p>受付から完了までの進行状況を管理します。</p></div><Link href="/orders/new" className="primaryButton">＋ 新規受付</Link></header>
    <section className="panel tablePanel">
      {orders.length===0?<div className="empty"><strong>まだオーダーがありません</strong><p>新規受付を登録するとここに表示されます。</p></div>:
      <div className="orderTable">{orders.map(order=><article className="orderCard" key={order.id}>
        <div className="orderTop"><StatusBadge status={order.status}/><small>{order.scheduledStart} → {order.scheduledEnd}</small></div>
        <h3>{order.castName} <span>{order.courseMinutes}分</span></h3>
        <p>{order.locationName} {order.room && `/ ${order.room}号室`}</p>
        <div className="orderMeta"><span>担当: {order.driverName??"未割当"}</span><strong>{formatYen(order.total)}</strong></div>
        <div className="orderActions">
          {nextStatus[order.status]&&<button onClick={()=>advance(order)}>{nextLabel[order.status]}</button>}
          {order.status!=="completed"&&order.status!=="cancelled"&&<button className="ghostDanger" onClick={()=>setOrders(updateOrderStatus(order.id,"cancelled"))}>キャンセル</button>}
        </div>
      </article>)}</div>}
    </section>
  </div>
}
